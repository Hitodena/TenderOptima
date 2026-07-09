from backend.api.subscriptions.usage import SubscriptionUsage
from backend.db.models import Subscription
from backend.enums import SubscriptionPlan
from backend.utils.subscription_catalog import (
    resolve_subscription_limits,
    resolve_subscription_prices,
    resolve_tz_kp_upload_limit,
)

from .schemas import SubscriptionResponse


def subscription_to_response(
    row: Subscription | None,
    *,
    usage: SubscriptionUsage | None = None,
) -> SubscriptionResponse | None:
    if row is None:
        return None
    searches, emails, kp = resolve_subscription_limits(
        plan=row.plan,
        geo_code=row.geo_code,
        max_searches_per_month=row.max_searches_per_month,
        max_emails_per_month=row.max_emails_per_month,
        max_kp_processed_per_month=row.max_kp_processed_per_month,
    )
    p1, p2, bundle = resolve_subscription_prices(
        plan=row.plan,
        geo_code=row.geo_code,
        currency_code=row.currency_code,
        price_module_1_monthly=row.price_module_1_monthly,
        price_module_2_monthly=row.price_module_2_monthly,
        price_bundle_monthly=row.price_bundle_monthly,
    )
    return SubscriptionResponse(
        id=row.id,
        plan=SubscriptionPlan(row.plan),
        module_1_enabled=row.module_1_enabled,
        module_2_enabled=row.module_2_enabled,
        max_searches_per_month=searches,
        max_emails_per_month=emails,
        max_kp_processed_per_month=kp,
        max_tz_kp_upload_bytes=resolve_tz_kp_upload_limit(
            row.plan,
            row.geo_code,
        ),
        geo_code=row.geo_code,
        currency_code=row.currency_code,
        price_module_1_monthly=p1,
        price_module_2_monthly=p2,
        price_bundle_monthly=bundle,
        is_active=row.is_active,
        expires_at=row.expires_at,
        searches_used_this_month=(
            usage.searches_used if usage is not None else 0
        ),
        emails_sent_this_month=(usage.emails_sent if usage is not None else 0),
        kp_processed_this_month=(
            usage.kp_processed if usage is not None else 0
        ),
    )
