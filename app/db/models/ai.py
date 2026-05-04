from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin


class AnalysisResult(IDMixin, TimestampMixin, Base):
    __tablename__ = "analysisResults"

    request_id: Mapped[int] = mapped_column(
        ForeignKey("searchRequests.id"), nullable=False
    )
    analysis_type: Mapped[str] = mapped_column(nullable=False, index=True)
    result_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    model_used: Mapped[Optional[str]] = mapped_column(nullable=True)
    confidence: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True
    )
    processing_time: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Relationships
    request: Mapped["SearchRequest"] = relationship(
        "SearchRequest", back_populates="analysis_results"
    )
