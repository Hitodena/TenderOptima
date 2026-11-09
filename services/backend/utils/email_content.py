"""Read supplier letters for the correspondence feed.

Everything here is a display aid computed from the stored letter: the new
text vs. the quoted history, what kind of letter it is (a real reply, an
automatic reply or a delivery failure), whether it reads like a refusal and
what document each attachment is. Nothing is deleted: the full text stays in
the database and the quoted part is returned separately.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from email.message import Message as MimeMessage
from enum import StrEnum
from typing import Any

# --------------------------------------------------------------------------
# New text vs. quoted history
# --------------------------------------------------------------------------

_SEPARATOR_MARKERS = (
    # -----Original Message----- / -------- Пересылаемое сообщение --------
    re.compile(
        r"^\s*-{2,}\s*(original message|исходное сообщение|пересылаемое "
        r"сообщение|forwarded message|переадресованное сообщение)\s*-{2,}\s*$",
        re.IGNORECASE,
    ),
    # "On Mon, ... Ivan <a@b.ru> wrote:" / "... пишет:" / "... написал(а):"
    re.compile(
        r"^\s*\S.{0,200}\s(wrote|пишет|написал\(а\)|написала?)\s*:\s*$",
        re.IGNORECASE,
    ),
    # Gmail (RU): "пн, 3 нояб. 2026 г. в 10:05, Иван <a@b.ru>:"
    re.compile(
        r"^\s*\S.{0,160}\d{1,2}:\d{2}.{0,80}<[^<>\s]+@[^<>\s]+>\s*:\s*$"
    ),
)
_HEADER_FROM = re.compile(
    r"^\s*\*?(from|от|отправитель)\s*:\*?\s+\S", re.IGNORECASE
)
_HEADER_FOLLOW = re.compile(
    r"^\s*\*?(sent|date|отправлено|дата|to|кому|subject|тема)\s*:\*?",
    re.IGNORECASE,
)
_UNDERSCORE_RULE = re.compile(r"^\s*_{8,}\s*$")
_QUOTE_LINE = re.compile(r"^\s*>")


@dataclass(frozen=True)
class SplitLetter:
    main: str
    quoted: str


def _is_outlook_header(lines: list[str], i: int) -> bool:
    if i >= len(lines) or not _HEADER_FROM.match(lines[i]):
        return False
    return any(
        _HEADER_FOLLOW.match(lines[k])
        for k in range(i + 1, min(i + 5, len(lines)))
    )


def _quote_start(lines: list[str]) -> int:
    for i, line in enumerate(lines):
        if any(r.match(line) for r in _SEPARATOR_MARKERS):
            return i
        if _UNDERSCORE_RULE.match(line) and _is_outlook_header(lines, i + 1):
            return i
        if _is_outlook_header(lines, i):
            return i
    start = -1
    for i in range(len(lines) - 1, -1, -1):
        if not lines[i].strip():
            continue
        if _QUOTE_LINE.match(lines[i]):
            start = i
        else:
            break
    return start


_BLOCK_TAGS = (
    "p",
    "div",
    "tr",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "table",
    "blockquote",
    "section",
    "article",
)


def _table_to_markdown(table: Any) -> str | None:
    """A data table as «| a | b |» rows (the price checks read these).

    Layout tables (one cell per row, used by mail clients to position the
    text) are left alone and read as plain text.
    """
    rows: list[list[str]] = []
    for tr in table.find_all("tr"):
        cells = [
            " ".join(cell.get_text(" ", strip=True).split()).replace("|", "/")
            for cell in tr.find_all(["td", "th"], recursive=False)
        ]
        if any(cells):
            rows.append(cells)
    if len(rows) < 2 or max(len(r) for r in rows) < 2:
        return None
    width = max(len(r) for r in rows)
    lines = [
        "| " + " | ".join(r + [""] * (width - len(r))) + " |" for r in rows
    ]
    lines.insert(1, "|" + " --- |" * width)
    return "\n".join(lines)


def html_to_text(html: str) -> str:
    """Readable text of an HTML-only letter; data tables become markdown."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "head", "title", "meta"]):
        tag.decompose()
    # innermost tables first: a layout table often wraps the data table
    for table in reversed(soup.find_all("table")):
        md = _table_to_markdown(table)
        if md is not None:
            table.replace_with(f"\n{md}\n")
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for block in soup.find_all(_BLOCK_TAGS):
        block.append("\n")
    text = soup.get_text()
    out: list[str] = []
    for raw in text.splitlines():
        line = (
            raw.strip()
            if raw.lstrip().startswith("|")
            else " ".join(raw.split())
        )
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip()


