from typing import Optional

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin


class ImprovementRequest(IDMixin, TimestampMixin, Base):
    __tablename__ = "improvementRequests"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    request_type: Mapped[str] = mapped_column(nullable=False, index=True)
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, index=True)
    assigned_to: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User", back_populates="improvement_requests"
    )
    assigned_to_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_to]
    )
