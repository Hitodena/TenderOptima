import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class SubscriptionBillingProfile(IDMixinUUID, TimestampMixin, Base):
    """Payer requisites for subscription billing documents."""

    __tablename__ = "subscription_billing_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    country: Mapped[str | None] = mapped_column(String(64))
    organization_form: Mapped[str | None] = mapped_column(String(64))
    inn: Mapped[str | None] = mapped_column(String(32))
    organization_name: Mapped[str | None] = mapped_column(String(255))
    kpp: Mapped[str | None] = mapped_column(String(32))
    ogrn: Mapped[str | None] = mapped_column(String(32))
    legal_address: Mapped[str | None] = mapped_column(Text)
    postal_address: Mapped[str | None] = mapped_column(Text)
    director_name: Mapped[str | None] = mapped_column(String(255))
    bik: Mapped[str | None] = mapped_column(String(16))
    bank_name: Mapped[str | None] = mapped_column(String(255))
    settlement_account: Mapped[str | None] = mapped_column(String(32))
    correspondent_account: Mapped[str | None] = mapped_column(String(32))
    contact_person: Mapped[str | None] = mapped_column(String(255))
    contact_full_name: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(64))

    user: Mapped["User"] = relationship(back_populates="billing_profile")  # type: ignore # noqa: F821


class SubscriptionBillingDocument(IDMixinUUID, TimestampMixin, Base):
    """Generated invoice/act DOCX for a subscription billing period."""

    __tablename__ = "subscription_billing_documents"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "receipt_id",
            name="uq_billing_documents_user_receipt",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False
    )
    receipt_id: Mapped[str] = mapped_column(String(64), nullable=False)
    plan: Mapped[str] = mapped_column(String(32), nullable=False)
    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    currency_code: Mapped[str] = mapped_column(String(8), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    line_items: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )
    invoice_docx_path: Mapped[str | None] = mapped_column(String(512))
    act_docx_path: Mapped[str | None] = mapped_column(String(512))
    email_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recipient_email: Mapped[str | None] = mapped_column(String(255))

    user: Mapped["User"] = relationship(back_populates="billing_documents")  # type: ignore # noqa: F821
    subscription: Mapped["Subscription"] = relationship()  # type: ignore # noqa: F821
