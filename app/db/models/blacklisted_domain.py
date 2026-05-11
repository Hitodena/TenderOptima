import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin
from app.db.models.user import User


class BlacklistedDomain(TimestampMixin, Base):
    __tablename__ = "blacklisted_domains"

    domain: Mapped[str] = mapped_column(unique=True, nullable=False)

    reason: Mapped[str | None] = mapped_column()

    added_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    added_by_user: Mapped["User | None"] = relationship(
        back_populates="blacklisted_domains"
    )
