import pytest

from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import TZAnalysisItem, TZAnalysisResult
from backend.services.analysis.tz import (
    _map_compliance_batch_to_items,
    _needs_recall,
    _run_recall_sweep,
)


def _item(
    requirement: str,
    status: TZAnalysisStatus,
    *,
    ref: str | None = None,
) -> TZAnalysisItem:
    return TZAnalysisItem(
        requirement=requirement,
        ref=ref,
        explanation="test",
        status=status,
    )


def test_recall_includes_unresolved_but_not_met_or_manual_not_compare() -> (
    None
):
    assert _needs_recall(None)
    assert _needs_recall(_item("1. x", TZAnalysisStatus.NOT_FOUND))
    assert _needs_recall(_item("1. x", TZAnalysisStatus.MISSING))
    assert _needs_recall(_item("1. x", TZAnalysisStatus.PARTIAL))
    assert not _needs_recall(_item("1. x", TZAnalysisStatus.MET))
    assert not _needs_recall(_item("1. x", TZAnalysisStatus.NOT_COMPARE))


def test_mapper_uses_explicit_leaf_ref_when_requirement_text_is_malformed() -> (
    None
):
    requirement = "1.2. Форма обратной связи"
    parsed = TZAnalysisResult(
        items=[
            _item(
                "форма обратной связи",
                TZAnalysisStatus.MET,
                ref="1.2",
            ),
        ],
    )

    mapped = _map_compliance_batch_to_items(
        [requirement],
        parsed,
        kp_name="Supplier",
    )

    assert len(mapped) == 1
    assert mapped[0].requirement == requirement
    assert mapped[0].kp_name == "Supplier"


@pytest.mark.asyncio
async def test_recall_scans_all_kp_chunks_and_stops_when_batch_is_met(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    text = "BEGIN " + ("x" * 18_000) + " END"
    calls: list[tuple[str, int, int]] = []
    requirement = "1.2. Форма обратной связи"

    async def fake_recall(
        tz_batch: list[str],
        kp_text: str,
        **kwargs: object,
    ) -> list[TZAnalysisItem]:
        calls.append(
            (
                kp_text,
                int(kwargs["kp_chunk_idx"]),
                int(kwargs["total_kp_chunks"]),
            ),
        )
        # Deliberately do not match until the final chunk, proving the tail is
        # actually searched rather than silently truncated.
        if " END" in kp_text:
            return [_item(requirement, TZAnalysisStatus.MET, ref="1.2")]
        return []

    monkeypatch.setattr(
        "backend.services.analysis.tz._llm_recall_batch",
        fake_recall,
    )

    found: dict[str, TZAnalysisItem] = {}
    await _run_recall_sweep(
        [requirement],
        found,
        text,
        kp_name="Supplier",
        analysis_id="test-analysis",
        user_id="test-user",
    )

    assert len(calls) > 1
    assert calls[-1][0].endswith("END")
    assert all(index == i for i, (_, index, _) in enumerate(calls))
    assert all(total == len(calls) for _, _, total in calls)
    assert found["1.2"].status == TZAnalysisStatus.MET
