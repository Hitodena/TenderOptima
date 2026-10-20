"""Public API schemas for centralized mail accounts."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from backend.enums import MailAccountSource


class MailAccountCreate(BaseModel):
    """Mailbox credentials submitted only when creating a new account."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1, max_length=512)
    smtp_host: str = Field(min_length=1, max_length=255)
    smtp_port: int = Field(ge=1, le=65535)
    imap_host: str = Field(min_length=1, max_length=255)
    imap_port: int = Field(ge=1, le=65535)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class MailAccountResponse(BaseModel):
    """Safe mail-account view; passwords are intentionally absent."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    source: MailAccountSource
    created_by_user_id: uuid.UUID | None = None
    created_by_user_email: EmailStr | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    smtp_available: bool
    imap_available: bool
    availability: bool
    last_checked_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    assigned_user_count: int = 0


class MyMailAccountResponse(BaseModel):
    account: MailAccountResponse | None = None
    current_sender_email: EmailStr | None = None


class MailAccountAssignmentUpdate(BaseModel):
    mail_account_id: uuid.UUID | None = None


class MailAccountVerificationResponse(BaseModel):
    mail_account_id: uuid.UUID
    smtp_available: bool
    imap_available: bool
    availability: bool
    last_checked_at: datetime | None = None
    last_error: str | None = None


class MailAccountBulkVerificationResponse(BaseModel):
    items: list[MailAccountVerificationResponse]
