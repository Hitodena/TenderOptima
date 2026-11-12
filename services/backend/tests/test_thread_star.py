"""The buyer's star on a supplier thread reaches the thread list."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from backend.api.responses.schemas import StarPayload, ThreadSummary
from backend.schemas.thread import ThreadSummaryRow


def _message(starred: bool | None):
    supplier = SimpleNamespace(
        id=uuid.uuid4(),
        company_name="ООО Пример",
        main_email="sales@example.com",
        domain="example.com",
        extra_emails=None,
        phone=None,
        comments=None,
        from_source=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    rs = SimpleNamespace(
        id=uuid.uuid4(),
        supplier=supplier,
        thread_read_at=None,
        sent_status="replied",
        is_starred=starred,
    )
    return SimpleNamespace(
        id=uuid.uuid4(),
        direction="incoming",
        subject="КП",
        raw_body="Цена 10 руб.",
        body_text=None,
        extracted_text=None,
        received_at=datetime.now(UTC),
        kind=None,
        request_supplier=rs,
    )


@pytest.mark.parametrize(
    ("stored", "expected"), [(True, True), (False, False), (None, False)]
)
def test_star_is_carried_to_the_thread_list(stored, expected):
    row = ThreadSummaryRow.from_message(_message(stored), 1, unread=False)
    assert row.starred is expected
    assert ThreadSummary.from_row(row).starred is expected


def test_star_payload_needs_a_flag():
    assert StarPayload(starred=True).starred is True
    with pytest.raises(ValueError):
        StarPayload()  # type: ignore[call-arg]
