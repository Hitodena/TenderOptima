import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class TZCreationSession(IDMixinUUID, TimestampMixin, Base):
    """A Module 3 TZ creation wizard session (chat + draft outline)."""

    __tablename__ = "tz_creation_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    context: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    source_tz_filename: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    draft_hierarchy: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )
    fields: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    llm_model: Mapped[str] = mapped_column(
        String(128), nullable=False, default=""
    )
    messages_used: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    resulting_tz_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tz_analyses.id", ondelete="SET NULL"),
        nullable=True,
    )

    user: Mapped["User"] = relationship()  # noqa: F821
    messages: Mapped[list["TZCreationMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TZCreationMessage.created_at",
    )


class TZCreationMessage(IDMixinUUID, TimestampMixin, Base):
    """A single chat turn (user or assistant) in a TZ creation session."""

    __tablename__ = "tz_creation_messages"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tz_creation_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    session: Mapped["TZCreationSession"] = relationship(
        back_populates="messages",
    )
