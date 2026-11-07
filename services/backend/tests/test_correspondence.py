"""Correspondence feed: clean text, robots, summary and document versions."""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from backend.services.correspondence import build_summary, build_thread

T0 = datetime(2026, 11, 3, 10, 0, tzinfo=UTC)


@dataclass
class FakeAnalysis:
    status: str = "active"
    raw_llm_response: dict | None = None
    previous_parameters: dict | None = None


@dataclass
class FakeMessage:
    direction: str = "incoming"
    kind: str | None = None
    subject: str | None = "Re: КП"
    raw_body: str | None = ""
    extracted_text: str | None = None
    attachments: list | None = None
    received_at: datetime = T0
    to_email: str | None = None
    analysis: FakeAnalysis | None = None
    id: uuid.UUID = field(default_factory=uuid.uuid4)


def att(name: str, ctype: str = "application/pdf") -> dict:
    return {
        "filename": name,
        "content_type": ctype,
        "size": 100,
        "path": f"/u/{name}",
    }


def analysis(
    matches: list[dict], previous: dict | None = None, status="active"
):
    return FakeAnalysis(
        status=status,
        raw_llm_response={"parameters": {}, "matches": matches},
        previous_parameters=previous,
    )


def m(req, value, status="met"):
    return {"requirement": req, "offer_value": value, "status": status}


# ------------------------------------------------------------ text


def test_incoming_uses_full_original_text_for_the_quote():
    # raw_body lost the "> " lines at ingest; extracted_text keeps them
    msg = FakeMessage(
        raw_body="Да.\n\nпн, 3 нояб. 2026 г. в 10:05, Закупки <b@x.ru>:",
        extracted_text="Да.\n\nпн, 3 нояб. 2026 г. в 10:05, Закупки <b@x.ru>:\n> Просим КП",
    )
    view = build_thread([msg])[0]
    assert view.body_text == "Да."
    assert "> Просим КП" in view.quoted_text


def test_html_original_falls_back_to_raw_body():
    msg = FakeMessage(
        raw_body="Текст письма",
        extracted_text="<html><body>Текст</body></html>",
    )
    assert build_thread([msg])[0].body_text == "Текст письма"


def test_outgoing_uses_raw_body():
    msg = FakeMessage(
        direction="outgoing", raw_body="Просим КП", extracted_text="другое"
    )
    assert build_thread([msg])[0].body_text == "Просим КП"


def test_empty_letter():
    view = build_thread([FakeMessage(raw_body=None, extracted_text=None)])[0]
    assert view.body_text == "" and view.quoted_text == ""


# ------------------------------------------------------------ robots / decline


def test_robot_letters_get_no_summary_and_no_decline():
    a = analysis([m("Цена", "100 руб.")])
    bounce = FakeMessage(kind="bounce", raw_body="нет в наличии", analysis=a)
    view = build_thread([bounce])[0]
    assert view.kind == "bounce"
    assert view.summary is None
    assert view.is_decline is False


def test_decline_flag_on_supplier_letter():
    v = build_thread(
        [FakeMessage(raw_body="К сожалению, нет в наличии до января.")]
    )[0]
    assert v.is_decline is True


def test_decline_ignores_the_quote():
    # our own request quoted below must not make the reply look like a refusal
    msg = FakeMessage(
        raw_body="Цена 98 руб./м\n\n-----Original Message-----\nЕсли не можем предложить — сообщите"
    )
    assert build_thread([msg])[0].is_decline is False


def test_outgoing_is_never_a_decline():
    v = build_thread(
        [FakeMessage(direction="outgoing", raw_body="нет в наличии")]
    )[0]
    assert v.is_decline is False


# ------------------------------------------------------------ summary


def test_summary_none_without_analysis():
    assert build_summary(None) is None


def test_summary_processing_and_failed():
    assert (
        build_summary(FakeAnalysis(status="processing")).status == "processing"
    )
    assert build_summary(FakeAnalysis(status="failed")).status == "failed"


def test_summary_without_result_is_none():
    assert (
        build_summary(FakeAnalysis(status="active", raw_llm_response=None))
        is None
    )


def test_summary_broken_result_is_none():
    assert build_summary(FakeAnalysis(raw_llm_response={"oops": 1})) is None


