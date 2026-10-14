from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

import backend.api.auth.router as auth_router
from backend.core.config import Config
from backend.schemas.user_email_settings import UserEmailSettingsUpdate
from backend.utils import secret_encryption
from backend.utils import user_email_settings_validation as validation
from backend.utils.user_email_credentials import (
    resolve_imap_credentials,
    resolve_smtp_credentials,
)
from backend.utils.user_email_settings import apply_email_settings_update
from backend.utils.user_email_settings_validation import (
    UserEmailSettingsConnectionError,
)


def _config() -> Config:
    return Config.model_construct(
        secret_key="synthetic-test-key",
        smtp_host="global.smtp.invalid",
        smtp_port=587,
        smtp_user="global-smtp-user",
        smtp_password="global-smtp-password",
        imap_host="global.imap.invalid",
        imap_port=993,
        imap_user="global-imap-user",
        imap_password="global-imap-password",
    )


def _user() -> SimpleNamespace:
    return SimpleNamespace(
        smtp_host=None,
        smtp_port=None,
        smtp_user=None,
        smtp_password=None,
        imap_host=None,
        imap_port=None,
        imap_user=None,
        imap_password=None,
    )


def test_password_whitespace_is_preserved_but_hosts_and_logins_are_trimmed():
    update = UserEmailSettingsUpdate(
        smtp_host=" smtp.timeweb.invalid ",
        smtp_user=" mailbox@example.invalid ",
        smtp_password="  synthetic password  ",
    )

    assert update.smtp_host == "smtp.timeweb.invalid"
    assert update.smtp_user == "mailbox@example.invalid"
    assert update.smtp_password == "  synthetic password  "


def test_password_round_trip_uses_custom_ports_and_can_clear_them(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = _config()
    monkeypatch.setattr(secret_encryption, "get_config", lambda: config)
    user = _user()
    smtp_password = "  synthetic smtp password  "
    imap_password = "\tsynthetic imap password\t"

    apply_email_settings_update(
        user,
        smtp_host="smtp.timeweb.invalid",
        smtp_port=465,
        smtp_user="mailbox@example.invalid",
        smtp_password=smtp_password,
        imap_host="imap.timeweb.invalid",
        imap_port=1143,
        imap_user="mailbox@example.invalid",
        imap_password=imap_password,
    )

    smtp = resolve_smtp_credentials(user, config)
    imap = resolve_imap_credentials(user, config)
    assert (smtp.host, smtp.port, smtp.password) == (
        "smtp.timeweb.invalid",
        465,
        smtp_password,
    )
    assert (imap.host, imap.port, imap.password) == (
        "imap.timeweb.invalid",
        1143,
        imap_password,
    )

    apply_email_settings_update(
        user,
        clear_smtp_port=True,
        clear_imap_port=True,
    )
    assert user.smtp_port is None
    assert user.imap_port is None
    assert resolve_smtp_credentials(user, config).port == config.smtp_port
    assert resolve_imap_credentials(user, config).port == config.imap_port


def test_invalid_candidate_connection_raises_before_any_settings_are_mutated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = _config()
    user = _user()
    update = UserEmailSettingsUpdate(
        smtp_host="smtp.timeweb.invalid",
        smtp_port=465,
        smtp_user="mailbox@example.invalid",
        smtp_password="synthetic-invalid-password",
    )

    def reject_credentials(_credentials) -> None:
        raise OSError("synthetic connection failure")

    monkeypatch.setattr(
        validation, "verify_smtp_credentials", reject_credentials
    )

    with pytest.raises(UserEmailSettingsConnectionError) as error:
        validation.validate_user_email_settings_update(user, update, config)

    assert error.value.protocol == "smtp"
    assert user.smtp_host is None
    assert user.smtp_port is None
    assert user.smtp_password is None


def test_validation_checks_both_new_mailboxes_with_their_selected_ports(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    config = _config()
    user = _user()
    update = UserEmailSettingsUpdate(
        smtp_host="smtp.timeweb.invalid",
        smtp_port=465,
        smtp_user="mailbox@example.invalid",
        smtp_password="  synthetic smtp password  ",
        imap_host="imap.timeweb.invalid",
        imap_port=1143,
        imap_user="mailbox@example.invalid",
        imap_password="\tsynthetic imap password\t",
    )
    smtp_candidates = []
    imap_candidates = []
    monkeypatch.setattr(
        validation,
        "verify_smtp_credentials",
        smtp_candidates.append,
    )
    monkeypatch.setattr(
        validation,
        "verify_imap_credentials",
        imap_candidates.append,
    )

    validation.validate_user_email_settings_update(user, update, config)

    assert len(smtp_candidates) == len(imap_candidates) == 1
    assert (smtp_candidates[0].port, smtp_candidates[0].password) == (
        465,
        "  synthetic smtp password  ",
    )
    assert (imap_candidates[0].port, imap_candidates[0].password) == (
        1143,
        "\tsynthetic imap password\t",
    )
    assert user.smtp_password is None
    assert user.imap_password is None


def test_invalid_port_is_rejected_by_update_schema() -> None:
    with pytest.raises(ValidationError):
        UserEmailSettingsUpdate(smtp_port=65536)


@pytest.mark.asyncio
async def test_profile_does_not_save_when_connection_verification_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = SimpleNamespace(id=uuid4())
    body = UserEmailSettingsUpdate(
        smtp_host="smtp.timeweb.invalid",
        smtp_user="mailbox@example.invalid",
        smtp_password="synthetic-invalid-password",
    )
    update_dao = AsyncMock()

    def reject_update(*_args, **_kwargs) -> None:
        raise UserEmailSettingsConnectionError("smtp")

    monkeypatch.setattr(
        auth_router,
        "validate_user_email_settings_update",
        reject_update,
    )
    monkeypatch.setattr(
        auth_router.UserAdminDAO,
        "update_email_settings",
        update_dao,
    )

    with pytest.raises(HTTPException) as error:
        await auth_router.update_my_email_settings(body, user, object())

    assert error.value.status_code == 422
    update_dao.assert_not_awaited()
