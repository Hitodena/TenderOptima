"""DAO helpers for cooperation invitation leads."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.cooperation import CooperationLead
from backend.enums import CooperationLeadStatus


class CooperationLeadDAO(BaseDAO[CooperationLead]):
    model = CooperationLead

    @classmethod
    async def get_by_email_active(
        cls,
        session: AsyncSession,
        email: str,
    ) -> CooperationLead | None:
        """Load a lead by email (latest open moderation candidate)."""
        stmt = (
            select(cls.model)
            .where(cls.model.email == email)
            .order_by(cls.model.created_at.desc())
        )
        result = await session.execute(stmt)
        return result.scalars().first()

    @classmethod
    async def count_recent_by_ip(
        cls,
        session: AsyncSession,
        ip_address: str,
        since: datetime,
    ) -> int:
        """Count submissions from an IP since a timestamp (rate-limit check)."""
        stmt = select(func.count()).where(
            cls.model.ip_address == ip_address,
            cls.model.created_at >= since,
        )
        result = await session.execute(stmt)
        return result.scalar_one()

    @classmethod
    async def list_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
        status: CooperationLeadStatus | None = None,
    ) -> tuple[list[CooperationLead], int]:
        """Return a page of leads newest-first, with total row count."""
        filters = []
        if status is not None:
            filters.append(cls.model.status == status.value)

        count_stmt = select(func.count()).select_from(cls.model)
        for condition in filters:
            count_stmt = count_stmt.where(condition)
        total = (await session.execute(count_stmt)).scalar_one()

        offset = max(page - 1, 0) * size
        stmt = select(cls.model)
        for condition in filters:
            stmt = stmt.where(condition)
        stmt = (
            stmt.order_by(cls.model.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        result = list((await session.execute(stmt)).scalars().all())
        return result, total

    @classmethod
    async def approve(
        cls,
        session: AsyncSession,
        lead_id: UUID,
        *,
        admin_id: UUID,
        approved_at: datetime,
    ) -> CooperationLead | None:
        """Mark a lead as approved without committing (caller owns txn)."""
        lead = await cls.get_by_id(session, lead_id)
        if lead is None:
            return None
        lead.status = CooperationLeadStatus.APPROVED.value
        lead.approved_at = approved_at
        lead.cancelled_at = None
        lead.reviewed_by_admin_id = admin_id
        session.add(lead)
        await session.flush()
        await session.refresh(lead)
        return lead

    @classmethod
    async def cancel(
        cls,
        session: AsyncSession,
        lead_id: UUID,
        *,
        admin_id: UUID,
        cancelled_at: datetime,
    ) -> CooperationLead | None:
        """Mark a lead as cancelled."""
        lead = await cls.get_by_id(session, lead_id)
        if lead is None:
            return None
        lead.status = CooperationLeadStatus.CANCELLED.value
        lead.cancelled_at = cancelled_at
        lead.reviewed_by_admin_id = admin_id
        session.add(lead)
        await session.flush()
        await session.refresh(lead)
        await session.commit()
        return lead
