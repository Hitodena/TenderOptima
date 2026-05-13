from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin


class User(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)

    full_name: Mapped[str | None] = mapped_column()
    company_name: Mapped[str | None] = mapped_column()
    is_admin: Mapped[bool] = mapped_column(default=False)

    request: Mapped["Request"] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=False, lazy="selectin"
    )
    blacklisted_domains: Mapped[list["BlacklistedDomain"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="added_by_user"
    )
    subscription: Mapped["Subscription"] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=False, lazy="selectin"
    )
