import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.utils.short_id import generate_tid


class Supplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "suppliers"

    domain: Mapped[str | None] = mapped_column(unique=True)
    company_name: Mapped[str] = mapped_column(nullable=False)

    main_email: Mapped[str] = mapped_column(nullable=False)
    extra_emails: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    from_source: Mapped[str | None] = mapped_column()

    added_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    added_by_user: Mapped["User | None"] = relationship(  # noqa: F821 # type: ignore
        back_populates="added_suppliers"
    )

    request_suppliers: Mapped[list["RequestSupplier"]] = relationship(
        back_populates="supplier"
    )


class RequestSupplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "request_suppliers"

    request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requests.id", ondelete="CASCADE"),
        nullable=False,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("suppliers.id"), nullable=False
    )
    tracking_id: Mapped[str] = mapped_column(
        String(16), default=generate_tid, unique=True, nullable=False
    )

    sent_to_email: Mapped[str | None] = mapped_column()
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    body_text: Mapped[str | None] = mapped_column(Text)
    sent_status: Mapped[str] = mapped_column(nullable=False)  # aka Enum

    is_enabled: Mapped[bool] = mapped_column(default=True)

    smtp_message_id: Mapped[str | None] = mapped_column()

    request: Mapped["Request"] = relationship(  # noqa: F821 # type: ignore
        back_populates="request_suppliers",
    )
    supplier: Mapped[Supplier] = relationship(
        back_populates="request_suppliers",
    )
    email_messages: Mapped[list["EmailMessage"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="request_supplier",
        cascade="all, delete-orphan",
        uselist=True,
        passive_deletes=True,
        order_by="EmailMessage.received_at",
    )
