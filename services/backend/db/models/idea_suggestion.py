import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class IdeaSuggestion(IDMixinUUID, TimestampMixin, Base):
    """Idea or feature suggestion submitted by an authenticated user."""

    __tablename__ = "idea_suggestions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    message: Mapped[str] = mapped_column(Text, nullable=False)

    user: Mapped["User"] = relationship(  # noqa: F821 # type: ignore
        back_populates="idea_suggestions",
    )
