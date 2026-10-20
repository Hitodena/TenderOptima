from __future__ import annotations

import pytest

from backend.db.models import MailAccount
from backend.enums import MailAccountSource
from backend.schemas.mail_account import MailAccountResponse
from backend.utils.user_email_credentials import (
    MailAccountUnavailableError,
    resolve_imap_credentials,
    resolve_smtp_credentials,
)


def test_unassigned_account_never_uses_a_global_fallback() -> None:
    with pytest.raises(MailAccountUnavailableError, match="mail_account_not_assigned"):
        resolve_smtp_credentials(None)
    with pytest.raises(MailAccountUnavailableError, match="mail_account_not_assigned"):
        resolve_imap_credentials(None)


def test_unavailable_persisted_account_is_rejected_before_connection() -> None:
    account = MailAccount(
        email="mailbox@example.test",
        source=MailAccountSource.ADMIN.value,
        availability=False,
        smtp_available=False,
        imap_available=False,
    )
    with pytest.raises(MailAccountUnavailableError, match="mail_account_unavailable"):
        resolve_smtp_credentials(account)


def test_safe_mail_account_response_has_no_password_fields() -> None:
    safe_fields = set(MailAccountResponse.model_fields)
    assert "smtp_password" not in safe_fields
    assert "imap_password" not in safe_fields
    assert "password" not in safe_fields
