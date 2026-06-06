import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class TZAnalysis(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "tz_analyses"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    tz_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    kp_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    kp_filenames: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )
    confirmed: Mapped[bool] = mapped_column(nullable=False, default=False)
    requirements_tz: Mapped[list] = mapped_column(
        JSON, nullable=False, default=list
    )
    requirements_kp: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )
    kp_stats: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict
    )
    items: Mapped[list] = mapped_column(JSON, nullable=False)
    match_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    met_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    partial_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    missing_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    not_found_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    llm_model: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    user: Mapped["User"] = relationship()  # pyright: ignore[reportUndefinedVariable]  # noqa: F821
