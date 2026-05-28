"""Internal DTOs for email thread summaries (DAO layer, not HTTP)."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from backend.db.models import EmailMessage
from backend.enums import EmailMessageDirection

PREVIEW_BODY_MAX_LEN = 280


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

    @classmethod
    def from_message(cls, message: EmailMessage) -> "LastMessagePreviewRow":
        raw = message.raw_body or message.subject or ""
        preview = raw[:PREVIEW_BODY_MAX_LEN]
        if len(raw) > PREVIEW_BODY_MAX_LEN:
            preview += "..."
        return cls(
            id=message.id,
            direction=EmailMessageDirection(message.direction),
            subject=message.subject,
            body=preview or None,
            received_at=message.received_at,
        )


class ThreadSummaryRow(BaseModel):
    """One thread in the left panel: supplier + last message + counts."""

    model_config = ConfigDict(frozen=True)

    rs_id: uuid.UUID
    supplier: SupplierSnapshot
    last_message: LastMessagePreviewRow
    message_count: int
    unread: bool

    @classmethod
    def from_message(
        cls, message: EmailMessage, message_count: int
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
            unread=message.direction == EmailMessageDirection.INCOMING.value,
        )
