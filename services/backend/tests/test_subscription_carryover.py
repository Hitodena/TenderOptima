"""Unit tests for subscription plan-change limit carryover."""

from backend.utils.subscription_carryover import (
    carry_quota,
    limits_after_plan_change,
)
from backend.utils.subscription_usage import SubscriptionUsage


def test_carry_quota_upgrade_with_leftover() -> None:
    # Starter 50 / used 10 → Basic 100 ⇒ stored 150 (140 remaining)
    assert carry_quota(old_limit=50, used=10, new_catalog=100) == 150


def test_carry_quota_downgrade_keeps_leftover() -> None:
    # Basic 100 / used 10 → Starter 50 ⇒ remaining 140, stored 150
    assert carry_quota(old_limit=100, used=10, new_catalog=50) == 150


def test_carry_quota_fully_used() -> None:
    assert carry_quota(old_limit=50, used=50, new_catalog=100) == 150


def test_carry_quota_over_limit_still_adds_used() -> None:
    assert carry_quota(old_limit=50, used=60, new_catalog=100) == 160


def test_carry_quota_old_unlimited() -> None:
    assert carry_quota(old_limit=None, used=10, new_catalog=100) == 100


def test_carry_quota_new_unlimited() -> None:
    assert carry_quota(old_limit=50, used=10, new_catalog=None) is None


def test_limits_after_plan_change_bundle() -> None:
    usage = SubscriptionUsage(
        searches_used=10,
        emails_sent=100,
        kp_processed=2,
        pages_analyzed=50,
    )
    result = limits_after_plan_change(
        old_searches=50,
        old_emails=1000,
        old_kp=7,
        old_pages=500,
        usage=usage,
        new_searches=100,
        new_emails=2000,
        new_kp=20,
        new_pages=1500,
    )
    assert result.max_searches_per_month == 150
    assert result.max_emails_per_month == 3000
    assert result.max_kp_processed_per_month == 27
    assert result.max_pages_analyzed_per_month == 2000


def test_merge_carryover_keeps_custom_and_fills_missing() -> None:
    from backend.utils.subscription_carryover import (
        CarriedLimits,
        merge_carryover_into_payload,
    )

    carried = CarriedLimits(
        max_searches_per_month=150,
        max_emails_per_month=3000,
        max_kp_processed_per_month=27,
        max_pages_analyzed_per_month=2000,
    )
    payload = {
        "max_searches_per_month": 999,
        "max_emails_per_month": 2000,  # catalog for basic
        # kp omitted → filled from carryover
        "max_pages_analyzed_per_month": 2000,  # already previewed
    }
    merge_carryover_into_payload(
        payload,
        carried=carried,
        plan="basic",
        geo_code="BY",
    )
    assert payload["max_searches_per_month"] == 999
    assert payload["max_emails_per_month"] == 3000
    assert payload["max_kp_processed_per_month"] == 27
    assert payload["max_pages_analyzed_per_month"] == 2000
