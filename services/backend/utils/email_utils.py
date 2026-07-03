import email.utils
import re

from email_validator import EmailNotValidError, validate_email

from backend.db.models import EmailMessage, Request, User
from backend.enums import EmailMessageDirection
from backend.utils.user_utils import build_business_info

_RE_PREFIX_RE = re.compile(r"^re:\s*", re.IGNORECASE)


def build_request_email_body(
    request: Request,
    user: User,
) -> str:
    """Build email body for supplier request."""
    if request.email_message and request.email_message.strip():
        return request.email_message.strip()

    labels_block = ""

    params = request.additional_params
    if params:
        if isinstance(params, list) and params:
            labels_block = (
                "\n"
                + "\n".join(
                    f"{i}. {label}" for i, label in enumerate(params, 1)
                )
                + "\n"
            )

    return (
        "Добрый день.\n\n"
        "Направляем запрос для получения вашего коммерческого предложения на:\n\n"
        f"{request.description}\n\n"
        "! В вашем ответе обязательно укажите:\n"
        "-------------------------------------"
        f"{labels_block}"
        "-------------------------------------\n\n"
        ""
        "Важно: не меняйте тему сообщения в ответе, чтобы не потерять идентификатор отслеживания.\n\n"
        f"{user.business_info or build_business_info(user)}\n"
    )


def build_request_email_subject(request: Request) -> str:
    """Build email subject for supplier request (single source of truth + fallback).

    Uses user-provided subject if present and non-empty (after strip, capped to 255),
    otherwise the fixed default template based on request.query.

    Args:
        request: The request object (must have .email_subject and .query)

    Returns:
        Subject string safe for email header
    """
    if request.email_subject and request.email_subject.strip():
        return request.email_subject.strip()
    return f"Запрос коммерческого предложения — {request.query}"


def build_outbound_subject(request: Request, tracking_id: str) -> str:
    """Subject for the first outbound email to a supplier (includes TID)."""
    return f"{build_request_email_subject(request)} [TID-{tracking_id}]"


def message_id_domain(smtp_user: str) -> str:
    """Domain for Message-ID / References (use mailbox domain, not SMTP host)."""
    if "@" in smtp_user:
        return smtp_user.split("@", 1)[1]
    return "localhost"


def make_message_id(smtp_user: str) -> str:
    """Generate RFC 5322 Message-ID before SMTP send."""
    return email.utils.make_msgid(domain=message_id_domain(smtp_user))


def normalize_message_id(raw: str | None) -> str | None:
    """Ensure Message-ID is wrapped in angle brackets."""
    if not raw:
        return None
    cleaned = raw.strip()
    if not cleaned:
        return None
    inner = cleaned.strip("<>").strip()
    if not inner:
        return None
    return f"<{inner}>"


def encode_recipient_for_smtp(address: str) -> str:
    """Convert an email address to ASCII-safe form for SMTP envelope commands.

    IDN domains (e.g. база-дров.бел) are encoded to punycode so that
    smtplib's RCPT TO command does not raise UnicodeEncodeError.
    Raises ValueError if the address cannot be normalized.
    """
    try:
        result = validate_email(address.strip(), check_deliverability=False)
        ascii_address = result.ascii_email
        if ascii_address is None:
            raise ValueError(
                f"No ASCII representation for address: {address!r}"
            )
        return ascii_address
    except EmailNotValidError as exc:
        raise ValueError(f"Invalid email address {address!r}: {exc}") from exc


def reply_subject(original: str) -> str:
    """Prefix subject with Re: once (keeps TID and original wording)."""
    subject = original.strip()
    if _RE_PREFIX_RE.match(subject):
        return subject
    return f"Re: {subject}"


def resolve_reply_subject(
    request: Request,
    tracking_id: str | None,
    thread: list[EmailMessage],
) -> str:
    """Pick the subject line suppliers already see in the thread."""
    for message in reversed(thread):
        if message.subject and message.subject.strip():
            return reply_subject(message.subject)
    if tracking_id:
        return reply_subject(build_outbound_subject(request, tracking_id))
    return reply_subject(build_request_email_subject(request))


def build_threading_headers(
    thread: list[EmailMessage],
    fallback_message_id: str | None,
) -> tuple[str | None, str | None]:
    """Return (In-Reply-To, References) for a reply in an existing thread."""
    chain: list[str] = []
    for message in thread:
        mid = normalize_message_id(message.message_id)
        if mid and mid not in chain:
            chain.append(mid)

    in_reply_to: str | None = None
    for message in reversed(thread):
        if (
            message.direction == EmailMessageDirection.INCOMING.value
            and message.message_id
        ):
            in_reply_to = normalize_message_id(message.message_id)
            break
    if not in_reply_to:
        for message in reversed(thread):
            if message.message_id:
                in_reply_to = normalize_message_id(message.message_id)
                break
    if not in_reply_to:
        in_reply_to = normalize_message_id(fallback_message_id)

    references = " ".join(chain) if chain else in_reply_to
    return in_reply_to, references
