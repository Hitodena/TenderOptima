"""Monthly subscription usage counters derived from existing records."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    EmailMessage,
    Request,
    RequestSupplier,
    SearchHistory,
    Subscription,
    TZAnalysis,
    TZAnalysisSupplier,
)
from backend.enums import (
    EmailMessageDirection,
    RequestStatus,
    TZAnalysisRunStatus,
    TZAnalysisSupplierStatus,
)
from backend.utils.subscription_catalog import resolve_subscription_limits


def month_start_utc() -> datetime:
    """First instant of the current UTC calendar month."""
    now = datetime.now(UTC)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@dataclass(frozen=True)
class SubscriptionUsage:
    searches_used: int
    emails_sent: int
    kp_processed: int
    pages_analyzed: int


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
        pages = await SubscriptionUsageDAO._count_pages_analyzed(
            session, user_id, start
        )
        return SubscriptionUsage(
            searches_used=searches,
            emails_sent=emails,
            kp_processed=kp,
            pages_analyzed=pages,
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
            .select_from(EmailMessage)
            .join(
                RequestSupplier,
                EmailMessage.request_supplier_id == RequestSupplier.id,
            )
            .join(Request, RequestSupplier.request_id == Request.id)
            .where(
                Request.user_id == user_id,
                EmailMessage.direction == EmailMessageDirection.OUTGOING.value,
                EmailMessage.received_at.is_not(None),
                EmailMessage.received_at >= month_start,
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

    @staticmethod
    async def _count_pages_analyzed(
        session: AsyncSession,
        user_id: uuid.UUID,
        month_start: datetime,
    ) -> int:
        tz_pages_stmt = select(
            func.coalesce(func.sum(TZAnalysis.tz_pages_count), 0)
        ).where(
            TZAnalysis.user_id == user_id,
            TZAnalysis.updated_at >= month_start,
            TZAnalysis.tz_pages_count > 0,
        )
        tz_pages = int((await session.execute(tz_pages_stmt)).scalar_one())

        kp_pages_stmt = (
            select(
                func.coalesce(func.sum(TZAnalysisSupplier.kp_pages_count), 0)
            )
            .join(
                TZAnalysis,
                TZAnalysisSupplier.analysis_id == TZAnalysis.id,
            )
            .where(
                TZAnalysis.user_id == user_id,
                TZAnalysisSupplier.updated_at >= month_start,
                TZAnalysisSupplier.kp_pages_count > 0,
            )
        )
        kp_pages = int((await session.execute(kp_pages_stmt)).scalar_one())
        return tz_pages + kp_pages


def _subscription_is_usable(subscription: Subscription) -> bool:
    if not subscription.is_active:
        return False
    if subscription.expires_at is None:
        return True
    expires = subscription.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    return expires > datetime.now(UTC)


async def pages_analysis_remaining_for_user(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> int | None:
    """Document pages left for analysis this month, or None if unlimited."""
    stmt = select(Subscription).where(Subscription.user_id == user_id)
    subscription = (await session.execute(stmt)).scalar_one_or_none()
    if subscription is None or not _subscription_is_usable(subscription):
        return 0
    if not subscription.module_2_enabled:
        return 0
    _, _, _, max_pages = resolve_subscription_limits(
        plan=subscription.plan,
        geo_code=subscription.geo_code,
        max_searches_per_month=subscription.max_searches_per_month,
        max_emails_per_month=subscription.max_emails_per_month,
        max_kp_processed_per_month=subscription.max_kp_processed_per_month,
        max_pages_analyzed_per_month=subscription.max_pages_analyzed_per_month,
    )
    if max_pages is None:
        return None
    usage = await SubscriptionUsageDAO.get_for_user(session, user_id)
    return max(0, max_pages - usage.pages_analyzed)
