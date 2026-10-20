"""Helpers for Celery IMAP polling across centralized mail accounts."""

import uuid
from dataclasses import dataclass

from backend.db.models import MailAccount
from backend.enums import MailAccountSource
from backend.utils.user_email_credentials import (
    ImapCredentials,
    MailAccountUnavailableError,
    resolve_imap_credentials,
)


@dataclass(frozen=True)
class MailPollMailbox:
    """One physical, centralized IMAP mailbox to poll."""

    account_id: uuid.UUID
    label: str
    owner_user_id: uuid.UUID | None
    creds: ImapCredentials

    @property
    def log_context(self) -> dict[str, str | int]:
        """Safe-to-log identity of the mailbox, without its password."""
        return {
            "mail_account_id": str(self.account_id),
            "mailbox": self.label,
            "imap_host": self.creds.host,
            "imap_port": self.creds.port,
            "imap_user": self.creds.user,
        }


def build_mailbox_imap_id(mailbox: MailPollMailbox, uid: str) -> str:
    """Stable dedup key scoped to the persisted physical mailbox and IMAP UID."""
    return f"{mailbox.account_id}:{uid}"


def tracking_belongs_to_mailbox_owner(
    owner_user_id: uuid.UUID | None,
    request_user_id: uuid.UUID,
) -> bool:
    """A custom mailbox accepts only its owner's request threads."""
    if owner_user_id is None:
        return True
    return owner_user_id == request_user_id


def build_poll_mailboxes(accounts: list[MailAccount]) -> list[MailPollMailbox]:
    """Build one mailbox per assigned account; no global mailbox is appended."""
    mailboxes: list[MailPollMailbox] = []
    for account in accounts:
        try:
            creds = resolve_imap_credentials(account)
        except MailAccountUnavailableError:
            continue
        owner_user_id = (
            account.created_by_user_id
            if account.source == MailAccountSource.CUSTOM.value
            else None
        )
        mailboxes.append(
            MailPollMailbox(
                account_id=account.id,
                label=f"{account.source}:{account.email}",
                owner_user_id=owner_user_id,
                creds=creds,
            )
        )
    return mailboxes
