"""Build subscription billing line items and totals."""

from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal

from backend.db.models import Subscription
from backend.enums import SubscriptionPlan
from backend.utils.subscription_catalog import resolve_subscription_prices

PLAN_TITLES = {
    SubscriptionPlan.TEST.value: "Тестовый",
    SubscriptionPlan.BASIC.value: "Базовый",
    SubscriptionPlan.ADVANCED.value: "Расширенный",
    SubscriptionPlan.CORPORATE.value: "Корпоративный",
}


@dataclass(frozen=True)
class BillingLineItem:
    name: str
    amount: Decimal

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "amount": str(self.amount),
        }


@dataclass(frozen=True)
class BillingQuote:
    plan: str
    plan_title: str
    currency_code: str
    line_items: list[BillingLineItem]
    total_amount: Decimal
    period_start: datetime
    period_end: datetime
    receipt_id: str

    def line_items_dict(self) -> list[dict]:
        return [item.as_dict() for item in self.line_items]


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, tzinfo=UTC)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=UTC)
    else:
        end = datetime(year, month + 1, 1, tzinfo=UTC)
    return start, end


def build_receipt_id(plan: str, year: int, month: int) -> str:
    return f"{year:04d}{month:02d}-{plan}"


def build_subscription_quote(
    subscription: Subscription,
    *,
    year: int | None = None,
    month: int | None = None,
) -> BillingQuote:
    now = datetime.now(UTC)
    period_year = year or now.year
    period_month = month or now.month
    period_start, period_end = _month_bounds(period_year, period_month)

    p1, p2, bundle = resolve_subscription_prices(
        plan=subscription.plan,
        geo_code=subscription.geo_code,
        currency_code=subscription.currency_code,
        price_module_1_monthly=subscription.price_module_1_monthly,
        price_module_2_monthly=subscription.price_module_2_monthly,
        price_bundle_monthly=subscription.price_bundle_monthly,
    )

    plan_title = PLAN_TITLES.get(subscription.plan, subscription.plan)
    line_items: list[BillingLineItem] = []

    bundle_active = (
        subscription.module_1_enabled
        and subscription.module_2_enabled
        and bundle is not None
    )

    if bundle_active:
        total = Decimal(bundle)
        line_items.append(
            BillingLineItem(
                name=(
                    f"Подписка {plan_title} — Модуль 1 и Модуль 2 "
                    "(поиск, рассылка, inbox; анализ ТЗ/КП)"
                ),
                amount=total,
            )
        )
    else:
        if subscription.module_1_enabled and p1 is not None:
            line_items.append(
                BillingLineItem(
                    name=(
                        f"Подписка {plan_title} — Модуль 1 "
                        "(поиск, рассылка, inbox)"
                    ),
                    amount=Decimal(p1),
                )
            )
        if subscription.module_2_enabled and p2 is not None:
            line_items.append(
                BillingLineItem(
                    name=(f"Подписка {plan_title} — Модуль 2 (анализ ТЗ/КП)"),
                    amount=Decimal(p2),
                )
            )
        total = sum((item.amount for item in line_items), Decimal("0"))

    if not line_items:
        raise ValueError("Subscription has no billable modules with prices")

    if total <= 0 and subscription.plan != SubscriptionPlan.TEST.value:
        raise ValueError("Subscription total amount must be greater than zero")

    return BillingQuote(
        plan=subscription.plan,
        plan_title=plan_title,
        currency_code=subscription.currency_code,
        line_items=line_items,
        total_amount=total,
        period_start=period_start,
        period_end=period_end,
        receipt_id=build_receipt_id(
            subscription.plan, period_year, period_month
        ),
    )
