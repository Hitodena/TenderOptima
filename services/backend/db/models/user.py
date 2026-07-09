from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.models.base import Base, IDMixinUUID, TimestampMixin


class User(IDMixinUUID, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(nullable=False)

    full_name: Mapped[str] = mapped_column(nullable=False)
    company_name: Mapped[str | None] = mapped_column()
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    contact_email: Mapped[str | None] = mapped_column()
    business_info: Mapped[str | None] = mapped_column(Text)

    smtp_host: Mapped[str | None] = mapped_column()
    smtp_port: Mapped[int | None] = mapped_column()
    smtp_user: Mapped[str | None] = mapped_column()
    smtp_password: Mapped[str | None] = mapped_column()

    imap_host: Mapped[str | None] = mapped_column()
    imap_port: Mapped[int | None] = mapped_column()
    imap_user: Mapped[str | None] = mapped_column()
    imap_password: Mapped[str | None] = mapped_column()

    is_admin: Mapped[bool] = mapped_column(default=False)
    agree_terms: Mapped[bool] = mapped_column(default=True)
    agree_marketing: Mapped[bool] = mapped_column(default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    failed_login_attempts: Mapped[int] = mapped_column(
        default=0, nullable=False
    )
    lockout_level: Mapped[int] = mapped_column(default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    requests: Mapped[list["Request"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=True, lazy="selectin"
    )
    blacklisted_domains: Mapped[list["BlacklistedDomain"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="added_by_user"
    )
    subscription: Mapped["Subscription"] = relationship(  # noqa: F821 # type: ignore
        back_populates="user", uselist=False, lazy="selectin"
    )
    billing_profile: Mapped["SubscriptionBillingProfile | None"] = (  # noqa: F821
        relationship(  # type: ignore
            "SubscriptionBillingProfile",
            back_populates="user",
            uselist=False,
            lazy="selectin",
        )
    )
    billing_documents: Mapped[list["SubscriptionBillingDocument"]] = (  # noqa: F821
        relationship(  # type: ignore
            "SubscriptionBillingDocument",
            back_populates="user",
            uselist=True,
            lazy="selectin",
        )
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
    frontend_error_logs: Mapped[list["FrontendErrorLog"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="user",
    )
    idea_suggestions: Mapped[list["IdeaSuggestion"]] = relationship(  # noqa: F821 # type: ignore
        back_populates="user",
    )
