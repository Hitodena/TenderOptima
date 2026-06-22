import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.enums import SubscriptionGeo, SubscriptionPlan


class Subscription(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )

    plan: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=SubscriptionPlan.BASIC.value,
    )

    module_1_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    module_2_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    max_searches_per_month: Mapped[int | None] = mapped_column(Integer)
    max_emails_per_month: Mapped[int | None] = mapped_column(Integer)
    max_kp_processed_per_month: Mapped[int | None] = mapped_column(Integer)

    geo_code: Mapped[str] = mapped_column(
        String(8), default=SubscriptionGeo.BY.value, nullable=False
    )
    currency_code: Mapped[str] = mapped_column(
        String(8), default="BYN", nullable=False
    )

    price_module_1_monthly: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2)
    )
    price_module_2_monthly: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2)
    )
    price_bundle_monthly: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2)
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    user: Mapped["User"] = relationship(back_populates="subscription")  # type: ignore # noqa: F821
