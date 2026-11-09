"""Match incoming IMAP messages to RequestSupplier threads."""

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.utils import parseaddr

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao import EmailMessageDAO, RequestSupplierDAO
from backend.db.models import EmailMessage, Request, RequestSupplier
from backend.enums import RequestSupplierStatus
from backend.utils.email_content import MessageKind
from backend.utils.email_utils import normalize_message_id

TRACKING_ID_RE = re.compile(r"\[TID-([A-Za-z0-9]{6,12})\]", re.IGNORECASE)

# matched_by for a colleague's answer to our forward of a supplier letter
COLLEAGUE_MATCH = "forward"
# how long after a forward an answer from that address without threading
# headers is still taken for the colleague's answer
_FORWARD_FALLBACK_DAYS = 60
_SUBJECT_PREFIX_RE = re.compile(
    r"^\s*((re|fwd?|fw|отв|пер|ответ|переслать)\s*(\[\d+\])?\s*:\s*)+",
    re.IGNORECASE,
)

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
                if msg.kind in (
                    MessageKind.FORWARD.value,
                    MessageKind.COLLEAGUE_REPLY.value,
                ):
                    # an answer to our forward: the colleague, not the supplier
                    return EmailMatchResult(rs, COLLEAGUE_MATCH, "high")
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

        forward = await _recent_forward_to(
            session,
            colleague_email=from_email,
            our_mailbox=to_email,
            subject=subject,
            mailbox_owner_id=mailbox_owner_id,
        )
        if forward is not None and forward.request_supplier is not None:
            return EmailMatchResult(
                forward.request_supplier, COLLEAGUE_MATCH, "medium"
            )

    return None


def subject_core(subject: str | None) -> str:
    """Subject without Re:/Fwd:/Отв: prefixes, case and extra spaces."""
    text = _SUBJECT_PREFIX_RE.sub("", subject or "")
    return " ".join(text.split()).casefold()


async def _recent_forward_to(
    session: AsyncSession,
    *,
    colleague_email: str,
    our_mailbox: str | None = None,
    subject: str | None,
    mailbox_owner_id: uuid.UUID | None,
) -> EmailMessage | None:
    """Our latest forward to this address with the same subject.

    Fallback for mail clients that drop In-Reply-To: an answer counts as the
    colleague's only when it comes from the address we forwarded to, about
    the same letter (same subject), to the mailbox the forward left from,
    within _FORWARD_FALLBACK_DAYS.
    """
    core = subject_core(subject)
    if not core:
        return None
    since = datetime.now(UTC) - timedelta(days=_FORWARD_FALLBACK_DAYS)
    stmt = (
        select(EmailMessage)
        .join(
            RequestSupplier,
            EmailMessage.request_supplier_id == RequestSupplier.id,
        )
        .join(Request, RequestSupplier.request_id == Request.id)
        .where(
            EmailMessage.kind == MessageKind.FORWARD.value,
            func.lower(EmailMessage.to_email) == colleague_email.lower(),
            EmailMessage.received_at >= since,
        )
        .options(
            selectinload(EmailMessage.request_supplier).selectinload(
                RequestSupplier.request
            )
        )
        .order_by(EmailMessage.received_at.desc())
    )
    if mailbox_owner_id is not None:
        stmt = stmt.where(Request.user_id == mailbox_owner_id)
    if our_mailbox:
        # the answer goes back to the mailbox the forward was sent from
        stmt = stmt.where(
            func.lower(EmailMessage.from_email) == our_mailbox.lower()
        )
    for forward in (await session.execute(stmt)).scalars().all():
        if subject_core(forward.subject) == core:
            return forward
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
