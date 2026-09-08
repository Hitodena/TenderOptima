"""Platform-wide supplier RFQ mailing preferences (opt-in / opt-out)."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.enums import SupplierEmailPreferenceStatus


class SupplierEmailPreference(IDMixinUUID, TimestampMixin, Base):
    """One row per supplier email for subscribe / unsubscribe state."""

    __tablename__ = "supplier_email_preferences"

    email: Mapped[str] = mapped_column(
        String(320), unique=True, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=SupplierEmailPreferenceStatus.SUBSCRIBED.value,
        index=True,
    )
    categories: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    consent_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consent_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
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
    agree_marketing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    marketing_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    marketing_consent_version: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )
    source_request_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    subscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unsubscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
