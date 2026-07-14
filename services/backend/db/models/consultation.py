from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.enums import (
    ConsultationRequestType,
    ConsultationRole,
    ConsultationStatus,
)


class Consultation(IDMixinUUID, TimestampMixin, Base):
    """Consultation lead submitted from the landing page (mini-CRM)."""

    __tablename__ = "consultations"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    phone: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    role: Mapped[ConsultationRole] = mapped_column(String(30), nullable=False)
    request_type: Mapped[ConsultationRequestType] = mapped_column(
        String(20),
        nullable=False,
        default=ConsultationRequestType.DEMO,
        index=True,
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    agree_marketing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    status: Mapped[ConsultationStatus] = mapped_column(
        String(20),
        nullable=False,
        default=ConsultationStatus.NEW,
        index=True,
    )

    utm_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    utm_content: Mapped[str | None] = mapped_column(String(100), nullable=True)
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    ip_address: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
