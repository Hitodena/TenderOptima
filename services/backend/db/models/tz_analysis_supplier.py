import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class TZAnalysisSupplier(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "tz_analysis_suppliers"

    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tz_analyses.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kp_filenames: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )
    primary_kp_filename: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    order_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )
    kp_pages_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    analysis: Mapped["TZAnalysis"] = relationship(  # noqa: F821
        back_populates="suppliers",
    )
