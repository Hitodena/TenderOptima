import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class News(IDMixinUUID, TimestampMixin, Base):
    """An admin-published announcement shown to authenticated users."""

    __tablename__ = "news"
    __table_args__ = (
        Index("ix_news_is_active_created_at", "is_active", "created_at"),
    )

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    module_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[str] = mapped_column(
        String(16), default="warning", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_by_admin: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by_admin_id],
        back_populates="created_news",
    )
    read_receipts: Mapped[list["NewsRead"]] = relationship(  # noqa: F821
        "NewsRead",
        back_populates="news",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class NewsRead(Base):
    """Durable acknowledgement scoped to one news item and one user."""

    __tablename__ = "news_reads"
    __table_args__ = (Index("ix_news_reads_user_id", "user_id"),)

    news_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("news.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    read_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    news: Mapped[News] = relationship(back_populates="read_receipts")
    user: Mapped["User"] = relationship(  # noqa: F821
        "User", back_populates="news_reads"
    )
