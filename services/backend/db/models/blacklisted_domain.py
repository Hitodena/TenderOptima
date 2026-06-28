import uuid

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class BlacklistedDomain(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "blacklisted_domains"

    domain: Mapped[str] = mapped_column(unique=True, nullable=False)

    reason: Mapped[str | None] = mapped_column()

    is_global: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    added_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )

    added_by_user: Mapped["User | None"] = relationship(  # noqa: F821 # type: ignore
        back_populates="blacklisted_domains"
    )
