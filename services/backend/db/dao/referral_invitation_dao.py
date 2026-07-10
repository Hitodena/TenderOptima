import secrets
import uuid
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import ReferralInvitation


class ReferralInvitationDAO(BaseDAO[ReferralInvitation]):
    """Persistence helpers for one-time registration invitations."""

    model = ReferralInvitation

    @classmethod
    async def generate_unique_code(cls, session: AsyncSession) -> str:
        """Generate a URL-safe code that does not exist yet."""
        for _ in range(10):
            code = secrets.token_urlsafe(18)
            existing = await cls.get_by_code(session, code)
            if existing is None:
                return code
        raise RuntimeError("Failed to generate unique referral code")

    @classmethod
    async def create_invitation(
        cls,
        session: AsyncSession,
        *,
        inviter_name: str,
        created_by_admin_id: uuid.UUID | None,
    ) -> ReferralInvitation:
        """Create an unused invitation with a generated one-time code."""
        code = await cls.generate_unique_code(session)
        return await cls.create(
            session,
            code=code,
            inviter_name=inviter_name,
            created_by_admin_id=created_by_admin_id,
        )

    @classmethod
    async def get_by_code(
        cls, session: AsyncSession, code: str
    ) -> ReferralInvitation | None:
        """Load an invitation by code."""
        stmt = select(cls.model).where(cls.model.code == code)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_available_by_code_for_update(
        cls, session: AsyncSession, code: str
    ) -> ReferralInvitation | None:
        """Lock and load an unused invitation for registration."""
        stmt = (
            select(cls.model)
            .where(
                cls.model.code == code,
                cls.model.used_by_user_id.is_(None),
            )
            .with_for_update()
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def list_invitations(
        cls, session: AsyncSession
    ) -> list[ReferralInvitation]:
        """List invitations newest first with used user loaded."""
        stmt = (
            select(cls.model)
            .options(selectinload(cls.model.used_by_user))
            .order_by(cls.model.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def mark_used(
        cls,
        session: AsyncSession,
        invitation: ReferralInvitation,
        *,
        user_id: uuid.UUID,
    ) -> ReferralInvitation:
        """Mark a locked invitation as consumed by a newly registered user."""
        if invitation.used_by_user_id is not None:
            raise ValueError("Referral invitation is already used")
        invitation.used_by_user_id = user_id
        invitation.used_at = datetime.now(UTC)
        session.add(invitation)
        await session.flush()
        logger.info(
            "Referral invitation used",
            invitation_id=str(invitation.id),
            user_id=str(user_id),
        )
        return invitation
