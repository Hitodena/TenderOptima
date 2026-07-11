"""Tests for referral-only registration."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from backend.api.auth.router import (
    delete_my_account,
    login,
    register,
    revoke_my_consent,
)
from backend.api.auth.schemas import ConsentActionRequest, RegisterCreate
from backend.db.models import User
from fastapi import HTTPException

VALID_PAYLOAD = {
    "email": "new@example.com",
    "password": "SecurePass123!",
    "full_name": "Новый Пользователь",
    "company_name": "ООО Ромашка",
    "phone": "+375291234567",
    "referral_code": "valid-referral-code",
    "agree_terms": True,
    "agree_marketing": False,
}


class FakeInvitation:
    def __init__(self) -> None:
        self.id = uuid.uuid4()
        self.inviter_name = "Андрей Викторович"
        self.used_by_user_id = None


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.committed = False
        self.rolled_back = False

    def add(self, obj: object) -> None:
        self.added.append(obj)

    async def flush(self) -> None:
        for obj in self.added:
            if isinstance(obj, User) and obj.id is None:
                obj.id = uuid.uuid4()

    async def commit(self) -> None:
        self.committed = True

    async def rollback(self) -> None:
        self.rolled_back = True

    async def refresh(self, _obj: object) -> None:
        return None


@pytest.mark.asyncio
async def test_register_requires_available_referral():
    session = FakeSession()
    request = RegisterCreate(**VALID_PAYLOAD)

    with (
        patch(
            "backend.api.auth.router.UserDAO.get_by_email",
            AsyncMock(return_value=None),
        ),
        patch(
            "backend.api.auth.router.ReferralInvitationDAO.get_available_by_code_for_update",
            AsyncMock(return_value=None),
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            await register(request, session)  # type: ignore[arg-type]

    assert exc.value.status_code == 403
    assert session.added == []


@pytest.mark.asyncio
async def test_register_rejects_missing_required_consent():
    session = FakeSession()
    request = RegisterCreate(**{**VALID_PAYLOAD, "agree_terms": False})

    with patch(
        "backend.api.auth.router.UserDAO.get_by_email",
        AsyncMock(return_value=None),
    ):
        with pytest.raises(HTTPException) as exc:
            await register(request, session)  # type: ignore[arg-type]

    assert exc.value.status_code == 422
    assert session.added == []


@pytest.mark.asyncio
async def test_register_consumes_referral_and_sets_user_ref_by():
    session = FakeSession()
    invitation = FakeInvitation()
    request = RegisterCreate(**VALID_PAYLOAD)

    mark_used = AsyncMock()
    upsert_subscription = AsyncMock()

    with (
        patch(
            "backend.api.auth.router.UserDAO.get_by_email",
            AsyncMock(return_value=None),
        ),
        patch(
            "backend.api.auth.router.ReferralInvitationDAO.get_available_by_code_for_update",
            AsyncMock(return_value=invitation),
        ),
        patch(
            "backend.api.auth.router.ReferralInvitationDAO.mark_used",
            mark_used,
        ),
        patch(
            "backend.api.auth.router.SubscriptionDAO.upsert_for_user",
            upsert_subscription,
        ),
    ):
        token = await register(request, session)  # type: ignore[arg-type]

    user = next(obj for obj in session.added if isinstance(obj, User))
    assert user.ref_by == invitation.inviter_name
    assert user.referral_invitation_id == invitation.id
    assert session.committed is True
    mark_used.assert_awaited_once_with(session, invitation, user_id=user.id)
    upsert_subscription.assert_awaited_once()
    assert token.token_type == "bearer"


@pytest.mark.asyncio
async def test_login_rejects_revoked_account():
    session = FakeSession()
    user = User(
        email="revoked@example.com",
        hashed_password="hash",
        full_name="Revoked User",
        agree_terms=False,
        consent_revoked_at=datetime.now(UTC),
    )

    with patch(
        "backend.api.auth.router.UserDAO.get_by_email",
        AsyncMock(return_value=user),
    ):
        with pytest.raises(HTTPException) as exc:
            await login(
                SimpleNamespace(
                    username="revoked@example.com",
                    password="SecurePass123!",
                ),
                session,  # type: ignore[arg-type]
            )

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_revoke_consent_requires_acknowledgement():
    session = FakeSession()
    current_user = User(
        email="user@example.com",
        hashed_password="hash",
        full_name="User",
    )
    current_user.id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        await revoke_my_consent(
            ConsentActionRequest(acknowledged=False),
            current_user,
            session,  # type: ignore[arg-type]
        )

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_revoke_consent_disables_subscription():
    session = FakeSession()
    current_user = User(
        email="user@example.com",
        hashed_password="hash",
        full_name="User",
    )
    current_user.id = uuid.uuid4()
    updated_user = User(
        email="user@example.com",
        hashed_password="hash",
        full_name="User",
        agree_terms=False,
        consent_revoked_at=datetime.now(UTC),
    )
    updated_user.id = current_user.id

    revoke = AsyncMock(return_value=updated_user)
    deactivate = AsyncMock()

    with (
        patch(
            "backend.api.auth.router.UserDAO.revoke_required_consent", revoke
        ),
        patch(
            "backend.api.auth.router.deactivate_user_subscription",
            deactivate,
        ),
    ):
        response = await revoke_my_consent(
            ConsentActionRequest(acknowledged=True),
            current_user,
            session,  # type: ignore[arg-type]
        )

    revoke.assert_awaited_once_with(session, current_user.id, reason=None)
    deactivate.assert_awaited_once_with(session, updated_user)
    assert response.status == "consent_revoked"


@pytest.mark.asyncio
async def test_delete_account_anonymizes_and_disables_subscription():
    session = FakeSession()
    current_user = User(
        email="user@example.com",
        hashed_password="hash",
        full_name="User",
    )
    current_user.id = uuid.uuid4()
    deleted_user = User(
        email=f"deleted-{current_user.id}@deleted.tenderoptima.local",
        hashed_password="hash",
        full_name="Удалённый пользователь",
        deleted_at=datetime.now(UTC),
    )
    deleted_user.id = current_user.id

    anonymize = AsyncMock(return_value=deleted_user)
    deactivate = AsyncMock()

    with (
        patch("backend.api.auth.router.UserDAO.anonymize_account", anonymize),
        patch(
            "backend.api.auth.router.deactivate_user_subscription",
            deactivate,
        ),
    ):
        response = await delete_my_account(
            ConsentActionRequest(acknowledged=True, reason="not needed"),
            current_user,
            session,  # type: ignore[arg-type]
        )

    assert anonymize.await_args.kwargs["reason"] == "not needed"
    deactivate.assert_awaited_once_with(session, deleted_user)
    assert response.status == "account_deleted"
