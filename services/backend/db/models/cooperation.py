"""Supplier cooperation invitation leads and verified supplier registry."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin
from backend.enums import CooperationLeadStatus


class CooperationLead(IDMixinUUID, TimestampMixin, Base):
    """Public supplier invitation submitted for admin moderation."""

    __tablename__ = "cooperation_leads"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    company: Mapped[str] = mapped_column(String(150), nullable=False)
    industry: Mapped[str] = mapped_column(String(150), nullable=False)
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
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CooperationLeadStatus.NEW.value,
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

    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    verified_supplier: Mapped["VerifiedSupplier | None"] = relationship(
        back_populates="source_lead",
        uselist=False,
    )


class VerifiedSupplier(IDMixinUUID, TimestampMixin, Base):
    """Manually approved supplier kept in the verified registry."""

    __tablename__ = "verified_suppliers"

    company_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    industry: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="cooperation_approval",
    )
    source_lead_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cooperation_leads.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    approved_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
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
    consent_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    consent_user_agent: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    marketing_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    marketing_consent_version: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )

    source_lead: Mapped[CooperationLead | None] = relationship(
        back_populates="verified_supplier",
    )
