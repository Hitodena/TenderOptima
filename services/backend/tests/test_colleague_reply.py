"""A colleague's answer to a forwarded supplier letter.

The answer must land in the same supplier thread as a colleague note, never
as the supplier's letter: no AI analysis, no "replied" status, no part in the
threading of letters to the supplier.
"""

from __future__ import annotations

import asyncio
import functools
import uuid
from types import SimpleNamespace

import pytest

from backend.utils import email_matching
from backend.utils.email_content import NOT_DIALOGUE_KINDS, MessageKind
from backend.utils.email_matching import (
    COLLEAGUE_MATCH,
    match_incoming_email,
    subject_core,
)
from backend.utils.email_outgoing import forward_subject


def sync(fn):
    """Run an async test without a pytest async plugin."""

    @functools.wraps(fn)
    def run(*args, **kwargs):
        return asyncio.run(fn(*args, **kwargs))

    return run


OTHER_OWNER = uuid.uuid4()
OWNER = uuid.uuid4()


def _rs(owner=OWNER):
    return SimpleNamespace(
        id=uuid.uuid4(),
        request=SimpleNamespace(user_id=owner),
        supplier=SimpleNamespace(main_email="sales@supplier.by"),
        sent_to_email="sales@supplier.by",
    )


def _stored(kind, rs):
    return SimpleNamespace(kind=kind, request_supplier=rs)


class _EmptyResult:
    def scalars(self):
        return self

    def all(self):
        return []


class _Session:
    """No supplier candidates for the sender lookup."""

    async def execute(self, _stmt):
        return _EmptyResult()


@pytest.fixture
def by_message_id(monkeypatch):
    """Map Message-ID -> stored letter for EmailMessageDAO.get_by_message_id."""
    table: dict[str, object] = {}

    async def fake(_session, mid):
        return table.get(mid)

    monkeypatch.setattr(
        email_matching.EmailMessageDAO, "get_by_message_id", fake
    )
    return table


@pytest.fixture
def no_forward_fallback(monkeypatch):
    async def none(*_a, **_k):
        return None

    monkeypatch.setattr(email_matching, "_recent_forward_to", none)


async def _match(**kw):
    args = dict(
        subject="Re: Fwd: Запрос КП — кабель",
        body="Цена нормальная, берём",
        from_email="ivan@ourcompany.by",
        to_email="buyer@ourcompany.by",
        in_reply_to=None,
        references=None,
        mailbox_owner_id=OWNER,
    )
    args.update(kw)
    return await match_incoming_email(_Session(), **args)


class TestSubjectCore:
    @pytest.mark.parametrize(
        "subject",
        [
            "Fwd: Запрос КП — кабель",
            "Re: Fwd: Запрос КП — кабель",
            "RE: FW:  Запрос КП —  кабель",
            "Отв: Пер: Запрос КП — кабель",
            "Re[2]: Fwd: Запрос КП — кабель",
            "Ответ: Fwd: Запрос КП — кабель",
            "  запрос кп — КАБЕЛЬ ",
        ],
    )
    def test_prefixes_case_and_spaces_ignored(self, subject):
        assert subject_core(subject) == "запрос кп — кабель"

    def test_prefix_word_inside_subject_kept(self):
        assert subject_core("Fwd: Ответ на запрос") == "ответ на запрос"

    def test_empty(self):
        assert subject_core(None) == ""
        assert subject_core("Re: Fwd:") == ""

    def test_forward_subject_matches_its_answers(self):
        sent = forward_subject("Re: Запрос КП — кабель [TID-ab12cd34]")
        assert "TID" not in sent
        assert subject_core("Re: " + sent) == subject_core(sent)