def test_summary_counts_and_changes():
    s = build_summary(
        analysis(
            [
                m("Марка кабеля", "ВВГнг(А)-LS"),
                m("Срок поставки", "10 дней"),
                m("Гарантия", None, "not_found"),
                m("Длина на барабане", "", "missing"),
                m("Упаковка", "барабан", "not_compare"),
                m("Цена за единицу без НДС", "82,36 руб.", "partial"),
            ],
            previous={
                "Срок поставки": "14 дней",
                "Цена за единицу без НДС": "82,36 руб.",
            },
        )
    )
    assert s.status == "ready"
    assert s.total == 5  # not_compare excluded
    assert s.met == 2
    assert [f.requirement for f in s.facts][
        0
    ] == "Цена за единицу без НДС"  # price first
    assert s.changed == 1  # same price is not a change
    deadline = next(f for f in s.facts if f.requirement == "Срок поставки")
    assert deadline.changed and deadline.previous == "14 дней"
    # empty and not found values are not shown
    assert all(
        f.requirement not in ("Гарантия", "Длина на барабане") for f in s.facts
    )


def test_summary_limits_facts():
    s = build_summary(analysis([m(f"П{i}", str(i)) for i in range(10)]))
    assert len(s.facts) == 6
    assert s.total == 10


# ------------------------------------------------------------ versions


def test_offer_versions_across_letters():
    first = FakeMessage(
        attachments=[att("КП_418.pdf"), att("Карточка_предприятия.pdf")],
        received_at=T0,
    )
    ours = FakeMessage(
        direction="outgoing",
        attachments=[att("КП_наше.pdf")],
        received_at=T0 + timedelta(hours=1),
    )
    second = FakeMessage(
        attachments=[
            att("КП_418_v2.pdf"),
            att("Прайс.xlsx", "application/vnd.ms-excel"),
        ],
        received_at=T0 + timedelta(days=1),
    )
    v = build_thread([first, ours, second])
    kp1 = v[0].attachments[0]
    kp2 = v[2].attachments[0]
    assert (kp1.doc_type, kp1.version, kp1.is_latest) == ("offer", 1, False)
    assert kp1.replaced_by_message_id == str(second.id)
    assert (kp2.version, kp2.is_latest, kp2.replaced_by_message_id) == (
        2,
        True,
        None,
    )
    # a single price list and the company card are not versioned
    assert v[2].attachments[1].version is None
    assert v[0].attachments[1].doc_type == "company_card"
    assert v[0].attachments[1].version is None
    # our own files are never versioned
    assert v[1].attachments[0].version is None


def test_two_offers_in_one_letter_are_parts_not_versions():
    v = build_thread(
        [FakeMessage(attachments=[att("КП_часть1.pdf"), att("КП_часть2.pdf")])]
    )
    assert [a.version for a in v[0].attachments] == [None, None]


def test_three_versions_and_parts():
    a = FakeMessage(attachments=[att("КП.pdf")], received_at=T0)
    b = FakeMessage(
        attachments=[att("КП_1.pdf"), att("КП_2.pdf")],
        received_at=T0 + timedelta(days=1),
    )
    c = FakeMessage(
        attachments=[att("КП_итог.pdf")], received_at=T0 + timedelta(days=2)
    )
    v = build_thread([a, b, c])
    assert v[0].attachments[0].version == 1
    assert [x.version for x in v[1].attachments] == [2, 2]
    assert all(x.replaced_by_message_id == str(c.id) for x in v[1].attachments)
    assert (v[2].attachments[0].version, v[2].attachments[0].is_latest) == (
        3,
        True,
    )


def test_robot_letter_attachments_are_not_versions():
    a = FakeMessage(attachments=[att("КП.pdf")], received_at=T0)
    bounce = FakeMessage(
        kind="bounce",
        attachments=[att("КП.pdf")],
        received_at=T0 + timedelta(hours=1),
    )
    v = build_thread([a, bounce])
    assert v[0].attachments[0].version is None
    assert v[1].attachments[0].version is None


def test_bad_attachment_entries_are_skipped():
    v = build_thread([FakeMessage(attachments=["junk", None, att("КП.pdf")])])
    assert [x.filename for x in v[0].attachments] == ["КП.pdf"]


def test_attachment_without_name():
    v = build_thread(
        [FakeMessage(attachments=[{"filename": None, "content_type": None}])]
    )
    assert v[0].attachments[0].filename == "файл"
    assert v[0].attachments[0].doc_label == "Файл"