def _decode_part(part: MimeMessage) -> str:
    payload = part.get_payload(decode=True)
    if not isinstance(payload, bytes):
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:  # unknown charset name in the header
        return payload.decode("utf-8", errors="replace")


def extract_letter_body(msg: MimeMessage) -> str:
    """Text of the letter: the plain part, else the HTML part as text.

    Letters sent only as HTML (web mail, 1С, CRM) used to come out empty, and
    the analysis saw only the attachments. Attached .txt / .html files are
    not the body.
    """
    plain: str | None = None
    html: str | None = None
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        if part.is_multipart():
            continue
        if (part.get_content_disposition() or "") == "attachment":
            continue
        ctype = part.get_content_type()
        if ctype == "text/plain" and plain is None:
            text = _decode_part(part)
            if text.strip():
                plain = text
        elif ctype == "text/html" and html is None:
            text = _decode_part(part)
            if text.strip():
                html = text
    if plain is not None:
        return plain
    if html is not None:
        return html_to_text(html)
    return ""


def split_quoted_reply(body: str | None) -> SplitLetter:
    """Split a plain-text letter into what the sender wrote and the quote.

    Same rules as the web client (shared/utils/emailThread.ts), so old
    letters and fresh ones look the same.
    """
    text = (body or "").replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    start = _quote_start(lines)
    if start < 0:
        return SplitLetter(text.strip(), "")
    main = "\n".join(lines[:start]).strip()
    quoted = "\n".join(lines[start:]).strip()
    if not main:  # a pure forward: the marker is the first line
        return SplitLetter(text.strip(), "")
    return SplitLetter(main, quoted)


def _looks_like_html(text: str) -> bool:
    head = text[:2000].lower()
    return (
        "<html" in head or "<div" in head or "<body" in head or "<p>" in head
    )


def letter_text(message: Any) -> str:
    """Full text of the letter as written, quote included.

    raw_body of an incoming letter had every "> " line removed when it was
    stored; extracted_text keeps the plain-text part as received. HTML-only
    letters keep raw_body, which is the HTML converted to text.
    """
    if message.direction == "incoming":
        original = message.extracted_text or ""
        if original.strip() and not _looks_like_html(original):
            return original
    return message.raw_body or ""


# --------------------------------------------------------------------------
# Kind of letter: reply / automatic reply / delivery failure
# --------------------------------------------------------------------------


class MessageKind(StrEnum):
    """Stored in email_messages.kind; NULL means an ordinary letter."""

    BOUNCE = "bounce"  # delivery failure report from a mail server
    AUTO_REPLY = "auto_reply"  # out-of-office and other robot replies
    FORWARD = "forward"  # our forward of a supplier letter to a colleague
    # a colleague's answer to that forward: an internal note in the thread,
    # never the supplier's letter (no AI analysis, no status change)
    COLLEAGUE_REPLY = "colleague_reply"


# Letters that live in a supplier thread but are not part of the dialogue
# with the supplier: they never set the subject, In-Reply-To or status.
NOT_DIALOGUE_KINDS = (
    MessageKind.FORWARD.value,
    MessageKind.COLLEAGUE_REPLY.value,
)


