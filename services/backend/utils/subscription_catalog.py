"""Default subscription limits and prices by plan tier."""

from dataclasses import dataclass
from decimal import Decimal

from backend.enums import SubscriptionGeo, SubscriptionPlan


@dataclass(frozen=True)
class PlanCatalogEntry:
    max_searches_per_month: int | None
    max_emails_per_month: int | None
    max_kp_processed_per_month: int | None
    max_pages_analyzed_per_month: int | None
    max_tz_kp_upload_bytes: int | None
    price_module_1_monthly: Decimal | None
    price_module_2_monthly: Decimal | None
    price_bundle_monthly: Decimal | None


_TEST_TZ_KP_UPLOAD_BYTES = 1 * 1024 * 1024

PLAN_CATALOG: dict[str, PlanCatalogEntry] = {
    SubscriptionPlan.TEST.value: PlanCatalogEntry(
        max_searches_per_month=5,
        max_emails_per_month=11,
        max_kp_processed_per_month=2,
        max_pages_analyzed_per_month=40,
        max_tz_kp_upload_bytes=_TEST_TZ_KP_UPLOAD_BYTES,
        price_module_1_monthly=None,
        price_module_2_monthly=None,
        price_bundle_monthly=None,
    ),
    SubscriptionPlan.BASIC.value: PlanCatalogEntry(
        max_searches_per_month=50,
        max_emails_per_month=1000,
        max_kp_processed_per_month=7,
        max_pages_analyzed_per_month=140,
        max_tz_kp_upload_bytes=None,
        price_module_1_monthly=Decimal("160"),
        price_module_2_monthly=Decimal("220"),
        price_bundle_monthly=Decimal("340"),
    ),
    SubscriptionPlan.ADVANCED.value: PlanCatalogEntry(
        max_searches_per_month=150,
        max_emails_per_month=2500,
        max_kp_processed_per_month=20,
        max_pages_analyzed_per_month=400,
        max_tz_kp_upload_bytes=None,
        price_module_1_monthly=Decimal("250"),
        price_module_2_monthly=Decimal("480"),
        price_bundle_monthly=Decimal("690"),
    ),
    SubscriptionPlan.CORPORATE.value: PlanCatalogEntry(
        max_searches_per_month=None,
        max_emails_per_month=None,
        max_kp_processed_per_month=None,
        max_pages_analyzed_per_month=None,
        max_tz_kp_upload_bytes=None,
        price_module_1_monthly=None,
        price_module_2_monthly=None,
        price_bundle_monthly=None,
    ),
}

GEO_CURRENCY_PRICES: dict[str, dict[str, PlanCatalogEntry]] = {
    SubscriptionGeo.US.value: {
        SubscriptionPlan.BASIC.value: PlanCatalogEntry(
            max_searches_per_month=50,
            max_emails_per_month=1000,
            max_kp_processed_per_month=7,
            max_pages_analyzed_per_month=140,
            max_tz_kp_upload_bytes=None,
            price_module_1_monthly=Decimal("53"),
            price_module_2_monthly=Decimal("73"),
            price_bundle_monthly=Decimal("113"),
        ),
        SubscriptionPlan.ADVANCED.value: PlanCatalogEntry(
            max_searches_per_month=150,
            max_emails_per_month=2500,
            max_kp_processed_per_month=20,
            max_pages_analyzed_per_month=400,
            max_tz_kp_upload_bytes=None,
            price_module_1_monthly=Decimal("83"),
            price_module_2_monthly=Decimal("160"),
            price_bundle_monthly=Decimal("230"),
        ),
    },
}


def catalog_for_plan(
    plan: str,
    geo_code: str = SubscriptionGeo.BY.value,
) -> PlanCatalogEntry:
    """Return catalog defaults for a plan, optionally overridden by geo."""
    geo_prices = GEO_CURRENCY_PRICES.get(geo_code, {})
    if plan in geo_prices:
        return geo_prices[plan]
    return PLAN_CATALOG.get(
        plan,
        PLAN_CATALOG[SubscriptionPlan.BASIC.value],
    )


def resolve_subscription_limits(
    *,
    plan: str,
    geo_code: str,
    max_searches_per_month: int | None,
    max_emails_per_month: int | None,
    max_kp_processed_per_month: int | None,
    max_pages_analyzed_per_month: int | None = None,
) -> tuple[int | None, int | None, int | None, int | None]:
    """Use stored overrides when set, otherwise catalog defaults."""
    catalog = catalog_for_plan(plan, geo_code)
    searches = (
        max_searches_per_month
        if max_searches_per_month is not None
        else catalog.max_searches_per_month
    )
    emails = (
        max_emails_per_month
        if max_emails_per_month is not None
        else catalog.max_emails_per_month
    )
    kp = (
        max_kp_processed_per_month
        if max_kp_processed_per_month is not None
        else catalog.max_kp_processed_per_month
    )
    pages = (
        max_pages_analyzed_per_month
        if max_pages_analyzed_per_month is not None
        else catalog.max_pages_analyzed_per_month
    )
    if plan == SubscriptionPlan.TEST.value and emails is not None:
        emails = max(emails, 11)
    return searches, emails, kp, pages


def resolve_tz_kp_upload_limit(plan: str, geo_code: str) -> int | None:
    """Per-plan TZ/KP upload cap; None means use platform default."""
    return catalog_for_plan(plan, geo_code).max_tz_kp_upload_bytes


def resolve_subscription_prices(
    *,
    plan: str,
    geo_code: str,
    currency_code: str,
    price_module_1_monthly: Decimal | None,
    price_module_2_monthly: Decimal | None,
    price_bundle_monthly: Decimal | None,
) -> tuple[Decimal | None, Decimal | None, Decimal | None]:
    """Use stored price overrides when set, otherwise catalog defaults."""
    catalog = catalog_for_plan(plan, geo_code)
    if currency_code == "USD" and geo_code == SubscriptionGeo.US.value:
        catalog = catalog_for_plan(plan, SubscriptionGeo.US.value)
    return (
        price_module_1_monthly
        if price_module_1_monthly is not None
        else catalog.price_module_1_monthly,
        price_module_2_monthly
        if price_module_2_monthly is not None
        else catalog.price_module_2_monthly,
        price_bundle_monthly
        if price_bundle_monthly is not None
        else catalog.price_bundle_monthly,
    )
