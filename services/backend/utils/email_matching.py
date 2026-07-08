"""Match incoming IMAP messages to RequestSupplier threads."""

import re
import uuid
from dataclasses import dataclass
from email.utils import parseaddr

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao import EmailMessageDAO, RequestSupplierDAO
from backend.db.models import Request, RequestSupplier
from backend.enums import RequestSupplierStatus
from backend.utils.email_utils import normalize_message_id

TRACKING_ID_RE = re.compile(r"\[TID-([A-Za-z0-9]{6,12})\]", re.IGNORECASE)

_ACTIVE_RS_STATUSES = (
    RequestSupplierStatus.SENT.value,
    RequestSupplierStatus.REPLIED.value,
)


@dataclass(frozen=True)
class EmailMatchResult:
    request_supplier: RequestSupplier
    matched_by: str
    match_confidence: str


def extract_tracking_id(
    subject: str | None, body: str | None = None
) -> str | None:
    """Find TID token in subject or body."""
    for text in (subject, body):
        if not text:
            continue
        match = TRACKING_ID_RE.search(text)
        if match:
            return match.group(1)
    return None


def parse_email_address(raw: str | None) -> str | None:
    """Normalize From/To header to bare email."""
    if not raw:
        return None
    _, addr = parseaddr(raw.strip())
    normalized = addr.strip().lower()
    return normalized or None


def _reference_message_ids(
    in_reply_to: str | None,
    references: str | None,
) -> list[str]:
    ids: list[str] = []
    for raw in (in_reply_to, references):
        if not raw:
            continue
        for part in re.split(r"\s+", raw.strip()):
            mid = normalize_message_id(part)
            if mid and mid not in ids:
                ids.append(mid)
    return ids


async def match_incoming_email(
    session: AsyncSession,
    *,
    subject: str | None,
    body: str | None,
    from_email: str | None,
    to_email: str | None,
    in_reply_to: str | None,
    references: str | None,
    mailbox_owner_id: uuid.UUID | None,
) -> EmailMatchResult | None:
    """Resolve request-supplier link for an incoming message."""
    tracking_id = extract_tracking_id(subject, body)
    if tracking_id:
        rs = await RequestSupplierDAO.get_by_tracking_id(session, tracking_id)
        if rs and _owner_ok(mailbox_owner_id, rs):
            return EmailMatchResult(rs, "tracking_id", "high")

    ref_ids = _reference_message_ids(in_reply_to, references)
    for ref_id in ref_ids:
        msg = await EmailMessageDAO.get_by_message_id(session, ref_id)
        if msg and msg.request_supplier:
            rs = msg.request_supplier
            if _owner_ok(mailbox_owner_id, rs):
                return EmailMatchResult(rs, "message_id", "high")

    if from_email:
        stmt = (
            select(RequestSupplier)
            .join(Request, RequestSupplier.request_id == Request.id)
            .where(
                RequestSupplier.sent_status.in_(_ACTIVE_RS_STATUSES),
            )
            .options(
                selectinload(RequestSupplier.supplier),
                selectinload(RequestSupplier.request),
            )
            .order_by(RequestSupplier.sent_at.desc().nulls_last())
        )
        if mailbox_owner_id is not None:
            stmt = stmt.where(Request.user_id == mailbox_owner_id)
        candidates = list((await session.execute(stmt)).scalars().all())
        for rs in candidates:
            supplier_email = (
                rs.sent_to_email or rs.supplier.main_email or ""
            ).lower()
            if supplier_email and supplier_email == from_email.lower():
                return EmailMatchResult(rs, "sender_recipient", "medium")

    return None


def _owner_ok(
    mailbox_owner_id: uuid.UUID | None,
    rs: RequestSupplier,
) -> bool:
    if mailbox_owner_id is None:
        return True
    request = rs.request
    if request is None:
        return False
    return request.user_id == mailbox_owner_id