_BOUNCE_SENDER = re.compile(
    r"^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@", re.IGNORECASE
)
_BOUNCE_SUBJECT = re.compile(
    r"(undeliver|delivery status notification \(failure\)|delivery "
    r"(has )?failed|mail delivery (failed|subsystem)|returned mail|failure "
    r"notice|не доставлено|недоставленное|не удалось доставить|"
    r"сообщение не доставлено|ошибка доставки)",
    re.IGNORECASE,
)
_AUTO_SUBJECT = re.compile(
    r"^\s*(автоответ|автоматический ответ|auto(matic)?[ -]?reply|out of "
    r"(the )?office|нет на месте|в отпуске|вне офиса)",
    re.IGNORECASE,
)


_DSN_ACTION = re.compile(
    r"^\s*action\s*:\s*(\w+)", re.IGNORECASE | re.MULTILINE
)


def _dsn_only_delayed(msg: MimeMessage) -> bool:
    """True when the delivery report lists only "Action: delayed"."""
    actions: list[str] = []
    for part in msg.walk():
        if part.get_content_type() != "message/delivery-status":
            continue
        payload = part.get_payload()
        chunks = payload if isinstance(payload, list) else [payload]
        for chunk in chunks:
            text = (
                chunk.as_string()
                if isinstance(chunk, MimeMessage)
                else str(chunk or "")
            )
            actions.extend(a.lower() for a in _DSN_ACTION.findall(text))
    return bool(actions) and all(a == "delayed" for a in actions)


def classify_message(
    *,
    subject: str | None,
    from_email: str | None,
    headers: MimeMessage | None = None,
) -> MessageKind | None:
    """Return BOUNCE / AUTO_REPLY for robot letters, None for a real reply."""
    subject = subject or ""
    sender = (from_email or "").strip().lower()
    content_type = ""
    report_type = ""
    auto_submitted = ""
    if headers is not None:
        content_type = headers.get_content_type().lower()
        report_type = (
            (headers.get_param("report-type") or "").__str__().lower()
        )
        auto_submitted = (headers.get("Auto-Submitted") or "").strip().lower()

    is_report = (
        content_type == "multipart/report" and report_type == "delivery-status"
    )
    robot_sender = bool(_BOUNCE_SENDER.match(sender))
    if is_report or (robot_sender and _BOUNCE_SUBJECT.search(subject)):
        # "Delivery delayed" warnings are not failures: the server keeps trying
        if headers is not None and _dsn_only_delayed(headers):
            return MessageKind.AUTO_REPLY
        return MessageKind.BOUNCE
    if robot_sender:
        # other notices from a mail server: keep them out of the analysis
        return MessageKind.AUTO_REPLY

    if headers is not None:
        if auto_submitted and auto_submitted != "no":
            return MessageKind.AUTO_REPLY
        if headers.get("X-Autoreply") or headers.get("X-Autorespond"):
            return MessageKind.AUTO_REPLY
        precedence = (headers.get("Precedence") or "").strip().lower()
        if precedence == "auto_reply":
            return MessageKind.AUTO_REPLY
    if _AUTO_SUBJECT.search(subject):
        return MessageKind.AUTO_REPLY
    return None


# --------------------------------------------------------------------------
# Refusal
# --------------------------------------------------------------------------

# Deliberately narrow: a false "отказ" hides a real offer, so only clear
# phrases count. The result is shown as a hint, never acted upon.
_DECLINE_PATTERNS = (
    r"нет в наличии",
    r"отсутству\w* (на складе|в наличии)",
    r"не (можем|сможем|имеем возможности|готовы|будем) (предложить|поставить|"
    r"принять участие|участвовать|выполнить|осуществить поставку)",
    r"вынуждены отказаться",
    r"отказываемся от участия",
    r"не (занимаемся|работаем с|поставляем|производим|торгуем)",
    r"не наш профиль",
    r"(данн\w+|такую|такой|эту) продукци\w+ не (поставляем|производим|продаём|продаем)",
    r"\b(we )?(are )?(unable|not able) to (quote|offer|supply)",
    r"\bout of stock\b",
    r"\bno longer (available|supply)",
)
_DECLINE_RE = re.compile("|".join(_DECLINE_PATTERNS), re.IGNORECASE)
# "нет в наличии, но можем привезти под заказ" is an offer, not a refusal
_DECLINE_NEGATORS = re.compile(
    r"(под заказ|(?<!не )можем (предложить|привезти|поставить)|предлагаем|аналог|в течение \d|через \d|"
    r"срок поставки|цена|стоимость|руб\.?|₽|byn|usd|eur)",
    re.IGNORECASE,
)


