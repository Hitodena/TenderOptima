"""DAO helpers for cooperation invitation leads."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, delete, func, or_, select, update
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
        """Load a non-deleted lead by email."""
        stmt = select(cls.model).where(
            cls.model.email == email,
            cls.model.deleted_at.is_(None),
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

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
            cls.model.deleted_at.is_(None),
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
        include_deleted: bool = False,
    ) -> tuple[list[CooperationLead], int]:
        """Return a page of leads newest-first, with total row count."""
        filters = []
        if not include_deleted:
            filters.append(cls.model.deleted_at.is_(None))
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
    async def soft_delete_due(
        cls,
        session: AsyncSession,
        *,
        now: datetime,
        approved_before: datetime,
        cancelled_before: datetime,
    ) -> int:
        """Mark moderated leads as soft-deleted once retention expires."""
        stmt = (
            update(cls.model)
            .where(
                cls.model.deleted_at.is_(None),
                or_(
                    and_(
                        cls.model.status
                        == CooperationLeadStatus.APPROVED.value,
                        cls.model.approved_at.is_not(None),
                        cls.model.approved_at <= approved_before,
                    ),
                    and_(
                        cls.model.status
                        == CooperationLeadStatus.CANCELLED.value,
                        cls.model.cancelled_at.is_not(None),
                        cls.model.cancelled_at <= cancelled_before,
                    ),
                ),
            )
            .values(deleted_at=now)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount or 0

    @classmethod
    async def hard_delete_soft_deleted(
        cls,
        session: AsyncSession,
        *,
        deleted_before: datetime,
    ) -> int:
        """Permanently remove soft-deleted leads past the purge threshold."""
        stmt = delete(cls.model).where(
            cls.model.deleted_at.is_not(None),
            cls.model.deleted_at <= deleted_before,
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount or 0

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
        if lead is None or lead.deleted_at is not None:
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
        if lead is None or lead.deleted_at is not None:
            return None
        lead.status = CooperationLeadStatus.CANCELLED.value
        lead.cancelled_at = cancelled_at
        lead.reviewed_by_admin_id = admin_id
        session.add(lead)
        await session.flush()
        await session.refresh(lead)
        await session.commit()
        return lead
