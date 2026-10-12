"""TZ objects, links to the offer, clause references and verdict rules."""

from __future__ import annotations

import pytest

from backend.enums import TZAnalysisStatus
from backend.services.kp_compare import verdicts as verdicts_module
from backend.services.kp_compare.align import align_objects
from backend.services.kp_compare.object_scope import (
    NOTE_EXCLUDED_CONFLICT,
    apply_exclusions,
)
from backend.services.kp_compare.references import (
    _covers,
    attach_clause_references,
    clause_references,
)
from backend.services.kp_compare.segments import segment_offer
from backend.services.kp_compare.tz_objects import GENERAL_ID, group_points
from backend.services.kp_compare.verdicts import (
    NOTE_CONFLICT,
    Evidence,
    OfferView,
    PointVerdict,
    merge_verdicts,
    not_found_verdict,
    scope_parts,
)
from backend.tests.kp_compare.helpers import OFFER, OUTLINE, FakeCalls, tz

MARKS = {
    "objects": [
        {"key": "1", "kind": "equipment", "title_ru": "Сыроизготовитель"},
        {"key": "2.1", "kind": "equipment", "title_ru": "Ёмкость"},
        {"key": "1.3", "kind": "equipment", "title_ru": "лист, не раздел"},
        {"key": "nonsense", "kind": "equipment"},
    ]
}


async def _document():
    calls = FakeCalls(lambda *a: {"sections": OUTLINE})
    return await segment_offer([("offer.pdf", OFFER)], calls)


@pytest.mark.asyncio
async def test_points_belong_to_the_nearest_marked_section() -> None:
    hierarchy, flat = tz()
    objects = await group_points(hierarchy, flat, FakeCalls(lambda *a: MARKS))
    by_title = {o.title: [p.number for p in o.points] for o in objects}
    assert by_title == {
        "Общие требования ТЗ (пункты вне отдельных объектов)": ["3"],
        "1 Сыроизготовитель": ["1.1", "1.2", "1.3"],
        "2.1 Буферная ёмкость для пастеризованной воды": ["2.1.1", "2.1.2"],
    }
    assert objects[0].id == GENERAL_ID
    tank = objects[2]
    assert tank.points[0].context == []
    assert tank.points[0].flat == next(
        f for f in flat if f.startswith("2.1.1.")
    )


@pytest.mark.asyncio
async def test_without_marks_top_sections_are_the_objects() -> None:
    def broken(*args) -> dict:
        raise ValueError("bad answer")

    hierarchy, flat = tz()
    objects = await group_points(hierarchy, flat, FakeCalls(broken))
    titles = [o.title for o in objects]
    assert "1 Сыроизготовитель" in titles
    assert "2 Вспомогательное оборудование" in titles
    assert sum(len(o.points) for o in objects) == len(flat)


@pytest.mark.asyncio
async def test_points_marked_not_to_compare_are_left_out() -> None:
    hierarchy, flat = tz()
    flat = [f for f in flat if not f.startswith("1.2.")]
    objects = await group_points(hierarchy, flat, FakeCalls(lambda *a: MARKS))
    numbers = [p.number for o in objects for p in o.points]
    assert "1.2" not in numbers and len(numbers) == len(flat)


@pytest.mark.asyncio
async def test_a_link_named_both_ways_is_firm() -> None:
    document = await _document()
    hierarchy, flat = tz()
    objects = await group_points(hierarchy, flat, FakeCalls(lambda *a: MARKS))

    def handler(stage: str, system: str, user: str) -> dict:
        assert "[deviations" not in user  # shared sections are not linked
        if stage == "align_forward":
            return {"objects": [{"object": "O1", "sections": ["S2", "S9"]}]}
        return {"sections": [{"section": "S3", "objects": ["O1", "O2"]}]}

    alignment = await align_objects(objects, document, FakeCalls(handler))
    assert alignment.firm == {}
    assert alignment.weak == {"O1": ["S2", "S3"], "O2": ["S3"]}
    assert alignment.scope("O1") == ["S2", "S3"]
    assert not alignment.is_firm("O1", "S2")


@pytest.mark.asyncio
async def test_clause_references_go_to_the_points_they_name() -> None:
    document = await _document()
    references = clause_references(document)
    assert references and references[0][0] == ["2.1"]
    hierarchy, flat = tz()
    objects = await group_points(hierarchy, flat, FakeCalls(lambda *a: MARKS))
    assert attach_clause_references(objects, document) == 2
    hinted = [p.number for o in objects for p in o.points if p.hints]
    assert hinted == ["2.1.1", "2.1.2"]


