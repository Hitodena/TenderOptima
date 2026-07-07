"""Helpers for Celery IMAP polling across per-user and global mailboxes."""

import uuid
from dataclasses import dataclass

from backend.core.config import Config, get_config
from backend.db.models import User
from backend.utils.user_email_credentials import (
    ImapCredentials,
    resolve_imap_credentials,
)


@dataclass(frozen=True)
class MailPollMailbox:
    """One physical IMAP mailbox to poll."""

    label: str
    owner_user_id: uuid.UUID | None
    creds: ImapCredentials


def build_mailbox_imap_id(creds: ImapCredentials, uid: str) -> str:
    """Stable dedup key scoped to a physical mailbox, not bare IMAP UID."""
    return f"{creds.host}:{creds.user}:{uid}"


def tracking_belongs_to_mailbox_owner(
    owner_user_id: uuid.UUID | None,
    request_user_id: uuid.UUID,
) -> bool:
    """Global mailbox accepts any TID; per-user mailbox only its owner."""
    if owner_user_id is None:
        return True
    return owner_user_id == request_user_id


def build_poll_mailboxes(
    imap_users: list[User],
    config: Config | None = None,
) -> list[MailPollMailbox]:
    """Build deduplicated mailbox list: per-user first, then global fallback."""
    cfg = config or get_config()
    global_creds = resolve_imap_credentials(None, cfg)
    global_key = (global_creds.host, global_creds.user)

    groups: dict[tuple[str, str], list[tuple[User, ImapCredentials]]] = {}
    for user in imap_users:
        creds = resolve_imap_credentials(user, cfg)
        key = (creds.host, creds.user)
        groups.setdefault(key, []).append((user, creds))

    mailboxes: list[MailPollMailbox] = []
    for key, entries in groups.items():
        creds = entries[0][1]
        is_shared = len(entries) > 1 or key == global_key
        if is_shared:
            mailboxes.append(
                MailPollMailbox(
                    label="global",
                    owner_user_id=None,
                    creds=creds,
                )
            )
        else:
            owner = entries[0][0]
            mailboxes.append(
                MailPollMailbox(
                    label=str(owner.id),
                    owner_user_id=owner.id,
                    creds=creds,
                )
            )

    if global_key not in groups:
        mailboxes.append(
            MailPollMailbox(
                label="global",
                owner_user_id=None,
                creds=global_creds,
            )
        )

    return mailboxes
