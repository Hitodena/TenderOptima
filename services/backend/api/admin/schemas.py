import uuid
from datetime import datetime

from backend.api.subscriptions.schemas import SubscriptionResponse
from backend.schemas.user_email_settings import (
    UserEmailSettingsResponse,
)
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    company_name: str | None = None
    ref_by: str | None = None
    is_admin: bool
    created_at: datetime
    last_login_at: datetime | None = None
    smtp_password_configured: bool
    imap_password_configured: bool
    searches_used_this_month: int = 0
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
    ref_by: str | None = None
    is_admin: bool
    created_at: datetime
    last_login_at: datetime | None = None
    email_settings: UserEmailSettingsResponse
    searches_used_this_month: int = 0
    emails_sent_this_month: int = 0
    pages_analyzed_this_month: int = 0
    pages_analysis_remaining: int | None = None
    subscription: SubscriptionResponse | None = None
    agree_terms: bool = False
    agree_marketing: bool = False
    terms_accepted_at: datetime | None = None
    terms_version: str | None = None
    privacy_version: str | None = None
    consent_ip: str | None = None
    consent_user_agent: str | None = None
    marketing_consent_at: datetime | None = None
    marketing_consent_version: str | None = None


class AdminSupplierPreferenceItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    status: str
    categories: list[str] = Field(default_factory=list)
    region: str | None = None
    consent_accepted_at: datetime | None = None
    consent_ip: str | None = None
    terms_accepted_at: datetime | None = None
    terms_version: str | None = None
    privacy_version: str | None = None
    consent_user_agent: str | None = None
    agree_marketing: bool = False
    marketing_consent_at: datetime | None = None
    marketing_consent_version: str | None = None
    source_request_id: uuid.UUID | None = None
    source_request_query: str | None = None
    subscribed_at: datetime | None = None
    unsubscribed_at: datetime | None = None
    created_at: datetime


class AdminSupplierPreferencePage(BaseModel):
    items: list[AdminSupplierPreferenceItem]
    page: int
    size: int
    total: int


class ReferralInvitationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    inviter_name: str = Field(min_length=2, max_length=150)


class ReferralInvitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    inviter_name: str
    created_by_admin_id: uuid.UUID | None = None
    used_by_user_id: uuid.UUID | None = None
    used_by_user_email: EmailStr | None = None
    used_at: datetime | None = None
    created_at: datetime


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


class AdminSmtpDefaultsResponse(BaseModel):
    """Global SMTP settings from environment (passwords not exposed)."""

    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password_configured: bool


class AdminCooperationSupplierItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    domain: str | None = None
    main_email: EmailStr
    queries: list[str] = Field(default_factory=list)


class AdminCooperationSupplierPage(BaseModel):
    items: list[AdminCooperationSupplierItem]
    total: int
    page: int
    size: int


class AdminCooperationSendRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    supplier_ids: list[uuid.UUID] = Field(min_length=1)
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=20000)
    attachment_paths: list[str] | None = None
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_user: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=512)


class AdminCooperationSendResponse(BaseModel):
    status: str
    queued: int


class PersonalDataPurposeResponse(BaseModel):
    purpose_number: int
    purpose: str
    subjects: str
    data_list: str
    legal_basis: str
    retention_text: str
    retention_days_after_user_deletion: int | None
    cleanup_supported: bool
    cleanup_task_name: str | None
    cleanup_description: str | None


class DeletedUserPurposeCountdown(BaseModel):
    purpose_number: int
    retention_days: int
    days_until_cleanup: int
    ready: bool


class DeletedUserRetentionItem(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    deleted_at: datetime
    deleted_reason: str | None = None
    days_since_deleted: int
    nearest_cleanup_days: int | None = None
    purposes: list[DeletedUserPurposeCountdown]


class DeletedUserRetentionPage(BaseModel):
    items: list[DeletedUserRetentionItem]
    total: int


class PersonalDataCleanupRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    purpose_number: int
    status: str
    requested_by_admin_id: uuid.UUID | None = None
    celery_task_id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    eligible_users: int
    affected_records: int
    error: str | None = None
    created_at: datetime


class PersonalDataCleanupEnqueueResponse(BaseModel):
    run_id: uuid.UUID
    purpose_number: int
    status: str
    celery_task_id: str | None = None
    message: str
