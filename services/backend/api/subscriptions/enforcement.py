"""Subscription gate checks before module 1/2 actions."""

from datetime import UTC, datetime

from backend.core.config import Config
from backend.db.dao import SubscriptionDAO
from backend.db.models import Subscription, User
from backend.utils.subscription_catalog import (
    resolve_subscription_limits,
    resolve_tz_kp_upload_limit,
)
from backend.utils.subscription_usage import (
    SubscriptionUsageDAO,
    pages_analysis_remaining_for_user,
)
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession


class SubscriptionLimitExceeded(HTTPException):
    """Raised when a monthly quota or module flag blocks an action."""

    def __init__(
        self,
        *,
        resource: str,
        limit: int,
        used: int,
        requested: int = 1,
        message: str | None = None,
    ) -> None:
        detail: dict[str, object] = {
            "code": "subscription_limit",
            "resource": resource,
            "limit": limit,
            "used": used,
            "requested": requested,
        }
        if message:
            detail["message"] = message
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _subscription_is_usable(subscription: Subscription) -> bool:
    if not subscription.is_active:
        return False
    if subscription.expires_at is None:
        return True
    expires = subscription.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    return expires > datetime.now(UTC)


async def _get_subscription_or_raise(
    session: AsyncSession,
    user: User,
) -> Subscription:
    subscription = await SubscriptionDAO.get_by_user_id(session, user.id)
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "subscription_required",
                "message": "Subscription is not configured for this account",
            },
        )
    if not _subscription_is_usable(subscription):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "subscription_inactive",
                "message": "Subscription is inactive or expired",
            },
        )
    return subscription


def _resolved_limits(
    subscription: Subscription,
) -> tuple[int | None, int | None, int | None, int | None]:
    return resolve_subscription_limits(
        plan=subscription.plan,
        geo_code=subscription.geo_code,
        max_searches_per_month=subscription.max_searches_per_month,
        max_emails_per_month=subscription.max_emails_per_month,
        max_kp_processed_per_month=subscription.max_kp_processed_per_month,
        max_pages_analyzed_per_month=subscription.max_pages_analyzed_per_month,
    )


def _ensure_module_enabled(
    subscription: Subscription,
    *,
    module: int,
) -> None:
    enabled = (
        subscription.module_1_enabled
        if module == 1
        else subscription.module_2_enabled
    )
    if not enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "subscription_module_disabled",
                "module": module,
                "message": f"Module {module} is not enabled for this subscription",
            },
        )


def _ensure_quota(
    *,
    resource: str,
    limit: int | None,
    used: int,
    requested: int,
) -> None:
    if limit is None:
        return
    if used + requested > limit:
        raise SubscriptionLimitExceeded(
            resource=resource,
            limit=limit,
            used=used,
            requested=requested,
        )


async def ensure_module_1_access(
    session: AsyncSession,
    user: User,
) -> None:
    """Module 1: active subscription with module 1 enabled."""
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=1)


async def ensure_can_search(
    session: AsyncSession,
    user: User,
) -> None:
    """Module 1: allow queuing one more supplier search this month."""
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=1)
    max_searches, _, _, _ = _resolved_limits(subscription)
    usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    _ensure_quota(
        resource="searches",
        limit=max_searches,
        used=usage.searches_used,
        requested=1,
    )


async def ensure_can_send_emails(
    session: AsyncSession,
    user: User,
    *,
    pending_count: int,
) -> None:
    """Module 1: allow sending pending_count outbound emails this month."""
    if pending_count <= 0:
        return
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=1)
    _, max_emails, _, _ = _resolved_limits(subscription)
    usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    _ensure_quota(
        resource="emails",
        limit=max_emails,
        used=usage.emails_sent,
        requested=pending_count,
    )


async def outbound_email_remaining(
    session: AsyncSession,
    user: User,
) -> int | None:
    """Outbound emails left this month, or None if unlimited."""
    subscription = await SubscriptionDAO.get_by_user_id(session, user.id)
    if subscription is None or not _subscription_is_usable(subscription):
        return 0
    if not subscription.module_1_enabled:
        return 0
    _, max_emails, _, _ = _resolved_limits(subscription)
    if max_emails is None:
        return None
    usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    return max(0, max_emails - usage.emails_sent)


async def worker_can_send_emails(
    session: AsyncSession,
    user: User,
    *,
    count: int = 1,
) -> bool:
    """Non-HTTP quota check for Celery tasks."""
    if count <= 0:
        return True
    remaining = await outbound_email_remaining(session, user)
    if remaining is None:
        return True
    return count <= remaining


async def ensure_module_2_access(
    session: AsyncSession,
    user: User,
) -> None:
    """Module 2: active subscription with module 2 enabled."""
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=2)


async def ensure_module_2_work_allowed(
    session: AsyncSession,
    user: User,
) -> None:
    """Module 2: allow starting TZ analysis when page quota is not exhausted."""
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=2)
    _, _, _, max_pages = _resolved_limits(subscription)
    usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    _ensure_quota(
        resource="pages_analyzed",
        limit=max_pages,
        used=usage.pages_analyzed,
        requested=1,
    )


async def ensure_can_process_pages(
    session: AsyncSession,
    user: User,
    *,
    page_count: int,
) -> None:
    """Module 2: allow processing page_count document pages this month."""
    if page_count <= 0:
        return
    subscription = await _get_subscription_or_raise(session, user)
    _ensure_module_enabled(subscription, module=2)
    _, _, _, max_pages = _resolved_limits(subscription)
    usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    _ensure_quota(
        resource="pages_analyzed",
        limit=max_pages,
        used=usage.pages_analyzed,
        requested=page_count,
    )


async def ensure_can_process_kp(
    session: AsyncSession,
    user: User,
    *,
    kp_count: int,
) -> None:
    """Backward-compatible alias: treat each KP as one page minimum."""
    await ensure_can_process_pages(session, user, page_count=max(kp_count, 1))


async def pages_analysis_remaining(
    session: AsyncSession,
    user: User,
) -> int | None:
    """Document pages left for analysis this month, or None if unlimited."""
    return await pages_analysis_remaining_for_user(session, user.id)


def effective_tz_kp_upload_limit(
    subscription: Subscription,
    config: Config,
) -> int:
    """Effective TZ/KP upload size cap for a subscription."""
    plan_limit = resolve_tz_kp_upload_limit(
        subscription.plan,
        subscription.geo_code,
    )
    if plan_limit is None:
        return config.max_tz_upload_size
    return min(plan_limit, config.max_tz_upload_size)


async def tz_kp_upload_limit_for_user(
    session: AsyncSession,
    user: User,
    config: Config,
) -> int:
    """Resolve TZ/KP upload limit for the current user."""
    subscription = await _get_subscription_or_raise(session, user)
    return effective_tz_kp_upload_limit(subscription, config)
