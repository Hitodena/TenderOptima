import uuid

from sqlalchemy import ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base, TimestampMixin


class SearchHistory(TimestampMixin, Base):
    __tablename__ = "search_history"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    raw_search_body: Mapped[dict] = mapped_column(JSON)
    query: Mapped[str] = mapped_column()
    results_count: Mapped[int | None] = mapped_column(Integer)
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("requests.id")
    )
