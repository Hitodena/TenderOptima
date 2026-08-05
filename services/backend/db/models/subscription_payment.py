"""Online subscription payment attempts via bePaid."""

import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.enums import SubscriptionPaymentStatus


class SubscriptionPayment(IDMixinUUID, TimestampMixin, Base):
    """One bePaid checkout attempt for renewing a user subscription."""

    __tablename__ = "subscription_payments"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False
    )
    tracking_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    method: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency_code: Mapped[str] = mapped_column(String(8), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=SubscriptionPaymentStatus.PENDING.value,
    )
    receipt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    bepaid_token: Mapped[str | None] = mapped_column(String(128))
    bepaid_uid: Mapped[str | None] = mapped_column(String(64))
    redirect_url: Mapped[str | None] = mapped_column(String(1024))
    raw_notification: Mapped[dict | None] = mapped_column(JSON)

    user: Mapped["User"] = relationship()  # type: ignore # noqa: F821
    subscription: Mapped["Subscription"] = relationship()  # type: ignore # noqa: F821
