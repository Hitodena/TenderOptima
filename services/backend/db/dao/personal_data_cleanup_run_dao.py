"""DAO for personal-data cleanup run audit rows."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.personal_data_cleanup import PersonalDataCleanupRun


class PersonalDataCleanupRunDAO(BaseDAO[PersonalDataCleanupRun]):
    model = PersonalDataCleanupRun

    @classmethod
    async def list_recent(
        cls,
        session: AsyncSession,
        *,
        limit: int = 50,
    ) -> list[PersonalDataCleanupRun]:
        """Return newest cleanup runs first."""
        stmt = (
            select(cls.model)
            .order_by(cls.model.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def mark_started(
        cls,
        session: AsyncSession,
        run_id: UUID,
        *,
        started_at: datetime,
        eligible_users: int,
    ) -> PersonalDataCleanupRun | None:
        row = await cls.get_by_id(session, run_id)
        if row is None:
            return None
        row.status = "running"
        row.started_at = started_at
        row.eligible_users = eligible_users
        session.add(row)
        await session.flush()
        await session.refresh(row)
        await session.commit()
        return row

    @classmethod
    async def mark_finished(
        cls,
        session: AsyncSession,
        run_id: UUID,
        *,
        finished_at: datetime,
        affected_records: int,
        error: str | None = None,
    ) -> PersonalDataCleanupRun | None:
        row = await cls.get_by_id(session, run_id)
        if row is None:
            return None
        row.finished_at = finished_at
        row.affected_records = affected_records
        if error:
            row.status = "failed"
            row.error = error
        else:
            row.status = "completed"
            row.error = None
        session.add(row)
        await session.flush()
        await session.refresh(row)
        await session.commit()
        return row