def looks_like_decline(text: str | None) -> bool:
    """True when a short letter clearly says the supplier will not offer."""
    if not text:
        return False
    if not _DECLINE_RE.search(text):
        return False
    return not _DECLINE_NEGATORS.search(text)


# --------------------------------------------------------------------------
# What document an attachment is
# --------------------------------------------------------------------------


class DocType(StrEnum):
    OFFER = "offer"  # коммерческое предложение
    PRICE = "price"  # прайс-лист
    CERTIFICATE = "certificate"  # сертификат, декларация, паспорт
    INVOICE = "invoice"  # счёт
    CONTRACT = "contract"  # договор, спецификация к договору
    COMPANY_CARD = "company_card"  # карточка предприятия, реквизиты
    TECH_SPEC = "tech_spec"  # ТЗ, техническое описание, чертёж
    IMAGE = "image"
    OTHER = "other"


DOC_TYPE_LABELS: dict[DocType, str] = {
    DocType.OFFER: "КП",
    DocType.PRICE: "Прайс",
    DocType.CERTIFICATE: "Сертификат",
    DocType.INVOICE: "Счёт",
    DocType.CONTRACT: "Договор",
    DocType.COMPANY_CARD: "Карточка",
    DocType.TECH_SPEC: "ТЗ",
    DocType.IMAGE: "Фото",
    DocType.OTHER: "Файл",
}

_DOC_RULES: tuple[tuple[DocType, re.Pattern[str]], ...] = (
    (
        DocType.COMPANY_CARD,
        re.compile(r"(карточк|реквизит|card|requisit)", re.I),
    ),
    (
        DocType.CERTIFICATE,
        re.compile(
            r"(сертиф|декларац|паспорт|certif|declaration|\bсгр\b|\bеаэс\b|"
            r"протокол испыт|отказное)",
            re.I,
        ),
    ),
    (
        DocType.INVOICE,
        re.compile(r"(сч[её]т|invoice|\bсф\b|счет-фактур)", re.I),
    ),
    (
        DocType.CONTRACT,
        re.compile(r"(договор|contract|контракт|соглашен)", re.I),
    ),
    (
        DocType.PRICE,
        re.compile(r"(прайс|price|цены|расценк|прейскурант)", re.I),
    ),
    (
        DocType.OFFER,
        re.compile(
            r"(\bкп\b|кп[_\-\s.№]|коммерческ|предложени|offer|quotation|quote|"
            r"\brfq\b|\bтко\b|смета|расчет|расчёт)",
            re.I,
        ),
    ),
    (
        DocType.TECH_SPEC,
        re.compile(
            r"(\bтз\b|тз[_\-\s.]|техническ|спецификац|specification|чертеж|"
            r"чертёж|drawing|опросн)",
            re.I,
        ),
    ),
)
_IMAGE_EXT = {
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "heic",
    "bmp",
    "tif",
    "tiff",
}


def _normalize_name(filename: str) -> str:
    # underscores and dashes separate words in real file names
    return re.sub(r"[_\-]+", " ", filename)


def classify_attachment(
    filename: str | None, content_type: str | None = None
) -> DocType:
    name = filename or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    normalized = _normalize_name(name.rsplit(".", 1)[0] if ext else name)
    for doc_type, pattern in _DOC_RULES:
        if pattern.search(normalized):
            return doc_type
    if ext in _IMAGE_EXT or (content_type or "").lower().startswith("image/"):
        return DocType.IMAGE
    return DocType.OTHER
