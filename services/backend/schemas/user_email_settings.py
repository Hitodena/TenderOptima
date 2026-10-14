"""Pydantic schemas for per-user SMTP/IMAP settings."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class UserEmailSettingsResponse(BaseModel):
    """Safe email settings view (no passwords)."""

    model_config = ConfigDict(from_attributes=True)

    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password_configured: bool = False
    imap_host: str | None = None
    imap_port: int | None = None
    imap_user: str | None = None
    imap_password_configured: bool = False
    current_sender_email: str | None = None


class UserEmailSettingsUpdate(BaseModel):
    """Payload for updating per-user SMTP/IMAP credentials."""

    smtp_host: str | None = None
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    clear_smtp_port: bool = False
    smtp_user: str | None = None
    smtp_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_smtp_password: bool = False
    imap_host: str | None = None
    imap_port: int | None = Field(default=None, ge=1, le=65535)
    clear_imap_port: bool = False
    imap_user: str | None = None
    imap_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_imap_password: bool = False

    @field_validator(
        "smtp_host", "smtp_user", "imap_host", "imap_user", mode="before"
    )
    @classmethod
    def strip_non_secret_fields(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value
