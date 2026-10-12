"""The analysis task reaches the new comparison only behind its switch."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import TZAnalysisItem
from backend.services.analysis import tz
from backend.tests.kp_compare.helpers import tz as small_tz


@pytest.fixture
def offer_text(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(tz, "_assemble_document_text", lambda path: "КП текст")


@pytest.mark.asyncio
async def test_switch_on_runs_the_object_comparison(
    monkeypatch: pytest.MonkeyPatch, offer_text
) -> None:
    hierarchy, flat = small_tz()
    seen: dict = {}

    async def fake_run(parts, tz_flat, tz_hierarchy, kp_name, **kwargs):
        seen["parts"] = parts
        item = TZAnalysisItem(
            requirement=tz_flat[0],
            offer_value="10.000 l",
            offer_ref="Источник КП, стр 1, Item 1 «VAT»",
            explanation="ok",
            status=TZAnalysisStatus.MET,
        )
        return [item], {"1": {"text": "Item 1", "children": {}}}

    async def old_pipeline(*args, **kwargs):
        raise AssertionError("the earlier pipeline must not run")

    monkeypatch.setattr(tz.config, "kp_compare_v2_enabled", True)
    monkeypatch.setattr(tz, "run_kp_comparison", fake_run)
    monkeypatch.setattr(tz, "_run_staged_kp_analysis", old_pipeline)
    items, outline = await tz._match_kp_paths_against_tz(
        [Path("a/offer.pdf"), Path("a/annex.docx")],
        flat,
        hierarchy,
        "КП ACME",
        analysis_id="a",
        user_id="u",
    )
    assert seen["parts"] == [
        ("offer.pdf", "КП текст"),
        ("annex.docx", "КП текст"),
    ]
    assert outline == {"1": {"text": "Item 1", "children": {}}}
    # the TZ reference is filled in as for the earlier pipeline
    assert items[0].requirement_ref.startswith("Источник ТЗ")
    assert items[0].offer_ref == "Источник КП, стр 1, Item 1 «VAT»"


@pytest.mark.asyncio
async def test_switch_off_keeps_the_earlier_pipeline(
    monkeypatch: pytest.MonkeyPatch, offer_text
) -> None:
    hierarchy, flat = small_tz()

    async def old_pipeline(text, tz_flat, *args, **kwargs):
        return [], {"old": True}

    async def new_pipeline(*args, **kwargs):
        raise AssertionError("the new comparison must not run")

    monkeypatch.setattr(tz.config, "kp_compare_v2_enabled", False)
    monkeypatch.setattr(tz, "run_kp_comparison", new_pipeline)
    monkeypatch.setattr(tz, "_run_staged_kp_analysis", old_pipeline)
    _, outline = await tz._match_kp_paths_against_tz(
        [Path("offer.pdf")],
        flat,
        hierarchy,
        "КП",
        analysis_id="a",
        user_id="u",
    )
    assert outline == {"old": True}
