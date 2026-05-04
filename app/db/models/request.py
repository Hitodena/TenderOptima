from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin


class SearchRequest(IDMixin, TimestampMixin, Base):
    __tablename__ = "searchRequests"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    order_number: Mapped[str] = mapped_column(unique=True, nullable=False)
    product_details: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, index=True)
    deadline: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    budget: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    quantity: Mapped[Optional[int]] = mapped_column(nullable=True)
    category: Mapped[Optional[str]] = mapped_column(nullable=True, index=True)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="search_requests"
    )
    request_suppliers: Mapped[list["RequestSupplier"]] = relationship()
    supplier_responses: Mapped[list["SupplierResponse"]] = relationship(
        "SupplierResponse", back_populates="request"
    )
    email_requests: Mapped[list["EmailRequest"]] = relationship(
        "EmailRequest", back_populates="request"
    )
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(
        "AnalysisResult", back_populates="request"
    )
    winner_selections: Mapped[list["WinnerSelection"]] = relationship(
        "WinnerSelection", back_populates="request"
    )




class RequestSupplier(IDMixin, TimestampMixin, Base):
    __tablename__ = "requestSuppliers"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("searchRequests.id"), nullable=False
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Unique constraint
    __table_args__ = (UniqueConstraint("request_id", "supplier_id"),)

    # Relationships
    request: Mapped["SearchRequest"] = relationship(
        "SearchRequest", back_populates="request_suppliers"
    )
    supplier: Mapped["Supplier"] = relationship(
        "Supplier", back_populates="request_suppliers"
    )
    supplier_responses: Mapped[list["SupplierResponse"]] = relationship(
        "SupplierResponse", back_populates="request_supplier"
    )