class TestMatchByHeaders:
    @sync
    async def test_answer_to_forward_is_colleague(
        self, by_message_id, no_forward_fallback
    ):
        rs = _rs()
        by_message_id["<fwd-1@ourcompany.by>"] = _stored(
            MessageKind.FORWARD.value, rs
        )
        m = await _match(in_reply_to="<fwd-1@ourcompany.by>")
        assert m.request_supplier is rs
        assert m.matched_by == COLLEAGUE_MATCH

    @sync
    async def test_found_through_references_only(
        self, by_message_id, no_forward_fallback
    ):
        rs = _rs()
        by_message_id["<fwd-1@ourcompany.by>"] = _stored(
            MessageKind.FORWARD.value, rs
        )
        m = await _match(references="<x@elsewhere> <fwd-1@ourcompany.by>")
        assert m.matched_by == COLLEAGUE_MATCH

    @sync
    async def test_second_round_with_colleague_stays_colleague(
        self, by_message_id, no_forward_fallback
    ):
        """Colleague answers the colleague's own earlier note."""
        rs = _rs()
        by_message_id["<note-1@ourcompany.by>"] = _stored(
            MessageKind.COLLEAGUE_REPLY.value, rs
        )
        m = await _match(in_reply_to="<note-1@ourcompany.by>")
        assert m.matched_by == COLLEAGUE_MATCH

    @sync
    async def test_supplier_letter_reference_stays_supplier(
        self, by_message_id, no_forward_fallback
    ):
        rs = _rs()
        by_message_id["<rfq@ourcompany.by>"] = _stored(None, rs)
        m = await _match(
            in_reply_to="<rfq@ourcompany.by>", from_email="sales@supplier.by"
        )
        assert m.matched_by == "message_id"

    @sync
    async def test_tracking_id_still_wins(
        self, by_message_id, no_forward_fallback, monkeypatch
    ):
        rs_supplier = _rs()

        async def by_tid(_s, tid):
            return rs_supplier if tid == "ab12cd34" else None

        monkeypatch.setattr(
            email_matching.RequestSupplierDAO, "get_by_tracking_id", by_tid
        )
        by_message_id["<fwd-1@ourcompany.by>"] = _stored(
            MessageKind.FORWARD.value, _rs()
        )
        m = await _match(
            subject="Re: Запрос КП [TID-ab12cd34]",
            in_reply_to="<fwd-1@ourcompany.by>",
        )
        assert m.request_supplier is rs_supplier
        assert m.matched_by == "tracking_id"

    @sync
    async def test_other_users_forward_ignored(
        self, by_message_id, no_forward_fallback
    ):
        by_message_id["<fwd-1@ourcompany.by>"] = _stored(
            MessageKind.FORWARD.value, _rs(owner=OTHER_OWNER)
        )
        assert await _match(in_reply_to="<fwd-1@ourcompany.by>") is None

    @sync
    async def test_unknown_letter_not_matched(
        self, by_message_id, no_forward_fallback
    ):
        assert await _match(in_reply_to="<nobody@x>") is None


class TestMatchBySenderFallback:
    @sync
    async def test_fallback_used_when_headers_missing(
        self, by_message_id, monkeypatch
    ):
        rs = _rs()
        calls = []

        async def forward_to(_session, **kw):
            calls.append(kw)
            return _stored(MessageKind.FORWARD.value, rs)

        monkeypatch.setattr(email_matching, "_recent_forward_to", forward_to)
        m = await _match()
        assert m.request_supplier is rs
        assert m.matched_by == COLLEAGUE_MATCH
        assert m.match_confidence == "medium"
        assert calls[0]["colleague_email"] == "ivan@ourcompany.by"
        assert calls[0]["mailbox_owner_id"] == OWNER
        assert calls[0]["our_mailbox"] == "buyer@ourcompany.by"

    @sync
    async def test_no_sender_no_fallback(self, by_message_id, monkeypatch):
        async def boom(*_a, **_k):
            raise AssertionError("must not be called")

        monkeypatch.setattr(email_matching, "_recent_forward_to", boom)
        assert await _match(from_email=None) is None


class _ForwardRows:
    def __init__(self, rows):
        self.rows = rows

    def scalars(self):
        return self

    def all(self):
        return self.rows


class _ForwardSession:
    def __init__(self, rows):
        self.rows = rows

    async def execute(self, _stmt):
        return _ForwardRows(self.rows)


class TestRecentForwardSubject:
    @sync
    async def test_same_subject_found(self):
        fwd = SimpleNamespace(subject="Fwd: Запрос КП — кабель")
        got = await email_matching._recent_forward_to(
            _ForwardSession([fwd]),
            colleague_email="ivan@ourcompany.by",
            subject="Re: Fwd: Запрос КП — кабель",
            mailbox_owner_id=OWNER,
        )
        assert got is fwd

    @sync
    async def test_other_subject_is_not_an_answer(self):
        """A new letter from the colleague about something else."""
        fwd = SimpleNamespace(subject="Fwd: Запрос КП — кабель")
        got = await email_matching._recent_forward_to(
            _ForwardSession([fwd]),
            colleague_email="ivan@ourcompany.by",
            subject="Обед в пятницу",
            mailbox_owner_id=OWNER,
        )
        assert got is None

    @sync
    async def test_latest_matching_forward_wins(self):
        newer = SimpleNamespace(subject="Fwd: Запрос КП — кабель")
        older = SimpleNamespace(subject="Fwd: Запрос КП — кабель")
        got = await email_matching._recent_forward_to(
            _ForwardSession([newer, older]),  # query orders newest first
            colleague_email="ivan@ourcompany.by",
            subject="Re: Fwd: Запрос КП — кабель",
            mailbox_owner_id=OWNER,
        )
        assert got is newer

    @sync
    async def test_empty_subject_never_matches(self):
        fwd = SimpleNamespace(subject="Fwd:")
        got = await email_matching._recent_forward_to(
            _ForwardSession([fwd]),
            colleague_email="ivan@ourcompany.by",
            subject="Re:",
            mailbox_owner_id=OWNER,
        )
        assert got is None


def test_colleague_notes_are_not_supplier_dialogue():
    assert MessageKind.FORWARD.value in NOT_DIALOGUE_KINDS
    assert MessageKind.COLLEAGUE_REPLY.value in NOT_DIALOGUE_KINDS
    # stored in email_messages.kind String(16)
    assert len(MessageKind.COLLEAGUE_REPLY.value) <= 16
