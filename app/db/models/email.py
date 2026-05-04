from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin


class SupplierResponse(IDMixin, TimestampMixin, Base):
    __tablename__ = "supplierResponses"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("searchRequests.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("suppliers.id"), nullable=True
    )
    supplier_email: Mapped[str] = mapped_column(nullable=False, index=True)
    supplier_name: Mapped[Optional[str]] = mapped_column(nullable=True)
    subject: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[Optional[list[dict]]] = mapped_column(
        JSON, nullable=True
    )
    response_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    processing_status: Mapped[str] = mapped_column(nullable=False, index=True)
    processing_error: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )
    is_analyzed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, index=True
    )
    request_supplier_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("requestSuppliers.id"), nullable=True
    )
    is_replied_to: Mapped[bool] = mapped_column(Boolean, nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="supplier_responses"
    )
    request: Mapped["SearchRequest"] = relationship(
        "SearchRequest", back_populates="supplier_responses"
    )
    supplier: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", back_populates="supplier_responses"
    )
    request_supplier: Mapped[Optional["RequestSupplier"]] = relationship(
        "RequestSupplier", back_populates="supplier_responses"
    )


class EmailRequest(IDMixin, TimestampMixin, Base):
    __tablename__ = "emailRequests"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    request_id: Mapped[int] = mapped_column(
        ForeignKey("searchRequests.id"), nullable=False
    )
    supplier_email: Mapped[str] = mapped_column(nullable=False)
    subject: Mapped[str] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, index=True)

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="email_requests"
    )
    request: Mapped["SearchRequest"] = relationship(
        "SearchRequest", back_populates="email_requests"
    )
