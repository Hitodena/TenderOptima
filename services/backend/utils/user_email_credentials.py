"""Resolve per-user SMTP/IMAP credentials with global env fallback."""

import imaplib
import smtplib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass

from backend.core.config import Config, get_config
from backend.db.models import User
from backend.utils.user_email_settings import (
    decrypted_imap_password,
    decrypted_smtp_password,
)


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


def resolve_smtp_credentials(
    user: User | None,
    config: Config | None = None,
) -> SmtpCredentials:
    """Return user SMTP settings when complete, else global config."""
    cfg = config or get_config()
    password = decrypted_smtp_password(user) if user else None
    if user and user.smtp_host and user.smtp_user and password:
        return SmtpCredentials(
            host=user.smtp_host,
            port=user.smtp_port or cfg.smtp_port,
            user=user.smtp_user,
            password=password,
        )
    return SmtpCredentials(
        host=cfg.smtp_host,
        port=cfg.smtp_port,
        user=cfg.smtp_user,
        password=cfg.smtp_password,
    )


def resolve_imap_credentials(
    user: User | None,
    config: Config | None = None,
) -> ImapCredentials:
    """Return user IMAP settings when complete, else global config."""
    cfg = config or get_config()
    password = decrypted_imap_password(user) if user else None
    if user and user.imap_host and user.imap_user and password:
        return ImapCredentials(
            host=user.imap_host,
            port=user.imap_port or cfg.imap_port,
            user=user.imap_user,
            password=password,
        )
    return ImapCredentials(
        host=cfg.imap_host,
        port=cfg.imap_port,
        user=cfg.imap_user,
        password=cfg.imap_password,
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
    """Open an authenticated SMTP session (SSL on 465, STARTTLS otherwise)."""
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
    client = imaplib.IMAP4_SSL(
        creds.host,
        creds.port,
        timeout=timeout,
    )
    try:
        status, _ = client.login(creds.user, creds.password)
        if status != "OK":
            raise imaplib.IMAP4.error("IMAP login failed")
    finally:
        try:
            client.logout()
        except Exception:
            pass


def user_has_imap_config(user: User) -> bool:
    return bool(
        user.imap_host and user.imap_user and decrypted_imap_password(user)
    )
