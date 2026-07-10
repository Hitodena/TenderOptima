"""Tests for referral-only registration."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from backend.api.auth.router import register
from backend.api.auth.schemas import RegisterCreate
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
