import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class SupplierBookmarkList(IDMixinUUID, TimestampMixin, Base):
    """Named supplier collection owned by a user or marked global by admin."""

    __tablename__ = "supplier_bookmark_lists"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    is_global: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    user: Mapped["User | None"] = relationship(  # noqa: F821 # type: ignore
        back_populates="supplier_bookmark_lists",
    )
    items: Mapped[list["SupplierBookmarkItem"]] = relationship(
        back_populates="bookmark_list",
        cascade="all, delete-orphan",
        order_by="SupplierBookmarkItem.created_at",
    )


class SupplierBookmarkItem(IDMixinUUID, TimestampMixin, Base):
    """Single supplier entry inside a bookmark list."""

    __tablename__ = "supplier_bookmark_items"

    list_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("supplier_bookmark_lists.id", ondelete="CASCADE"),
        nullable=False,
    )
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    bookmark_list: Mapped["SupplierBookmarkList"] = relationship(
        back_populates="items",
    )
