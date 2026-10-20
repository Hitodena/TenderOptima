"""Shared SMTP/IMAP verification for every centralized mail-account flow."""

from dataclasses import dataclass

from backend.db.models import MailAccount
from backend.schemas.mail_account import MailAccountCreate, MailAccountUpdate
from backend.utils.secret_encryption import decrypt_secret
from backend.utils.user_email_credentials import (
    ImapCredentials,
    SmtpCredentials,
    verify_imap_credentials,
    verify_smtp_credentials,
)


@dataclass(frozen=True)
class MailAccountVerification:
    smtp_available: bool
    imap_available: bool
    last_error: str | None

    @property
    def availability(self) -> bool:
        return self.smtp_available and self.imap_available


def _safe_error(protocol: str) -> str:
    """Return an actionable diagnostic without server or credential details."""
    return f"{protocol} connection or authentication failed"


def _verify(
    smtp: SmtpCredentials,
    imap: ImapCredentials,
) -> MailAccountVerification:
    smtp_available = False
    imap_available = False
    errors: list[str] = []
    try:
        verify_smtp_credentials(smtp)
        smtp_available = True
    except Exception:
        errors.append(_safe_error("SMTP"))
    try:
        verify_imap_credentials(imap)
        imap_available = True
    except Exception:
        errors.append(_safe_error("IMAP"))
    return MailAccountVerification(
        smtp_available=smtp_available,
        imap_available=imap_available,
        last_error="; ".join(errors) or None,
    )


def verify_new_mail_account(
    payload: MailAccountCreate,
) -> MailAccountVerification:
    """Authenticate both protocols before a new account is persisted."""
    email = str(payload.email).strip().lower()
    return _verify(
        SmtpCredentials(
            host=payload.smtp_host,
            port=payload.smtp_port,
            user=email,
            password=payload.password,
        ),
        ImapCredentials(
            host=payload.imap_host,
            port=payload.imap_port,
            user=email,
            password=payload.password,
        ),
    )


def verify_updated_mail_account(
    account: MailAccount,
    payload: MailAccountUpdate,
) -> MailAccountVerification:
    """Verify edited endpoints using a submitted or currently stored secret."""
    email = str(payload.email).strip().lower()
    try:
        smtp_password = payload.password or decrypt_secret(account.smtp_password)
        imap_password = payload.password or decrypt_secret(account.imap_password)
    except Exception:
        return MailAccountVerification(
            smtp_available=False,
            imap_available=False,
            last_error="Saved mail-account credentials could not be decrypted",
        )
    if not smtp_password or not imap_password:
        return MailAccountVerification(
            smtp_available=False,
            imap_available=False,
            last_error="Mail account password is required",
        )
    return _verify(
        SmtpCredentials(
            host=payload.smtp_host,
            port=payload.smtp_port,
            user=email,
            password=smtp_password,
        ),
        ImapCredentials(
            host=payload.imap_host,
            port=payload.imap_port,
            user=email,
            password=imap_password,
        ),
    )


def verify_saved_mail_account(account: MailAccount) -> MailAccountVerification:
    """Recheck an existing account using its encrypted database credentials."""
    smtp_password = decrypt_secret(account.smtp_password)
    imap_password = decrypt_secret(account.imap_password)
    if not (
        account.smtp_host
        and account.smtp_port
        and account.smtp_user
        and smtp_password
    ):
        smtp = None
    else:
        smtp = SmtpCredentials(
            host=account.smtp_host,
            port=account.smtp_port,
            user=account.smtp_user,
            password=smtp_password,
        )
    if not (
        account.imap_host
        and account.imap_port
        and account.imap_user
        and imap_password
    ):
        imap = None
    else:
        imap = ImapCredentials(
            host=account.imap_host,
            port=account.imap_port,
            user=account.imap_user,
            password=imap_password,
        )
    if smtp is None or imap is None:
        return MailAccountVerification(
            smtp_available=False,
            imap_available=False,
            last_error="Mail account configuration is incomplete or unreadable",
        )
    return _verify(smtp, imap)
