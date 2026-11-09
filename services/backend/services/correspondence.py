"""Build the supplier correspondence feed shown on the "Ответы" page.

Pure functions over stored rows (no database access) so they are easy to
test: clean text and quote, robot letters, refusal hint, a short summary of
the AI analysis per letter and document type / version per attachment.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from backend.enums import EmailMessageDirection, TZAnalysisRunStatus
from backend.schemas.analysis import EmailAnalysisResult
from backend.utils.comparison_price import is_price_requirement
from backend.utils.email_content import (
    DOC_TYPE_LABELS,
    DocType,
    classify_attachment,
    letter_text,
    looks_like_decline,
    split_quoted_reply,
)

# Offers and price lists are the documents suppliers re-send: number them.
VERSIONED_DOC_TYPES = (DocType.OFFER, DocType.PRICE)
SUMMARY_MAX_FACTS = 6


class _AnalysisLike(Protocol):
    status: str
    raw_llm_response: dict | None
    previous_parameters: dict | None


class _MessageLike(Protocol):
    id: Any
    direction: str
    kind: str | None
    subject: str | None
    raw_body: str | None
    extracted_text: str | None
    attachments: list | None
    received_at: Any
    to_email: str | None
    analysis: _AnalysisLike | None


@dataclass
class SummaryFact:
    requirement: str
    value: str
    status: str
    previous: str | None = None

    @property
    def changed(self) -> bool:
        return bool(self.previous) and self.previous != self.value


@dataclass
class LetterSummary:
    status: str  # "ready" | "processing" | "failed"
    facts: list[SummaryFact] = field(default_factory=list)
    met: int = 0
    total: int = 0
    changed: int = 0
    unread_files: list[str] = field(default_factory=list)


def build_summary(analysis: _AnalysisLike | None) -> LetterSummary | None:
    """Short digest of the AI analysis of one incoming letter."""
    if analysis is None:
        return None
    if analysis.status == TZAnalysisRunStatus.PROCESSING.value:
        return LetterSummary(status="processing")
    if analysis.status == TZAnalysisRunStatus.FAILED.value:
        return LetterSummary(status="failed")
    if not analysis.raw_llm_response:
        return None
    try:
        result = EmailAnalysisResult(**analysis.raw_llm_response)
    except Exception:
        return None
    previous = (
        analysis.previous_parameters
        if isinstance(analysis.previous_parameters, dict)
        else {}
    )
    facts: list[SummaryFact] = []
    met = total = 0
    for match in result.matches:
        status = match.status.value
        if status != "not_compare":
            total += 1
            if status == "met":
                met += 1
        value = (match.offer_value or "").strip()
        if not value or status == "not_found":
            continue
        prev_raw = previous.get(match.requirement)
        prev = str(prev_raw).strip() if prev_raw not in (None, "") else None
        facts.append(
            SummaryFact(
                requirement=match.requirement.strip(),
                value=value,
                status=status,
                previous=prev,
            )
        )
    # price first, then what changed, then the rest in the request's order
    facts.sort(
        key=lambda f: (
            not is_price_requirement(f.requirement),
            not f.changed,
        )
    )
    return LetterSummary(
        status="ready",
        facts=facts[:SUMMARY_MAX_FACTS],
        met=met,
        total=total,
        changed=sum(1 for f in facts if f.changed),
        unread_files=list(result.unread_files),
    )


@dataclass
class AttachmentView:
    filename: str
    content_type: str | None
    size: int | None
    path: str | None
    doc_type: str
    doc_label: str
    version: int | None = None
    is_latest: bool = True
    replaced_by_message_id: str | None = None


@dataclass
class MessageView:
    id: Any
    direction: str
    kind: str | None
    subject: str | None
    raw_body: str | None
    body_text: str
    quoted_text: str
    received_at: Any
    to_email: str | None
    is_decline: bool
    summary: LetterSummary | None
    attachments: list[AttachmentView]
    # shown for a colleague's answer, whose sender is not the supplier
    from_email: str | None = None


def build_thread(messages: list[_MessageLike]) -> list[MessageView]:
    """Thread view, oldest first, with versions of re-sent documents."""
    views: list[MessageView] = []
    # doc type -> [(message index, attachment index)] in time order
    versioned: dict[DocType, list[tuple[int, int]]] = {}

    for m_idx, message in enumerate(messages):
        split = split_quoted_reply(letter_text(message))
        incoming = message.direction == EmailMessageDirection.INCOMING.value
        ordinary = message.kind is None
        attachments: list[AttachmentView] = []
        for raw in message.attachments or []:
            if not isinstance(raw, dict):
                continue
            a_idx = len(attachments)
            filename = str(raw.get("filename") or "файл")
            doc_type = classify_attachment(filename, raw.get("content_type"))
            attachments.append(
                AttachmentView(
                    filename=filename,
                    content_type=raw.get("content_type"),
                    size=raw.get("size"),
                    path=raw.get("path"),
                    doc_type=doc_type.value,
                    doc_label=DOC_TYPE_LABELS[doc_type],
                )
            )
            if incoming and ordinary and doc_type in VERSIONED_DOC_TYPES:
                versioned.setdefault(doc_type, []).append((m_idx, a_idx))
        views.append(
            MessageView(
                id=message.id,
                direction=message.direction,
                kind=message.kind,
                subject=message.subject,
                raw_body=message.raw_body,
                body_text=split.main,
                quoted_text=split.quoted,
                received_at=message.received_at,
                to_email=message.to_email,
                from_email=getattr(message, "from_email", None),
                is_decline=incoming
                and ordinary
                and looks_like_decline(split.main),
                summary=build_summary(message.analysis)
                if incoming and ordinary
                else None,
                attachments=attachments,
            )
        )

    # Several files of one type in one letter are parts, not versions: a
    # version is a later letter that brings the same type of document again.
    for positions in versioned.values():
        letters = sorted({m for m, _ in positions})
        if len(letters) < 2:
            continue
        for number, m_idx in enumerate(letters, start=1):
            next_letter = letters[number] if number < len(letters) else None
            for pos_m, pos_a in positions:
                if pos_m != m_idx:
                    continue
                att = views[pos_m].attachments[pos_a]
                att.version = number
                att.is_latest = next_letter is None
                if next_letter is not None:
                    att.replaced_by_message_id = str(views[next_letter].id)
    return views
