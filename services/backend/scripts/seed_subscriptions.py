"""Sync existing subscriptions with the current public tariff catalog."""

import asyncio
from decimal import Decimal
from typing import Any

from loguru import logger
from sqlalchemy import select

from backend.core.config import get_config
from backend.db.models import Subscription
from backend.enums import SubscriptionPlan
from backend.services.db_service import db_manager
from backend.utils.subscription_catalog import catalog_for_plan

_OLD_DEFAULTS: dict[str, dict[str, Any]] = {
    SubscriptionPlan.BASIC.value: {
        "max_searches_per_month": 50,
        "max_emails_per_month": 1000,
        "max_kp_processed_per_month": 7,
        "max_pages_analyzed_per_month": 140,
        "price_module_1_monthly": Decimal("160"),
        "price_module_2_monthly": Decimal("220"),
        "price_bundle_monthly": Decimal("340"),
    },
    SubscriptionPlan.ADVANCED.value: {
        "max_searches_per_month": 150,
        "max_emails_per_month": 2500,
        "max_kp_processed_per_month": 20,
        "max_pages_analyzed_per_month": 400,
        "price_module_1_monthly": Decimal("250"),
        "price_module_2_monthly": Decimal("480"),
        "price_bundle_monthly": Decimal("690"),
    },
}


def _same_decimal(left: Decimal | None, right: Decimal | None) -> bool:
    if left is None or right is None:
        return left is right
    return Decimal(left) == Decimal(right)


def _should_replace(
    current: Any,
    old_defaults: dict[str, Any],
    field: str,
) -> bool:
    if current is None:
        return True
    if field not in old_defaults:
        return False
    old_value = old_defaults[field]
    if isinstance(old_value, Decimal):
        return _same_decimal(current, old_value)
    return current == old_value


def _sync_subscription(subscription: Subscription) -> bool:
    source_plan = subscription.plan
    target_plan = (
        SubscriptionPlan.EXTENDED.value
        if source_plan == SubscriptionPlan.ADVANCED.value
        else source_plan
    )
    catalog = catalog_for_plan(target_plan, subscription.geo_code)
    old_defaults = _OLD_DEFAULTS.get(source_plan, {})
    changed = False

    if subscription.plan != target_plan:
        subscription.plan = target_plan
        changed = True

    for field in (
        "max_searches_per_month",
        "max_emails_per_month",
        "max_kp_processed_per_month",
        "max_pages_analyzed_per_month",
        "price_module_1_monthly",
        "price_module_2_monthly",
        "price_bundle_monthly",
    ):
        if not _should_replace(
            getattr(subscription, field), old_defaults, field
        ):
            continue
        value = getattr(catalog, field)
        if getattr(subscription, field) != value:
            setattr(subscription, field, value)
            changed = True

    return changed


async def seed_subscription_defaults() -> None:
    """Fill missing subscription defaults and migrate legacy plan names."""
    config = get_config()
    db_manager.init(config.build_db_url())

    try:
        async with db_manager.session() as session:
            result = await session.execute(select(Subscription))
            subscriptions = list(result.scalars().all())
            updated = 0
            for subscription in subscriptions:
                if _sync_subscription(subscription):
                    session.add(subscription)
                    updated += 1

            if updated:
                await session.commit()

            logger.info("Subscription defaults synced", updated=updated)
    finally:
        await db_manager.close()


def main() -> None:
    asyncio.run(seed_subscription_defaults())


if __name__ == "__main__":
    main()
