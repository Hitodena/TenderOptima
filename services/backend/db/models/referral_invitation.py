import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class ReferralInvitation(IDMixinUUID, TimestampMixin, Base):
    """One-time invitation code that allows a user to register."""

    __tablename__ = "registration_referrals"

    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    inviter_name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    used_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by_admin: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[created_by_admin_id],
        lazy="selectin",
    )
    used_by_user: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        foreign_keys=[used_by_user_id],
        lazy="selectin",
    )
