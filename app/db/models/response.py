import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin


class EmailMessage(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "email_messages"

    request_supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("request_suppliers.id", ondelete="CASCADE"),
        nullable=False,
    )

    direction: Mapped[str] = mapped_column(nullable=False, default="incoming")
    message_id: Mapped[str | None] = mapped_column()
    in_reply_to: Mapped[str | None] = mapped_column()

    imap_id: Mapped[str | None] = mapped_column()
    subject: Mapped[str | None] = mapped_column()
    raw_body: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list | None] = mapped_column(JSON)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    received_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    request_supplier: Mapped["RequestSupplier"] = relationship(  # noqa: F821 # type: ignore
        back_populates="email_messages",
    )
    analysis: Mapped["ResponseAnalysis | None"] = relationship(
        back_populates="response",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class ResponseAnalysis(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "response_analyses"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_messages.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    llm_model: Mapped[str] = mapped_column(nullable=False)

    offered_price_per_unit: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2)
    )
    offered_currency: Mapped[str | None] = mapped_column()
    offered_quantity: Mapped[int | None] = mapped_column(Integer)
    offered_delivery_days: Mapped[int | None] = mapped_column(Integer)
    quality_description: Mapped[str | None] = mapped_column(Text)

    meets_price: Mapped[bool | None] = mapped_column(Boolean)
    meets_quantity: Mapped[bool | None] = mapped_column(Boolean)
    meets_deadline: Mapped[bool | None] = mapped_column(Boolean)
    meets_quality: Mapped[bool | None] = mapped_column(Boolean)

    match_score: Mapped[int | None] = mapped_column(Integer)

    summary: Mapped[str | None] = mapped_column(Text)

    raw_llm_response: Mapped[dict | None] = mapped_column(JSON)

    response: Mapped["EmailMessage"] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
        single_parent=True,
    )
