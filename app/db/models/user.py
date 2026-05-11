from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, IDMixinUUID, TimestampMixin
from app.db.models.blacklisted_domain import BlacklistedDomain
from app.db.models.request import Request
from app.db.models.subscription import Subscription


class User(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)

    full_name: Mapped[str | None] = mapped_column()
    company_name: Mapped[str | None] = mapped_column()

    request: Mapped[Request] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
    blacklisted_domains: Mapped[list["BlacklistedDomain"]] = relationship(
        back_populates="added_by_user"
    )
    subscription: Mapped[Subscription] = relationship(
        back_populates="user", uselist=False, lazy="selectin"
    )
