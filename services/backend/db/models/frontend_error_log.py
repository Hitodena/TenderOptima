import uuid

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class FrontendErrorLog(IDMixinUUID, TimestampMixin, Base):
    """Browser-side error captured by the frontend error handler."""

    __tablename__ = "frontend_error_logs"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)
    backend_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    page_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    request_method: Mapped[str | None] = mapped_column(
        String(16), nullable=True
    )
    request_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True
    )
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped["User | None"] = relationship(  # noqa: F821 # type: ignore
        back_populates="frontend_error_logs",
    )
