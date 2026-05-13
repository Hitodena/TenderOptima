import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin


class Supplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "suppliers"

    domain: Mapped[str] = mapped_column(unique=True, nullable=False)
    company_name: Mapped[str] = mapped_column(nullable=False)

    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    from_source: Mapped[str | None] = mapped_column()

    request_suppliers: Mapped[list["RequestSupplier"]] = relationship(
        back_populates="supplier"
    )


class RequestSupplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "request_suppliers"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("requests.id"), nullable=False
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False
    )

    sent_to_email: Mapped[str | None] = mapped_column()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    body_text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(nullable=False)  # aka Enum

    smtp_message_id: Mapped[str | None] = mapped_column()

    request: Mapped["Request"] = relationship(  # noqa: F821 # type: ignore
        back_populates="request_suppliers"
    )
    supplier: Mapped[Supplier] = relationship(
        back_populates="request_suppliers"
    )
    response: Mapped["SupplierResponse | None"] = relationship(  # noqa: F821 # type: ignore
        back_populates="request_supplier", uselist=False
    )
