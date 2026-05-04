from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixin, TimestampMixin


class User(IDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(unique=True, nullable=False)
    password: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[Optional[str]] = mapped_column(nullable=True)
    role: Mapped[str] = mapped_column(nullable=False, default="user")
    subscription_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription", back_populates="user", foreign_keys=[subscription_id]
    )
    subscription_payments: Mapped[list["SubscriptionPayment"]] = relationship(
        "SubscriptionPayment", back_populates="user"
    )
    search_requests: Mapped[list["SearchRequest"]] = relationship(
        "SearchRequest", back_populates="user"
    )
    supplier_responses: Mapped[list["SupplierResponse"]] = relationship(
        "SupplierResponse", back_populates="user"
    )
    email_requests: Mapped[list["EmailRequest"]] = relationship(
        "EmailRequest", back_populates="user"
    )
    improvement_requests: Mapped[list["ImprovementRequest"]] = relationship(
        "ImprovementRequest", back_populates="user"
    )
    winner_selections: Mapped[list["WinnerSelection"]] = relationship(
        back_populates="selected_by_user",
        foreign_keys="WinnerSelection.selected_by",
    )


class Subscription(IDMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_type: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, index=True)
    start_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    auto_renew: Mapped[bool] = mapped_column(nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="subscription", foreign_keys=[user_id]
    )
    payments: Mapped[list["SubscriptionPayment"]] = relationship(  
        "SubscriptionPayment", back_populates="subscription"
    )


class SubscriptionPayment(IDMixin, TimestampMixin, Base):
    __tablename__ = "subscription_payments"

    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invoice_id: Mapped[str] = mapped_column(unique=True, nullable=False)
    payment_system: Mapped[str] = mapped_column(nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, index=True)
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    external_id: Mapped[Optional[str]] = mapped_column(nullable=True)
    additional_info: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )

    # Relationships
    subscription: Mapped["Subscription"] = relationship(
        "Subscription", back_populates="payments"
    )
    user: Mapped["User"] = relationship(
        "User", back_populates="subscription_payments"
    )
