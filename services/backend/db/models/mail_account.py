"""Centralized SMTP/IMAP mailbox configuration."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class MailAccount(IDMixinUUID, TimestampMixin, Base):
    """A reusable mailbox with both SMTP and IMAP connection settings."""

    __tablename__ = "mail_accounts"

    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    smtp_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(Text, nullable=True)
    imap_host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imap_port: Mapped[int | None] = mapped_column(nullable=True)
    imap_user: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imap_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    availability: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    smtp_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    imap_available: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_user: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by_user_id],
        back_populates="created_mail_accounts",
    )
    assigned_users: Mapped[list["User"]] = relationship(  # noqa: F821
        "User",
        foreign_keys="User.mail_account_id",
        back_populates="mail_account",
    )
