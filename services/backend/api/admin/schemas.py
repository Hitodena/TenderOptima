import uuid
from datetime import datetime

from backend.api.subscriptions.schemas import SubscriptionResponse
from backend.schemas.user_email_settings import (
    UserEmailSettingsResponse,
)
from pydantic import BaseModel, ConfigDict, EmailStr


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None
    is_admin: bool
    created_at: datetime
    smtp_password_configured: bool
    imap_password_configured: bool
    emails_sent_this_month: int = 0
    pages_analyzed_this_month: int = 0
    pages_analysis_remaining: int | None = None
    subscription: SubscriptionResponse | None = None


class AdminUserDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None
    is_admin: bool
    created_at: datetime
    email_settings: UserEmailSettingsResponse
    emails_sent_this_month: int = 0
    pages_analyzed_this_month: int = 0
    pages_analysis_remaining: int | None = None
    subscription: SubscriptionResponse | None = None


class AdminEmailMessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    direction: str
    subject: str | None = None
    from_email: str | None = None
    to_email: str | None = None
    mailbox_email: str | None = None
    imap_id: str | None = None
    message_id: str | None = None
    matched_by: str | None = None
    match_confidence: str | None = None
    received_at: datetime | None = None
    request_supplier_id: uuid.UUID
    request_id: uuid.UUID | None = None
    tracking_id: str | None = None
    supplier_email: str | None = None
    supplier_company: str | None = None
    supplier_domain: str | None = None
    user_email: str | None = None
    user_id: uuid.UUID | None = None


class AdminEmailMessagePage(BaseModel):
    items: list[AdminEmailMessageItem]
    total: int
    page: int
    size: int


class AdminEmailMessageLinkUpdate(BaseModel):
    request_supplier_id: uuid.UUID


class AdminRequestSupplierRecipientUpdate(BaseModel):
    sent_to_email: EmailStr
