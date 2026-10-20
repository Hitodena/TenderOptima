"""SMTP/IMAP connections resolved only from a centralized mail account."""

import imaplib
import smtplib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

from backend.db.models import MailAccount
from backend.utils.secret_encryption import decrypt_secret


class MailAccountUnavailableError(RuntimeError):
    """A requested mailbox cannot be used and must never fall back silently."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class SmtpCredentials:
    host: str
    port: int
    user: str
    password: str


@dataclass(frozen=True)
class ImapCredentials:
    host: str
    port: int
    user: str
    password: str


def _require_available(account: MailAccount | None) -> MailAccount:
    if account is None:
        raise MailAccountUnavailableError("mail_account_not_assigned")
    if not account.availability:
        raise MailAccountUnavailableError("mail_account_unavailable")
    return account


def resolve_smtp_credentials(account: MailAccount | None) -> SmtpCredentials:
    """Return current SMTP credentials for one verified central account."""
    account = _require_available(account)
    password = decrypt_secret(account.smtp_password)
    if not (
        account.smtp_host
        and account.smtp_port
        and account.smtp_user
        and password
    ):
        raise MailAccountUnavailableError("smtp_configuration_invalid")
    return SmtpCredentials(
        host=account.smtp_host,
        port=account.smtp_port,
        user=account.smtp_user,
        password=password,
    )


def resolve_imap_credentials(account: MailAccount | None) -> ImapCredentials:
    """Return current IMAP credentials for one verified central account."""
    account = _require_available(account)
    password = decrypt_secret(account.imap_password)
    if not (
        account.imap_host
        and account.imap_port
        and account.imap_user
        and password
    ):
        raise MailAccountUnavailableError("imap_configuration_invalid")
    return ImapCredentials(
        host=account.imap_host,
        port=account.imap_port,
        user=account.imap_user,
        password=password,
    )


def _uses_implicit_tls(port: int) -> bool:
    """Port 465 uses SMTPS (implicit TLS), not STARTTLS."""
    return port == 465


@contextmanager
def smtp_connection(
    creds: SmtpCredentials,
    *,
    timeout: float = 30,
) -> Iterator[smtplib.SMTP]:
    """Open and authenticate one SMTP connection, then always close it."""
    if _uses_implicit_tls(creds.port):
        smtp = smtplib.SMTP_SSL(creds.host, creds.port, timeout=timeout)
        try:
            smtp.ehlo()
            smtp.login(creds.user, creds.password)
            yield smtp
        finally:
            try:
                smtp.quit()
            except Exception:
                pass
        return

    smtp = smtplib.SMTP(creds.host, creds.port, timeout=timeout)
    try:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(creds.user, creds.password)
        yield smtp
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


def verify_smtp_credentials(
    creds: SmtpCredentials,
    *,
    timeout: float = 10,
) -> None:
    """Verify SMTP reachability and authentication without sending mail."""
    with smtp_connection(creds, timeout=timeout) as server:
        code, _ = server.noop()
        if code != 250:
            raise smtplib.SMTPException("SMTP NOOP failed")


def verify_imap_credentials(
    creds: ImapCredentials,
    *,
    timeout: float = 10,
) -> None:
    """Verify IMAP reachability and authentication without reading mail."""
    client = imaplib.IMAP4_SSL(creds.host, creds.port, timeout=timeout)
    try:
        status, _ = client.login(creds.user, creds.password)
        if status != "OK":
            raise imaplib.IMAP4.error("IMAP login failed")
    finally:
        try:
            client.logout()
        except Exception:
            pass
