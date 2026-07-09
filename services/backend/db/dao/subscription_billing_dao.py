import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.subscription_billing import (
    SubscriptionBillingDocument,
    SubscriptionBillingProfile,
)


class SubscriptionBillingProfileDAO(BaseDAO[SubscriptionBillingProfile]):
    model = SubscriptionBillingProfile

    @classmethod
    async def get_by_user_id(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> SubscriptionBillingProfile | None:
        stmt = select(cls.model).where(cls.model.user_id == user_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def upsert_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        **values,
    ) -> SubscriptionBillingProfile:
        existing = await cls.get_by_user_id(session, user_id)
        if existing is None:
            return await cls.create(session, user_id=user_id, **values)
        if values:
            updated = await cls.update_fields(session, existing.id, **values)
            if updated is None:
                raise ValueError(f"Billing profile {existing.id} not found")
            return updated
        return existing


class SubscriptionBillingDocumentDAO(BaseDAO[SubscriptionBillingDocument]):
    model = SubscriptionBillingDocument

    @classmethod
    async def list_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[SubscriptionBillingDocument]:
        stmt = (
            select(cls.model)
            .where(cls.model.user_id == user_id)
            .order_by(cls.model.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> SubscriptionBillingDocument | None:
        stmt = select(cls.model).where(
            cls.model.user_id == user_id,
            cls.model.id == document_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_receipt(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        receipt_id: str,
    ) -> SubscriptionBillingDocument | None:
        stmt = select(cls.model).where(
            cls.model.user_id == user_id,
            cls.model.receipt_id == receipt_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def mark_sent(
        cls,
        session: AsyncSession,
        document_id: uuid.UUID,
        *,
        recipient_email: str,
        sent_at: datetime,
    ) -> SubscriptionBillingDocument | None:
        return await cls.update_fields(
            session,
            document_id,
            email_status="sent",
            recipient_email=recipient_email,
            sent_at=sent_at,
        )
