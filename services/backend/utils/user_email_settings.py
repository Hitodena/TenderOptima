"""Shared helpers for per-user SMTP/IMAP settings."""

from backend.db.models import User
from backend.schemas.user_email_settings import UserEmailSettingsResponse
from backend.utils.secret_encryption import decrypt_secret, store_secret


def email_settings_response(user: User) -> UserEmailSettingsResponse:
    return UserEmailSettingsResponse(
        smtp_host=user.smtp_host,
        smtp_port=user.smtp_port,
        smtp_user=user.smtp_user,
        smtp_password_configured=bool(user.smtp_password),
        imap_host=user.imap_host,
        imap_port=user.imap_port,
        imap_user=user.imap_user,
        imap_password_configured=bool(user.imap_password),
    )


def apply_email_settings_update(
    user: User,
    *,
    smtp_host: str | None = None,
    smtp_port: int | None = None,
    smtp_user: str | None = None,
    smtp_password: str | None = None,
    imap_host: str | None = None,
    imap_port: int | None = None,
    imap_user: str | None = None,
    imap_password: str | None = None,
    clear_smtp_password: bool = False,
    clear_imap_password: bool = False,
) -> None:
    if smtp_host is not None:
        user.smtp_host = smtp_host or None
    if smtp_port is not None:
        user.smtp_port = smtp_port
    if smtp_user is not None:
        user.smtp_user = smtp_user or None
    if smtp_password:
        user.smtp_password = store_secret(smtp_password)
    elif clear_smtp_password:
        user.smtp_password = None
    if imap_host is not None:
        user.imap_host = imap_host or None
    if imap_port is not None:
        user.imap_port = imap_port
    if imap_user is not None:
        user.imap_user = imap_user or None
    if imap_password:
        user.imap_password = store_secret(imap_password)
    elif clear_imap_password:
        user.imap_password = None


def decrypted_smtp_password(user: User) -> str | None:
    return decrypt_secret(user.smtp_password)


def decrypted_imap_password(user: User) -> str | None:
    return decrypt_secret(user.imap_password)
