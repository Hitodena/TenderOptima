"""Cutting an offer into its sections."""

from __future__ import annotations

import pytest

from backend.services.kp_compare import segments
from backend.services.kp_compare.segments import (
    KpPart,
    _boilerplate_lines,
    _locate_anchor,
    _own_position,
    segment_offer,
)
from backend.tests.kp_compare.helpers import OFFER, OUTLINE, FakeCalls


def _outline_handler(stage: str, system: str, user: str) -> dict:
    assert stage == "kp_outline"
    return {"sections": OUTLINE}


@pytest.mark.asyncio
async def test_sections_follow_the_headings_the_model_names() -> None:
    calls = FakeCalls(_outline_handler)
    document = await segment_offer([("offer.pdf", OFFER)], calls)
    titles = [(s.kind, s.title) for s in document.sections]
    assert titles == [
        ("other", "Начало КП"),
        ("equipment", "CHEESE VAT, mod. CV10"),
        ("equipment", "CIP PUMP"),
        ("deviations", "DEVIATIONS"),
        ("exclusions", "EXCLUSIONS"),
    ]
    vat = document.sections[1]
    # the bare «Item 1» line is merged into the section it heads
    assert vat.text.startswith("Item 1")
    assert vat.position == "Item 1"
    assert vat.label == "Item 1 «CHEESE VAT, mod. CV10»"
    assert (vat.page_from, vat.page_to) == (1, 1)
    assert [s.id for s in document.sections] == ["S1", "S2", "S3", "S4", "S5"]
    assert [s.is_shared for s in document.sections][3:] == [True, True]
    # every section is an exact slice of the offer, together they cover it
    assert "".join(s.text for s in document.sections) == OFFER
    assert calls.prompts[0][2] is False  # outline needs no reasoning


@pytest.mark.asyncio
async def test_unknown_headings_are_ignored() -> None:
    def handler(stage: str, system: str, user: str) -> dict:
        return {
            "sections": [{"anchor": "NOT IN THE TEXT", "kind": "equipment"}]
        }

    calls = FakeCalls(handler)
    document = await segment_offer([("offer.pdf", OFFER)], calls)
    assert len(document.sections) == 1
    assert calls.stats["kp_outline:anchor_missed"] == 1


@pytest.mark.asyncio
async def test_a_long_offer_without_sections_is_sliced_by_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(segments, "_FALLBACK_SLICE_CHARS", 300)
    pages = "".join(
        f"--- Страница {n} ---\n" + "text line\n" * 40 for n in range(1, 6)
    )
    calls = FakeCalls(lambda *a: {"sections": []})
    document = await segment_offer([("offer.pdf", pages)], calls)
    assert len(document.sections) > 1
    assert document.sections[0].title.startswith("Страниц")
    assert calls.stats["kp_outline:page_fallback"] == 1


def test_heading_found_at_line_start_not_inside_a_summary_row() -> None:
    text = (
        "SUMMARY\n1.1. n. 3 CHEESE VAT, mod. CVB100 6÷9 € 457.530,00\n"
        "Item 2\nn. 3 CHEESE VAT, mod. CVB100, fully jacketed\n"
    )
    part = KpPart("offer.pdf", text)
    offset = _locate_anchor(part, "n. 3 CHEESE VAT, mod. CVB100", 0, len(text))
    assert offset == text.index("n. 3 CHEESE VAT, mod. CVB100, fully")


def test_letterhead_lines_are_recognised() -> None:
    page = "ACME s.r.l.\nPage header line\n{body}\n"
    text = "".join(
        f"--- Страница {n} ---\n" + page.format(body=f"body {n}")
        for n in range(6)
    )
    lines = _boilerplate_lines(text)
    assert "acme s.r.l." in lines
    assert "body 1" not in lines


def test_position_kept_only_when_the_section_shows_it() -> None:
    assert _own_position("Item 6", "Item 6\nPUMP") == "Item 6"
    assert _own_position("1", "n. 3 CHEESE VAT") is None
    assert _own_position("Item 2", "n. 3 CHEESE VAT") is None
    assert _own_position(None, "anything") is None


def test_render_drops_letterhead_and_marks_pages() -> None:
    page = "ACME s.r.l.\nline {n}\n"
    text = "".join(
        f"--- Страница {n} ---\n" + page.format(n=n) for n in range(1, 6)
    )
    part = KpPart("offer.pdf", text)
    section = segments.KpSection(
        id="S1",
        file="offer.pdf",
        kind="other",
        title="t",
        title_ru="t",
        position=None,
        start=0,
        end=len(text),
        page_from=1,
        page_to=5,
        text=text,
    )
    document = segments.KpDocument(parts=[part], sections=[section])
    rendered = document.render(section)
    assert "ACME" not in rendered
    assert rendered.startswith("[стр. 1]\nline 1")
