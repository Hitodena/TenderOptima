import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin


class Request(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    query: Mapped[str] = mapped_column(nullable=False)
    delivery_region: Mapped[str] = mapped_column()

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(nullable=False)  # aka Enum

    tracking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="requests")  # type: ignore # noqa: F821
    request_suppliers: Mapped[list["RequestSupplier"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="request"
    )