def test_which_clause_numbers_a_reference_covers() -> None:
    assert _covers("21.2", "21.2")
    assert _covers("21.2", "21.2.11")
    assert _covers("8", "8 (1).3")
    assert not _covers("21.2", "21.20")
    assert not _covers("2", "21.2")


def _verdict(status: TZAnalysisStatus, verified: bool = True) -> PointVerdict:
    evidence = [Evidence("S1", "quote", 1, verified)]
    return PointVerdict(status, "value", "why", evidence=evidence)


def test_merging_two_looks_at_the_offer() -> None:
    met, missing = (
        _verdict(TZAnalysisStatus.MET),
        _verdict(TZAnalysisStatus.MISSING),
    )
    assert merge_verdicts(not_found_verdict(), met) is met
    assert merge_verdicts(met, not_found_verdict()) is met
    conflict = merge_verdicts(met, missing)
    assert conflict.status is TZAnalysisStatus.MISSING
    assert NOTE_CONFLICT in conflict.notes
    unverified = _verdict(TZAnalysisStatus.MISSING, verified=False)
    assert merge_verdicts(unverified, met) is met
    failed = not_found_verdict()
    failed.failed = True
    assert merge_verdicts(failed, met) is met


def test_exclusion_turns_not_found_into_missing_and_flags_conflicts() -> None:
    from backend.services.kp_compare.tz_objects import TzObject, TzPoint

    points = [TzPoint(k, f"{k}. t", "t", k, []) for k in ("a", "b", "c")]
    obj = TzObject("O2", "2.1", "equipment", "Ёмкость", points)
    verdicts = {
        "a": not_found_verdict(),
        "b": _verdict(TZAnalysisStatus.PARTIAL),
        "c": not_found_verdict(),
    }
    verdicts["c"].failed = True
    exclusion = Evidence("S5", "tank … not included", 2, True)
    assert apply_exclusions([obj], verdicts, {"O2": exclusion}) == 1
    assert verdicts["a"].status is TZAnalysisStatus.MISSING
    assert verdicts["a"].evidence == [exclusion]
    assert NOTE_EXCLUDED_CONFLICT in verdicts["b"].notes
    assert verdicts["c"].status is TZAnalysisStatus.NOT_FOUND


@pytest.mark.asyncio
async def test_a_long_offer_is_read_section_by_section(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = await _document()
    assert OfferView.build(document).whole
    monkeypatch.setattr(verdicts_module, "FULL_OFFER_LIMIT", 10)
    view = OfferView.build(document)
    assert not view.whole
    parts = view.texts_for(["S2"])
    assert len(parts) == 1
    assert "[S2 |" in parts[0] and "[S5 |" in parts[0]
    assert "[S3 |" not in parts[0]


@pytest.mark.asyncio
async def test_a_section_longer_than_a_part_is_split_not_cut(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    document = await _document()
    monkeypatch.setattr(verdicts_module, "_SCOPE_LIMIT", 120)
    parts = scope_parts(document, ["S2"])
    assert len(parts) > 1
    joined = "\n".join(parts)
    for line in ("Maximum capacity", "Insulation", "Control panel"):
        assert line in joined


def test_a_section_named_like_the_object_becomes_a_weak_link() -> None:
    from backend.services.kp_compare.align import _named_alike
    from backend.services.kp_compare.segments import KpSection
    from backend.services.kp_compare.tz_objects import TzObject

    def section(sid: str, title_ru: str, kind: str = "equipment") -> KpSection:
        return KpSection(
            sid, "f", kind, title_ru, title_ru, None, 0, 1, 1, 1, "x"
        )

    obj = TzObject(
        "O17",
        "33.1",
        "equipment",
        "32 Трейсилер-автоматический запайщик лотков с мультиголовочным "
        "весовым дозатором",
    )
    sections = [
        section("S49", "Вертикальная упаковочная машина"),
        section("S52", "Многоголовочный весовой дозатор PW10"),
        section("S60", "Весовой дозатор: условия оплаты", kind="commercial"),
    ]
    assert _named_alike(obj, sections) == {"S52"}
    general = TzObject("O0", None, "general", obj.title)
    assert _named_alike(general, sections) == set()
