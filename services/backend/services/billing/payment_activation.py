"""Apply successful online payment to a user subscription."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from dateutil.relativedelta import relativedelta
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao import SubscriptionDAO
from backend.db.models import Subscription


def compute_renewal_bounds(
    subscription: Subscription,
    *,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Return (starts_at, expires_at) after a successful one-month renewal."""
    moment = now or datetime.now(UTC)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)

    current_expires = subscription.expires_at
    if current_expires is not None and current_expires.tzinfo is None:
        current_expires = current_expires.replace(tzinfo=UTC)

    base = moment
    if current_expires is not None and current_expires > moment:
        base = current_expires

    starts_at = subscription.starts_at or moment
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)
    expires_at = base + relativedelta(months=1)
    return starts_at, expires_at


async def activate_subscription_after_payment(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    subscription: Subscription,
) -> Subscription:
    """Mark subscription active and extend expires_at by one month."""
    starts_at, expires_at = compute_renewal_bounds(subscription)
    updated = await SubscriptionDAO.upsert_for_user(
        session,
        user_id,
        is_active=True,
        starts_at=starts_at,
        expires_at=expires_at,
    )
    logger.info(
        "Subscription renewed after bePaid payment",
        user_id=str(user_id),
        expires_at=expires_at.isoformat(),
    )
    return updated
