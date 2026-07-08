"""Pydantic schemas for per-user SMTP/IMAP settings."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


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


class UserEmailSettingsUpdate(BaseModel):
    """Payload for updating per-user SMTP/IMAP credentials."""

    model_config = ConfigDict(str_strip_whitespace=True)

    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_smtp_password: bool = False
    imap_host: str | None = None
    imap_port: int | None = None
    imap_user: str | None = None
    imap_password: Annotated[
        str | None,
        Field(default=None, description="Set only to change password"),
    ] = None
    clear_imap_password: bool = False
