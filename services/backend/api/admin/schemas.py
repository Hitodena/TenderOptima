import uuid
from typing import Annotated

from backend.api.subscriptions.schemas import SubscriptionResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserEmailSettingsResponse(BaseModel):
    """Safe email settings view (no passwords)."""

    model_config = ConfigDict(from_attributes=True)

    smtp_host: str | None = None
    smtp_user: str | None = None
    smtp_password_configured: bool = False
    imap_host: str | None = None
    imap_user: str | None = None
    imap_password_configured: bool = False


class UserEmailSettingsUpdate(BaseModel):
    """Admin payload for per-user SMTP/IMAP credentials."""

    model_config = ConfigDict(str_strip_whitespace=True)

    smtp_host: str | None = None
    smtp_user: str | None = None
    smtp_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_smtp_password: bool = False
    imap_host: str | None = None
    imap_user: str | None = None
    imap_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_imap_password: bool = False


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None
    is_admin: bool
    smtp_password_configured: bool
    imap_password_configured: bool
    subscription: SubscriptionResponse | None = None


class AdminUserDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None
    is_admin: bool
    email_settings: UserEmailSettingsResponse
    subscription: SubscriptionResponse | None = None
