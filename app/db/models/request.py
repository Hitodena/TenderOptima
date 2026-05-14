import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Float, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin


class Request(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    query: Mapped[str] = mapped_column(nullable=False)
    delivery_region: Mapped[str | None] = mapped_column()

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    quantity: Mapped[int | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column()

    quality_requirements: Mapped[str | None] = mapped_column(Text)

    delivery_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    max_price_per_unit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    currency: Mapped[str | None] = mapped_column()

    status: Mapped[str] = mapped_column(nullable=False)  # aka Enum

    tracking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="requests")  # type: ignore # noqa: F821
    request_suppliers: Mapped[list["RequestSupplier"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="request"
    )
