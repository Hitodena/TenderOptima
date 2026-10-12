"""The whole comparison on a small offer, with a stand-in for the model."""

from __future__ import annotations

import pytest

from backend.enums import TZAnalysisStatus
from backend.services.kp_compare import pipeline
from backend.services.kp_compare.calls import ModelAccessError
from backend.services.kp_compare.pipeline import (
    NOTE_WEAK_LINK,
    ComparisonFailedError,
    run_kp_comparison,
)
from backend.services.kp_compare.verdicts import NOTE_FAILED, NOTE_UNVERIFIED
from backend.tests.kp_compare.helpers import (
    OFFER,
    OUTLINE,
    FakeCalls,
    points_in,
    tz,
)

# what the model "finds", by TZ number
VERDICTS = {
    "1.1": ("met", "S2", "Maximum capacity: 10.000 liters, each one."),
    "1.2": ("met", "S2", "Insulation : ........ 50 mm"),
    "1.3": ("met", "S3", "Centrifugal pump, 5 kW, DN 50"),
    "2.1.1": ("not_found", "", ""),
    "2.1.2": ("not_found", "", ""),
    "3": ("not_found", "", ""),
}


def make_handler(verdicts: dict = VERDICTS, *, fail_verdicts: bool = False):
    def handler(stage: str, system: str, user: str) -> dict:
        if stage == "kp_outline":
            return {"sections": OUTLINE}
        if stage == "tz_objects":
            return {
                "objects": [
                    {"key": "1", "kind": "equipment", "title_ru": "Сыр."},
                    {"key": "2.1", "kind": "equipment", "title_ru": "Ёмк."},
                ]
            }
        if stage == "align_forward":
            return {"objects": [{"object": "O1", "sections": ["S2"]}]}
        if stage == "align_backward":
            return {
                "sections": [
                    {"section": "S2", "objects": ["O1"]},
                    {"section": "S3", "objects": ["O1"]},
                ]
            }
        if stage == "object_scope":
            return {
                "objects": [
                    {
                        "object": "O2",
                        "status": "excluded",
                        "quote": "Pasteurized water tank, valves and pump.",
                        "section": "S5",
                    }
                ]
            }
        if stage.startswith("verdict"):
            if fail_verdicts:
                raise RuntimeError("model is down")
            results = []
            for rid, number in points_in(user).items():
                status, section, quote = verdicts[number]
                results.append(
                    {
                        "id": rid,
                        "status": status,
                        "evidence": [{"section": section, "quote": quote}]
                        if quote
                        else [],
                        "offer_value": "есть" if quote else None,
                        "explanation": f"пункт {number}",
                    }
                )
            return {"results": results}
        raise AssertionError(f"unexpected stage {stage}")

    return handler


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch):
    holder: dict[str, FakeCalls] = {}

    def install(handler) -> dict[str, FakeCalls]:
        def factory(**kwargs) -> FakeCalls:
            holder["calls"] = FakeCalls(handler)
            return holder["calls"]

        monkeypatch.setattr(pipeline, "ModelCalls", factory)
        return holder

    return install


async def _run(**kwargs):
    hierarchy, flat = tz()
    items, outline = await run_kp_comparison(
        [("offer.pdf", OFFER)],
        flat,
        hierarchy,
        "КП ACME",
        analysis_id="a",
        user_id="u",
        **kwargs,
    )
    return flat, items, outline


@pytest.mark.asyncio
async def test_every_point_gets_a_verdict_in_document_order(fake) -> None:
    holder = fake(make_handler())
    flat, items, outline = await _run(thinking=False)
    assert [i.requirement for i in items] == flat
    by_number = {i.requirement.split(". ", 1)[0]: i for i in items}
    assert by_number["1.1"].status is TZAnalysisStatus.MET
    assert by_number["1.1"].offer_ref == (
        "Источник КП, стр 1, Item 1 «CHEESE VAT, mod. CV10»"
    )
    assert by_number["1.1"].offer_quote.startswith("Maximum capacity")
    # a dotted table row still counts as a quote of the offer
    assert by_number["1.2"].review_note is None
    assert by_number["3"].status is TZAnalysisStatus.NOT_FOUND
    assert by_number["3"].offer_value is None
    assert outline["2"]["text"].startswith("Item 1")
    stages = [stage for stage, _, _ in holder["calls"].prompts]
    assert stages.count("object_scope") == 1


