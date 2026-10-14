"""Connection checks for user-supplied SMTP and IMAP settings."""

from backend.core.config import Config, get_config
from backend.db.models import User
from backend.schemas.user_email_settings import UserEmailSettingsUpdate
from backend.utils.user_email_credentials import (
    ImapCredentials,
    SmtpCredentials,
    verify_imap_credentials,
    verify_smtp_credentials,
)
from backend.utils.user_email_settings import (
    decrypted_imap_password,
    decrypted_smtp_password,
)


class UserEmailSettingsConnectionError(Exception):
    """A candidate mailbox configuration could not be verified."""

    def __init__(self, protocol: str, reason: str = "connection") -> None:
        super().__init__(f"{protocol} settings could not be verified")
        self.protocol = protocol
        self.reason = reason


def _changed(value: object, current: object) -> bool:
    return value is not None and value != current


def validate_user_email_settings_update(
    user: User,
    update: UserEmailSettingsUpdate,
    config: Config | None = None,
) -> None:
    """Verify changed, complete mailbox settings before the caller commits.

    The checks authenticate only; they do not send mail or read messages. A
    failed check raises before any database update, preserving the old values.
    """
    cfg = config or get_config()

    smtp_changed = any(
        (
            _changed(update.smtp_host, user.smtp_host),
            _changed(update.smtp_user, user.smtp_user),
            _changed(update.smtp_port, user.smtp_port),
            bool(update.smtp_password),
            update.clear_smtp_port and user.smtp_port is not None,
            update.clear_smtp_password
            and not update.smtp_password
            and bool(user.smtp_password),
        )
    )
    if smtp_changed:
        smtp_host = (
            update.smtp_host
            if update.smtp_host is not None
            else user.smtp_host
        )
        smtp_user = (
            update.smtp_user
            if update.smtp_user is not None
            else user.smtp_user
        )
        smtp_password = update.smtp_password or (
            None
            if update.clear_smtp_password
            else decrypted_smtp_password(user)
        )
        smtp_port = (
            update.smtp_port
            if update.smtp_port is not None
            else None
            if update.clear_smtp_port
            else user.smtp_port
        ) or cfg.smtp_port

        if update.smtp_password and (not smtp_host or not smtp_user):
            raise UserEmailSettingsConnectionError("smtp", "incomplete")
        if smtp_host and smtp_user and smtp_password:
            try:
                verify_smtp_credentials(
                    SmtpCredentials(
                        host=smtp_host,
                        port=smtp_port,
                        user=smtp_user,
                        password=smtp_password,
                    )
                )
            except Exception as exc:
                raise UserEmailSettingsConnectionError("smtp") from exc

    imap_changed = any(
        (
            _changed(update.imap_host, user.imap_host),
            _changed(update.imap_user, user.imap_user),
            _changed(update.imap_port, user.imap_port),
            bool(update.imap_password),
            update.clear_imap_port and user.imap_port is not None,
            update.clear_imap_password
            and not update.imap_password
            and bool(user.imap_password),
        )
    )
    if imap_changed:
        imap_host = (
            update.imap_host
            if update.imap_host is not None
            else user.imap_host
        )
        imap_user = (
            update.imap_user
            if update.imap_user is not None
            else user.imap_user
        )
        imap_password = update.imap_password or (
            None
            if update.clear_imap_password
            else decrypted_imap_password(user)
        )
        imap_port = (
            update.imap_port
            if update.imap_port is not None
            else None
            if update.clear_imap_port
            else user.imap_port
        ) or cfg.imap_port

        if update.imap_password and (not imap_host or not imap_user):
            raise UserEmailSettingsConnectionError("imap", "incomplete")
        if imap_host and imap_user and imap_password:
            try:
                verify_imap_credentials(
                    ImapCredentials(
                        host=imap_host,
                        port=imap_port,
                        user=imap_user,
                        password=imap_password,
                    )
                )
            except Exception as exc:
                raise UserEmailSettingsConnectionError("imap") from exc
