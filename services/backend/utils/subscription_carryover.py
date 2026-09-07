"""Carry unused monthly quotas when switching subscription plans."""

from __future__ import annotations

from dataclasses import dataclass

from backend.db.models import Subscription
from backend.utils.subscription_catalog import (
    catalog_for_plan,
    resolve_subscription_limits,
)
from backend.utils.subscription_usage import SubscriptionUsage


@dataclass(frozen=True)
class CarriedLimits:
    max_searches_per_month: int | None
    max_emails_per_month: int | None
    max_kp_processed_per_month: int | None
    max_pages_analyzed_per_month: int | None

    def as_dict(self) -> dict[str, int | None]:
        return {
            "max_searches_per_month": self.max_searches_per_month,
            "max_emails_per_month": self.max_emails_per_month,
            "max_kp_processed_per_month": self.max_kp_processed_per_month,
            "max_pages_analyzed_per_month": (
                self.max_pages_analyzed_per_month
            ),
        }


def carry_quota(
    *,
    old_limit: int | None,
    used: int,
    new_catalog: int | None,
) -> int | None:
    """Compute stored max after a plan change for one monthly quota.

    Usage counters are not reset on plan change, so unused leftover is
    stored as ``new_catalog + unused + used`` when the new plan is capped.
    Unlimited old plans do not contribute leftover.
    """
    if new_catalog is None:
        return None
    if old_limit is None:
        return new_catalog
    unused = max(0, old_limit - max(0, used))
    return new_catalog + unused + max(0, used)


def limits_after_plan_change(
    *,
    old_searches: int | None,
    old_emails: int | None,
    old_kp: int | None,
    old_pages: int | None,
    usage: SubscriptionUsage,
    new_searches: int | None,
    new_emails: int | None,
    new_kp: int | None,
    new_pages: int | None,
) -> CarriedLimits:
    """Apply carryover across all monthly subscription quotas."""
    return CarriedLimits(
        max_searches_per_month=carry_quota(
            old_limit=old_searches,
            used=usage.searches_used,
            new_catalog=new_searches,
        ),
        max_emails_per_month=carry_quota(
            old_limit=old_emails,
            used=usage.emails_sent,
            new_catalog=new_emails,
        ),
        max_kp_processed_per_month=carry_quota(
            old_limit=old_kp,
            used=usage.kp_processed,
            new_catalog=new_kp,
        ),
        max_pages_analyzed_per_month=carry_quota(
            old_limit=old_pages,
            used=usage.pages_analyzed,
            new_catalog=new_pages,
        ),
    )


def limits_after_plan_change_for_subscription(
    subscription: Subscription | None,
    *,
    new_plan: str,
    new_geo_code: str,
    usage: SubscriptionUsage,
) -> CarriedLimits:
    """Resolve effective old limits, new catalog, and apply carryover."""
    if subscription is None:
        old_searches = old_emails = old_kp = old_pages = None
    else:
        old_searches, old_emails, old_kp, old_pages = (
            resolve_subscription_limits(
                plan=subscription.plan,
                geo_code=subscription.geo_code,
                max_searches_per_month=subscription.max_searches_per_month,
                max_emails_per_month=subscription.max_emails_per_month,
                max_kp_processed_per_month=(
                    subscription.max_kp_processed_per_month
                ),
                max_pages_analyzed_per_month=(
                    subscription.max_pages_analyzed_per_month
                ),
            )
        )

    catalog = catalog_for_plan(new_plan, new_geo_code)
    # Resolve through the same helper so TEST email floor applies.
    new_searches, new_emails, new_kp, new_pages = resolve_subscription_limits(
        plan=new_plan,
        geo_code=new_geo_code,
        max_searches_per_month=catalog.max_searches_per_month,
        max_emails_per_month=catalog.max_emails_per_month,
        max_kp_processed_per_month=catalog.max_kp_processed_per_month,
        max_pages_analyzed_per_month=catalog.max_pages_analyzed_per_month,
    )
    return limits_after_plan_change(
        old_searches=old_searches,
        old_emails=old_emails,
        old_kp=old_kp,
        old_pages=old_pages,
        usage=usage,
        new_searches=new_searches,
        new_emails=new_emails,
        new_kp=new_kp,
        new_pages=new_pages,
    )


def payload_limits_match_catalog(
    *,
    plan: str,
    geo_code: str,
    max_searches_per_month: int | None,
    max_emails_per_month: int | None,
    max_kp_processed_per_month: int | None,
    max_pages_analyzed_per_month: int | None,
    searches_provided: bool,
    emails_provided: bool,
    kp_provided: bool,
    pages_provided: bool,
) -> bool:
    """True when admin sent no limit overrides, or values equal new catalog."""
    catalog_by_key = _catalog_limits_by_key(plan, geo_code)

    def matches(
        provided: bool,
        value: int | None,
        expected: int | None,
    ) -> bool:
        if not provided:
            return True
        return value == expected

    return (
        matches(
            searches_provided,
            max_searches_per_month,
            catalog_by_key["max_searches_per_month"],
        )
        and matches(
            emails_provided,
            max_emails_per_month,
            catalog_by_key["max_emails_per_month"],
        )
        and matches(
            kp_provided,
            max_kp_processed_per_month,
            catalog_by_key["max_kp_processed_per_month"],
        )
        and matches(
            pages_provided,
            max_pages_analyzed_per_month,
            catalog_by_key["max_pages_analyzed_per_month"],
        )
    )


def _catalog_limits_by_key(
    plan: str,
    geo_code: str,
) -> dict[str, int | None]:
    catalog = catalog_for_plan(plan, geo_code)
    searches, emails, kp, pages = resolve_subscription_limits(
        plan=plan,
        geo_code=geo_code,
        max_searches_per_month=catalog.max_searches_per_month,
        max_emails_per_month=catalog.max_emails_per_month,
        max_kp_processed_per_month=catalog.max_kp_processed_per_month,
        max_pages_analyzed_per_month=catalog.max_pages_analyzed_per_month,
    )
    return {
        "max_searches_per_month": searches,
        "max_emails_per_month": emails,
        "max_kp_processed_per_month": kp,
        "max_pages_analyzed_per_month": pages,
    }


def merge_carryover_into_payload(
    payload: dict,
    *,
    carried: CarriedLimits,
    plan: str,
    geo_code: str,
) -> None:
    """Fill missing/catalog limit fields with carryover; keep true customs."""
    catalog_by_key = _catalog_limits_by_key(plan, geo_code)
    for key, carried_value in carried.as_dict().items():
        if key not in payload:
            payload[key] = carried_value
        elif payload.get(key) == catalog_by_key[key]:
            payload[key] = carried_value
