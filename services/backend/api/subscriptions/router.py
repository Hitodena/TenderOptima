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
from backend.utils.subscription_carryover import (
    limits_after_plan_change_for_subscription,
)
from backend.utils.subscription_catalog import catalog_for_plan
from backend.utils.subscription_usage import SubscriptionUsageDAO
from backend.utils.trial import TrialState, trial_state, trial_window
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
    """Replace the current plan; unused monthly quotas carry into new max_*."""
    plan = body.plan
    module_1, module_2 = _modules_for_tab(plan, body.module_tab)

    existing = await SubscriptionDAO.get_by_user_id(session, current_user.id)
    geo_code = existing.geo_code if existing else "BY"
    currency_code = existing.currency_code if existing else "BYN"
    is_active = existing.is_active if existing else True
    expires_at = existing.expires_at if existing else None

    catalog = catalog_for_plan(plan.value, geo_code)
    usage = await SubscriptionUsageDAO.get_for_user(session, current_user.id)
    carried = limits_after_plan_change_for_subscription(
        existing,
        new_plan=plan.value,
        new_geo_code=geo_code,
        usage=usage,
    )
    now = datetime.now(UTC)

    updated = await SubscriptionDAO.upsert_for_user(
        session,
        current_user.id,
        plan=plan.value,
        module_1_enabled=module_1,
        module_2_enabled=module_2,
        **carried.as_dict(),
        geo_code=geo_code,
        currency_code=currency_code,
        price_module_1_monthly=catalog.price_module_1_monthly,
        price_module_2_monthly=catalog.price_module_2_monthly,
        price_bundle_monthly=catalog.price_bundle_monthly,
        is_active=is_active,
        starts_at=now,
        expires_at=expires_at,
    )
    response = subscription_to_response(updated, usage=usage)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load updated subscription",
        )
    return response


@router.post(
    "/me/trial",
    response_model=SubscriptionResponse,
    summary="Start the 14-day trial of the test plan",
)
async def start_my_trial(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubscriptionResponse:
    """Open real mailing on the test plan for 14 days. Once per account."""
    subscription = await SubscriptionDAO.get_by_user_id(
        session, current_user.id
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription is not configured for this account",
        )
    if subscription.plan != SubscriptionPlan.TEST.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пробный период доступен только на тестовом тарифе",
        )
    if trial_state(subscription) == TrialState.NOT_STARTED:
        started_at, ends_at = trial_window()
        subscription = await SubscriptionDAO.update_fields(
            session,
            subscription.id,
            trial_started_at=started_at,
            trial_ends_at=ends_at,
        )
    elif trial_state(subscription) == TrialState.ENDED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Пробный период уже использован",
        )
    usage = await SubscriptionUsageDAO.get_for_user(session, current_user.id)
    response = subscription_to_response(subscription, usage=usage)
    if response is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load subscription",
        )
    return response