@pytest.mark.asyncio
async def test_evidence_from_a_weakly_linked_section_is_marked(fake) -> None:
    fake(make_handler())
    _, items, _ = await _run(thinking=False)
    pump = next(i for i in items if i.requirement.startswith("1.3."))
    assert pump.status is TZAnalysisStatus.MET
    assert pump.review_note == NOTE_WEAK_LINK.format(
        label="Item 2 «CIP PUMP»", title="1 Сыроизготовитель"
    )


@pytest.mark.asyncio
async def test_an_excluded_object_fails_on_every_point(fake) -> None:
    fake(make_handler())
    _, items, _ = await _run(thinking=False)
    tank = [i for i in items if i.requirement.startswith("2.1.")]
    assert {i.status for i in tank} == {TZAnalysisStatus.MISSING}
    assert all("Pasteurized water tank" in i.offer_quote for i in tank)
    assert all("стр 2" in i.offer_ref for i in tank)


@pytest.mark.asyncio
async def test_the_offer_s_own_word_on_a_clause_reaches_the_model(
    fake,
) -> None:
    holder = fake(make_handler())
    await _run(thinking=False)
    tank_prompts = [
        user
        for stage, user, _ in holder["calls"].prompts
        if stage == "verdict" and "ТЗ п. 2.1.1" in user
    ]
    assert tank_prompts
    assert "КП о пункте: S4" in tank_prompts[0]
    assert "Buffer tank for pasteurized water" in tank_prompts[0]


@pytest.mark.asyncio
async def test_whole_offer_goes_to_every_verdict_call(fake) -> None:
    holder = fake(make_handler())
    await _run(thinking=True)
    verdict_calls = [
        (user, thinking)
        for stage, user, thinking in holder["calls"].prompts
        if stage == "verdict"
    ]
    assert verdict_calls and all(thinking for _, thinking in verdict_calls)
    assert all(
        "[S5 |" in user and "[S2 |" in user for user, _ in verdict_calls
    )


@pytest.mark.asyncio
async def test_an_invented_quote_is_marked_for_review(fake) -> None:
    verdicts = dict(VERDICTS)
    verdicts["1.1"] = ("met", "S2", "Capacity of 12.000 liters guaranteed")
    fake(make_handler(verdicts))
    _, items, _ = await _run(thinking=False)
    first = next(i for i in items if i.requirement.startswith("1.1."))
    assert first.status is TZAnalysisStatus.MET
    assert first.review_note == NOTE_UNVERIFIED
    assert first.offer_quote is None


@pytest.mark.asyncio
async def test_a_refused_account_stops_the_comparison(fake) -> None:
    def handler(stage: str, system: str, user: str) -> dict:
        raise ModelAccessError("402")

    fake(handler)
    with pytest.raises(ModelAccessError):
        await _run(thinking=False)


@pytest.mark.asyncio
async def test_too_many_failed_checks_fail_the_comparison(fake) -> None:
    fake(make_handler(fail_verdicts=True))
    with pytest.raises(ComparisonFailedError):
        await _run(thinking=False)


@pytest.mark.asyncio
async def test_a_few_failed_checks_are_marked_not_hidden(
    fake, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pipeline, "_MAX_FAILED_SHARE", 1.0)
    fake(make_handler(fail_verdicts=True))
    _, items, _ = await _run(thinking=False)
    assert all(NOTE_FAILED in (i.review_note or "") for i in items)


@pytest.mark.asyncio
async def test_weakly_linked_sections_are_shown_as_possible(fake) -> None:
    holder = fake(make_handler())
    await _run(thinking=False)
    vat_prompt = next(
        user
        for stage, user, _ in holder["calls"].prompts
        if stage == "verdict" and "ТЗ п. 1.1" in user
    )
    assert (
        "S2 Item 1 «CHEESE VAT, mod. CV10» (стр. 1); возможно также: S3"
        in (vat_prompt)
    )
