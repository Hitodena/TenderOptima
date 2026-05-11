import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin
from app.db.models.request import Request
from app.db.models.response import SupplierResponse


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    domain: Mapped[str] = mapped_column(unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(nullable=False)

    email: Mapped[str] = mapped_column(unique=True, nullable=False)

    tender_suppliers: Mapped[list["RequestSupplier"]] = relationship(
        back_populates="supplier"
    )


class RequestSupplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "request_suppliers"

    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenders.id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False
    )

    sent_to_email: Mapped[str | None] = mapped_column()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(nullable=False)  # aka Enum

    smtp_message_id: Mapped[str] = mapped_column(nullable=False)

    request: Mapped[Request] = relationship(back_populates="request_suppliers")
    supplier: Mapped[Supplier] = relationship(
        back_populates="request_suppliers"
    )
    response: Mapped["SupplierResponse | None"] = relationship(
        back_populates="request_supplier", uselist=False
    )
