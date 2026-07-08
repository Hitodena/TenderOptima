import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


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
    from_email: Mapped[str | None] = mapped_column(String(255))
    to_email: Mapped[str | None] = mapped_column(String(255))
    mailbox_email: Mapped[str | None] = mapped_column(String(255))
    matched_by: Mapped[str | None] = mapped_column(String(32))
    match_confidence: Mapped[str | None] = mapped_column(String(16))
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
    """LLM output for supplier email vs user-defined requirements."""

    __tablename__ = "response_analyses"

    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_messages.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    llm_model: Mapped[str] = mapped_column(nullable=False, default="")
    raw_llm_response: Mapped[dict | None] = mapped_column(JSON)
    previous_parameters: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(nullable=False, default="active")

    response: Mapped["EmailMessage"] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        passive_deletes=True,
        single_parent=True,
    )
