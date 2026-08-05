"""DAO for subscription online payments (bePaid)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.subscription_payment import SubscriptionPayment
from backend.enums import SubscriptionPaymentStatus


class SubscriptionPaymentDAO(BaseDAO[SubscriptionPayment]):
    model = SubscriptionPayment

    @classmethod
    async def get_by_tracking_id(
        cls,
        session: AsyncSession,
        tracking_id: str,
    ) -> SubscriptionPayment | None:
        stmt = select(cls.model).where(cls.model.tracking_id == tracking_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        payment_id: uuid.UUID,
    ) -> SubscriptionPayment | None:
        stmt = select(cls.model).where(
            cls.model.user_id == user_id,
            cls.model.id == payment_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_latest_successful_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> SubscriptionPayment | None:
        """Return the most recent successful payment for the user, if any."""
        stmt = (
            select(cls.model)
            .where(
                cls.model.user_id == user_id,
                cls.model.status == SubscriptionPaymentStatus.SUCCESSFUL.value,
            )
            .order_by(cls.model.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
