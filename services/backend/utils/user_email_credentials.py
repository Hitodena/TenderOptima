"""Resolve per-user SMTP/IMAP credentials with global env fallback."""

from dataclasses import dataclass

from backend.core.config import Config, get_config
from backend.db.models import User


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
    if user and user.smtp_host and user.smtp_user and user.smtp_password:
        return SmtpCredentials(
            host=user.smtp_host,
            port=cfg.smtp_port,
            user=user.smtp_user,
            password=user.smtp_password,
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
    if user and user.imap_host and user.imap_user and user.imap_password:
        return ImapCredentials(
            host=user.imap_host,
            port=cfg.imap_port,
            user=user.imap_user,
            password=user.imap_password,
        )
    return ImapCredentials(
        host=cfg.imap_host,
        port=cfg.imap_port,
        user=cfg.imap_user,
        password=cfg.imap_password,
    )


def user_has_imap_config(user: User) -> bool:
    return bool(user.imap_host and user.imap_user and user.imap_password)
