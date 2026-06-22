"""Monthly subscription usage counters derived from existing records."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from backend.db.models import (
    Request,
    RequestSupplier,
    SearchHistory,
    TZAnalysis,
    TZAnalysisSupplier,
)
from backend.enums import (
    RequestStatus,
    RequestSupplierStatus,
    TZAnalysisRunStatus,
    TZAnalysisSupplierStatus,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


def month_start_utc() -> datetime:
    """First instant of the current UTC calendar month."""
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@dataclass(frozen=True)
class SubscriptionUsage:
    searches_used: int
    emails_sent: int
    kp_processed: int


class SubscriptionUsageDAO:
    """Read monthly usage for subscription enforcement and profile display."""

    @staticmethod
    async def get_for_user(
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        month_start: datetime | None = None,
    ) -> SubscriptionUsage:
        start = month_start or month_start_utc()
        searches = await SubscriptionUsageDAO._count_searches(
            session, user_id, start
        )
        emails = await SubscriptionUsageDAO._count_emails_sent(
            session, user_id, start
        )
        kp = await SubscriptionUsageDAO._count_kp_processed(
            session, user_id, start
        )
        return SubscriptionUsage(
            searches_used=searches,
            emails_sent=emails,
            kp_processed=kp,
        )

    @staticmethod
    async def _count_searches(
        session: AsyncSession,
        user_id: uuid.UUID,
        month_start: datetime,
    ) -> int:
        history_stmt = select(func.count()).where(
            SearchHistory.user_id == user_id,
            SearchHistory.created_at >= month_start,
        )
        history_count = (await session.execute(history_stmt)).scalar_one()

        in_flight_stmt = select(func.count()).where(
            Request.user_id == user_id,
            Request.status == RequestStatus.SEARCHING.value,
        )
        in_flight = (await session.execute(in_flight_stmt)).scalar_one()
        return history_count + in_flight

    @staticmethod
    async def _count_emails_sent(
        session: AsyncSession,
        user_id: uuid.UUID,
        month_start: datetime,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(RequestSupplier)
            .join(Request, RequestSupplier.request_id == Request.id)
            .where(
                Request.user_id == user_id,
                RequestSupplier.sent_status
                == RequestSupplierStatus.SENT.value,
                RequestSupplier.sent_at.is_not(None),
                RequestSupplier.sent_at >= month_start,
            )
        )
        return (await session.execute(stmt)).scalar_one()

    @staticmethod
    async def _count_kp_processed(
        session: AsyncSession,
        user_id: uuid.UUID,
        month_start: datetime,
    ) -> int:
        supplier_statuses = (
            TZAnalysisSupplierStatus.PROCESSING.value,
            TZAnalysisSupplierStatus.COMPLETED.value,
        )
        supplier_stmt = (
            select(func.count())
            .select_from(TZAnalysisSupplier)
            .join(
                TZAnalysis,
                TZAnalysisSupplier.analysis_id == TZAnalysis.id,
            )
            .where(
                TZAnalysis.user_id == user_id,
                TZAnalysisSupplier.status.in_(supplier_statuses),
                TZAnalysisSupplier.updated_at >= month_start,
            )
        )
        supplier_count = (await session.execute(supplier_stmt)).scalar_one()

        has_suppliers = (
            select(TZAnalysisSupplier.id)
            .where(TZAnalysisSupplier.analysis_id == TZAnalysis.id)
            .correlate(TZAnalysis)
            .exists()
        )
        legacy_processing_stmt = select(TZAnalysis.kp_filenames).where(
            TZAnalysis.user_id == user_id,
            TZAnalysis.status == TZAnalysisRunStatus.PROCESSING.value,
            TZAnalysis.updated_at >= month_start,
            ~has_suppliers,
        )
        legacy_completed_stmt = select(
            TZAnalysis.kp_filenames,
            TZAnalysis.items,
        ).where(
            TZAnalysis.user_id == user_id,
            TZAnalysis.status == TZAnalysisRunStatus.ACTIVE.value,
            TZAnalysis.updated_at >= month_start,
            ~has_suppliers,
        )
        processing_rows = (
            (await session.execute(legacy_processing_stmt)).scalars().all()
        )
        completed_rows = (await session.execute(legacy_completed_stmt)).all()
        legacy_count = sum(len(names or []) for names in processing_rows)
        for names, items in completed_rows:
            if items and len(items) > 0:
                legacy_count += len(names or [])
        return supplier_count + legacy_count
