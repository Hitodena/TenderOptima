"""Forward text and JSON-safe attachment records."""

import json
from datetime import UTC, datetime

from backend.utils.email_outgoing import (
    attachment_records,
    build_forward_text,
    forward_subject,
    strip_tracking,
)


def test_strip_tracking_removes_every_token():
    assert strip_tracking("Запрос КП [TID-ABC123] и [tid-zz99yy88]") == "Запрос КП и"
    assert strip_tracking(None) == ""
    assert strip_tracking("без метки") == "без метки"


def test_forward_subject():
    assert forward_subject("Re: Запрос КП [TID-ABC123]") == "Fwd: Re: Запрос КП"
    assert forward_subject(None) == "Fwd: письмо поставщика"
    assert forward_subject(" [TID-ABC123] ") == "Fwd: письмо поставщика"


def test_forward_text_layout_and_no_tracking_token():
    text = build_forward_text(
        comment="Посмотри условия оплаты",
        sender_name="ООО «ЭлектроКомплект»",
        sender_email="sales@x.example.com",
        received_at=datetime(2026, 11, 6, 14, 32, tzinfo=UTC),
        subject="Re: КП [TID-ABC123]",
        body="Цена 82,36 руб.\n> Запрос [TID-ABC123]",
    )
    assert text.startswith("Посмотри условия оплаты\n\n---------- Пересланное сообщение")
    assert "От: ООО «ЭлектроКомплект» <sales@x.example.com>" in text
    assert "Дата: 06.11.2026 14:32" in text
    assert "Тема: Re: КП\n" in text
    assert "TID-" not in text
    assert "Цена 82,36 руб." in text


def test_forward_text_without_comment_email_or_date():
    text = build_forward_text(
        comment="  ",
        sender_name="Поставщик",
        sender_email=None,
        received_at=None,
        subject=None,
        body="текст",
    )
    assert text.startswith("---------- Пересланное сообщение")
    assert "От: Поставщик\n" in text
    assert "Дата: —" in text


def test_attachment_records_are_json_safe():
    records = attachment_records(
        [
            {"filename": "КП.pdf", "data": b"%PDF-1.4", "path": "/u/1/КП.pdf"},
            {"filename": "прайс.xlsx", "data": b"PK", "path": None},
            {"filename": "noext", "data": b""},
        ]
    )
    json.dumps(records)  # bytes would raise here
    assert records[0] == {
        "filename": "КП.pdf",
        "content_type": "application/pdf",
        "size": 8,
        "path": "/u/1/КП.pdf",
    }
    assert records[1]["content_type"].endswith("spreadsheetml.sheet")
    assert records[2]["content_type"] is None
    assert records[2]["path"] is None


def test_attachment_records_empty():
    assert attachment_records([]) is None
