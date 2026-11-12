"""Internal DTOs for email thread summaries (DAO layer, not HTTP)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from backend.db.models import EmailMessage
from backend.enums import EmailMessageDirection, RequestSupplierStatus
from backend.utils.email_content import (
    letter_text,
    looks_like_decline,
    split_quoted_reply,
)

PREVIEW_BODY_MAX_LEN = 280


def message_activity_at(message: EmailMessage) -> datetime | None:
    """Timestamp used for unread comparisons (received_at with created_at fallback)."""
    return message.received_at or message.created_at


def is_thread_unread(
    message: EmailMessage,
    thread_read_at: datetime | None,
) -> bool:
    """Thread is unread when the latest message is incoming and newer than read mark."""
    if message.direction != EmailMessageDirection.INCOMING.value:
        return False
    activity = message_activity_at(message)
    if thread_read_at is None:
        return True
    if activity is None:
        return False
    return activity > thread_read_at


class SupplierSnapshot(BaseModel):
    """Supplier fields embedded in a thread list row."""

    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: uuid.UUID
    domain: str | None
    company_name: str
    main_email: str
    extra_emails: list[str] | None = None
    from_source: str | None = None


class LastMessagePreviewRow(BaseModel):
    """Latest message preview for one request-supplier thread."""

    model_config = ConfigDict(frozen=True)

    id: uuid.UUID
    direction: EmailMessageDirection
    subject: str | None = None
    body: str | None = None
    received_at: datetime | None = None
    kind: str | None = None

    @classmethod
    def from_message(cls, message: EmailMessage) -> "LastMessagePreviewRow":
        # the new text only: the list shows what the supplier just said
        raw = (
            split_quoted_reply(letter_text(message)).main
            or message.raw_body
            or message.subject
            or ""
        )
        preview = raw[:PREVIEW_BODY_MAX_LEN]
        if len(raw) > PREVIEW_BODY_MAX_LEN:
            preview += "..."
        return cls(
            id=message.id,
            direction=EmailMessageDirection(message.direction),
            subject=message.subject,
            body=preview or None,
            received_at=message.received_at,
            kind=message.kind,
        )


class ThreadSummaryRow(BaseModel):
    """One thread in the left panel: supplier + last message + counts."""

    model_config = ConfigDict(frozen=True)

    rs_id: uuid.UUID
    supplier: SupplierSnapshot
    last_message: LastMessagePreviewRow
    message_count: int
    unread: bool
    has_outgoing: bool = False
    # the letter did not reach the supplier (SMTP error or a failure report)
    delivery_failed: bool = False
    # the supplier's latest letter reads like a refusal (a hint, not a fact)
    declined: bool = False
    # the buyer marked this thread with a star
    starred: bool = False

    @classmethod
    def from_message(
        cls,
        message: EmailMessage,
        message_count: int,
        *,
        has_outgoing: bool = False,
        unread: bool | None = None,
        latest_incoming: EmailMessage | None = None,
    ) -> "ThreadSummaryRow":
        """Build a row from the latest message (must have request_supplier.supplier loaded)."""
        rs = message.request_supplier
        if rs is None or rs.supplier is None:
            msg = "request_supplier and supplier must be eager-loaded"
            raise ValueError(msg)
        return cls(
            rs_id=rs.id,
            supplier=SupplierSnapshot.model_validate(rs.supplier),
            last_message=LastMessagePreviewRow.from_message(message),
            message_count=message_count,
            unread=(
                unread
                if unread is not None
                else is_thread_unread(message, rs.thread_read_at)
            ),
            has_outgoing=has_outgoing,
            delivery_failed=rs.sent_status
            == RequestSupplierStatus.FAILED.value,
            starred=bool(rs.is_starred),
            declined=bool(
                latest_incoming is not None
                and latest_incoming.kind is None
                and looks_like_decline(
                    split_quoted_reply(letter_text(latest_incoming)).main
                )
            ),
        )
