from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin


class Supplier(IDMixin, TimestampMixin, Base):
    __tablename__ = "suppliers"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    search_query: Mapped[Optional[str]] = mapped_column(
        String(1000), nullable=True
    )
    found_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_approved: Mapped[bool] = mapped_column(nullable=False, index=True)
    moderation_status: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )
    moderation_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    priority_score: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False
    )

    # Relationships
    request_suppliers: Mapped[list["RequestSupplier"]] = relationship(
        "RequestSupplier", back_populates="supplier"
    )
    supplier_responses: Mapped[list["SupplierResponse"]] = relationship(
        "SupplierResponse", back_populates="supplier"
    )
    winner_selections: Mapped[list["WinnerSelection"]] = relationship(
        "WinnerSelection", back_populates="supplier"
    )


class ExcludedDomain(IDMixin, TimestampMixin, Base):
    __tablename__ = "excludedDomains"

    domain: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)


class WinnerSelection(IDMixin, TimestampMixin, Base):
    __tablename__ = "winnerSelections"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("searchRequests.id"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    selection_criteria: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )
    selected_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    # Relationships
    request: Mapped["SearchRequest"] = relationship(
        "SearchRequest", back_populates="winner_selections"
    )
    supplier: Mapped["Supplier"] = relationship(
        "Supplier", back_populates="winner_selections"
    )
    selected_by_user: Mapped["User"] = relationship(
        "User", back_populates="winner_selections", foreign_keys=[selected_by]
    )
