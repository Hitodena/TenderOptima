"""Helpers for letters we send from a supplier thread (replies, forwards)."""

from __future__ import annotations

import mimetypes
import re
from datetime import datetime

_TRACKING_TOKEN = re.compile(r"\s*\[TID-[A-Za-z0-9]{6,12}\]", re.IGNORECASE)


def strip_tracking(text: str | None) -> str:
    """Drop [TID-…] tokens.

    A forward to a colleague must not carry the supplier's tracking token,
    otherwise the colleague's answer would be filed as the supplier's reply.
    """
    return _TRACKING_TOKEN.sub("", text or "")


def build_forward_text(
    *,
    comment: str,
    sender_name: str,
    sender_email: str | None,
    received_at: datetime | None,
    subject: str | None,
    body: str,
) -> str:
    """Plain-text forward in the usual mail-client layout."""
    when = received_at.strftime("%d.%m.%Y %H:%M") if received_at else "—"
    sender = f"{sender_name} <{sender_email}>" if sender_email else sender_name
    head = [
        "---------- Пересланное сообщение ----------",
        f"От: {sender}",
        f"Дата: {when}",
        f"Тема: {strip_tracking(subject).strip()}",
        "",
    ]
    parts = [comment.strip(), ""] if comment and comment.strip() else []
    return "\n".join(parts + head) + "\n" + strip_tracking(body).strip() + "\n"


def forward_subject(subject: str | None) -> str:
    clean = strip_tracking(subject).strip()
    return f"Fwd: {clean or 'письмо поставщика'}"


def attachment_records(att_data: list[dict]) -> list[dict] | None:
    """JSON-safe attachment list for email_messages.attachments.

    The prepared items carry the file bytes for SMTP; the database keeps the
    same shape as incoming letters (name, type, size, path), never the bytes.
    """
    records = [
        {
            "filename": att["filename"],
            "content_type": mimetypes.guess_type(att["filename"])[0],
            "size": len(att["data"]),
            "path": att.get("path"),
        }
        for att in att_data
    ]
    return records or None
