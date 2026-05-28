import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, TimestampMixin


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )

    plan: Mapped[str] = mapped_column(nullable=False, primary_key=True)

    max_requests_per_month: Mapped[int] = mapped_column(Integer, default=3)
    max_suppliers_per_request: Mapped[int] = mapped_column(Integer, default=20)
    max_mailings_per_request: Mapped[int] = mapped_column(Integer, default=20)

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    user: Mapped["User"] = relationship(back_populates="subscription")  # type: ignore # noqa: F821
