"""Audit log for manual personal-data retention cleanup runs."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class PersonalDataCleanupRun(IDMixinUUID, TimestampMixin, Base):
    """One admin-triggered retention cleanup execution."""

    __tablename__ = "personal_data_cleanup_runs"

    purpose_number: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True, default="queued"
    )
    requested_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    celery_task_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    eligible_users: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    affected_records: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
