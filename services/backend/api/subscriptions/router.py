"""Authenticated subscription endpoints (plan change)."""

from datetime import UTC, datetime
from typing import Annotated

from backend.api.deps import get_current_user, get_session
from backend.api.subscriptions.helpers import subscription_to_response
from backend.api.subscriptions.schemas import (
    ChangePlanRequest,
    SubscriptionResponse,
)
from backend.db.dao import SubscriptionDAO
from backend.db.models import User
from backend.enums import SubscriptionPlan
from backend.utils.subscription_catalog import catalog_for_plan
from backend.utils.subscription_usage import SubscriptionUsageDAO
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


def _modules_for_tab(
    plan: SubscriptionPlan,
    module_tab: str,
) -> tuple[bool, bool]:
    """Return (module_1_enabled, module_2_enabled) for a plan + tab."""
    if plan == SubscriptionPlan.MINI:
        if module_tab != "module1":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Тариф Мини доступен только для Модуля 1",
            )
        return True, False
    if module_tab == "module1":
        return True, False
    if module_tab == "module2":
        return False, True
    return True, True


@router.post(
    "/me/change-plan",
    response_model=SubscriptionResponse,
    summary="Switch the current user's subscription plan",
)
async def change_my_plan(
    body: ChangePlanRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubscriptionResponse:
    """Replace the current plan; new period starts now (starts_at = UTC now)."""
    plan = body.plan
    module_1, module_2 = _modules_for_tab(plan, body.module_tab)

    existing = await SubscriptionDAO.get_by_user_id(session, current_user.id)
    geo_code = existing.geo_code if existing else "BY"
    currency_code = existing.currency_code if existing else "BYN"
    is_active = existing.is_active if existing else True
    expires_at = existing.expires_at if existing else None

    catalog = catalog_for_plan(plan.value, geo_code)
    now = datetime.now(UTC)

    updated = await SubscriptionDAO.upsert_for_user(
        session,
        current_user.id,
        plan=plan.value,
        module_1_enabled=module_1,
        module_2_enabled=module_2,
        max_searches_per_month=catalog.max_searches_per_month,
        max_emails_per_month=catalog.max_emails_per_month,
        max_kp_processed_per_month=catalog.max_kp_processed_per_month,
        max_pages_analyzed_per_month=catalog.max_pages_analyzed_per_month,
        geo_code=geo_code,
        currency_code=currency_code,
        price_module_1_monthly=catalog.price_module_1_monthly,
        price_module_2_monthly=catalog.price_module_2_monthly,
        price_bundle_monthly=catalog.price_bundle_monthly,
        is_active=is_active,
        starts_at=now,
        expires_at=expires_at,
    )

    usage = await SubscriptionUsageDAO.get_for_user(session, current_user.id)
    response = subscription_to_response(updated, usage=usage)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load updated subscription",
        )
    return response
