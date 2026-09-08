from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
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
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    terms_version: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    privacy_version: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    consent_user_agent: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    marketing_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    marketing_consent_version: Mapped[str | None] = mapped_column(
        String(32), nullable=True
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
