from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class User(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)

    full_name: Mapped[str] = mapped_column(nullable=False)
    company_name: Mapped[str | None] = mapped_column()

    contact_email: Mapped[str | None] = mapped_column()
    business_info: Mapped[str | None] = mapped_column(Text)

    is_admin: Mapped[bool] = mapped_column(default=False)
    agree_terms: Mapped[bool] = mapped_column(default=True)
    agree_marketing: Mapped[bool] = mapped_column(default=False)

    requests: Mapped[list["Request"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=True, lazy="selectin"
    )
    blacklisted_domains: Mapped[list["BlacklistedDomain"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="added_by_user"
    )
    subscription: Mapped["Subscription"] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=False, lazy="selectin"
    )

    added_suppliers: Mapped[list["Supplier"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="added_by_user"
    )
    email_templates: Mapped[list["EmailTemplate"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="user",
    )
    supplier_bookmark_lists: Mapped[list["SupplierBookmarkList"]] = (  # noqa: F821
        relationship(
            back_populates="user",
        )
    )
