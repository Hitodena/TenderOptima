"""Objects of the TZ that the offer leaves out entirely.

When the supplier does not supply a piece of equipment at all («Pasteurized
water tank … not included»), every point of that object fails, though the
offer says nothing about its individual parameters. A model judging one
parameter at a time tends to answer «not found» there; one question about
each object as a whole, with the answer checked against the text, puts the
exclusion on every point it covers.
"""

from __future__ import annotations

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from backend.enums import TZAnalysisStatus
from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.text import shorten
from backend.services.kp_compare.tz_objects import TzObject
from backend.services.kp_compare.verdicts import (
    Evidence,
    OfferView,
    PointVerdict,
    scope_parts,
    verify_quote,
)
from backend.services.llm.prompts.kp_compare import build_scope_prompt

_SAMPLE_POINTS = 4

NOTE_EXCLUDED_CONFLICT = (
    "КП исключает этот объект из поставки, но по пункту приводит сведения — "
    "проверьте, что именно поставщик предлагает."
)


class _ScopeEntry(BaseModel):
    object: str = ""
    status: str = "unclear"
    quote: str = ""
    section: str = ""

    @field_validator("object", "status", "quote", "section", mode="before")
    @classmethod
    def _text(cls, value: object) -> str:
        return "" if value is None else str(value)


class _ScopeResult(BaseModel):
    objects: list[_ScopeEntry] = Field(default_factory=list)


def _objects_block(objects: list[TzObject]) -> str:
    lines = []
    for obj in objects:
        samples = "; ".join(
            f"«{shorten(p.text, 80)}»" for p in obj.points[:_SAMPLE_POINTS]
        )
        lines.append(f"{obj.id} {obj.title} — например: {samples}")
    return "\n".join(lines)


async def find_excluded_objects(
    objects: list[TzObject], view: OfferView, calls: ModelCalls
) -> dict[str, Evidence]:
    """Object id -> the checked quote by which the offer leaves it out."""
    equipment = [obj for obj in objects if obj.kind == "equipment"]
    if not equipment:
        return {}
    offer_text = view.full_text
    if offer_text is None:
        shared_and_summary = [
            s.id
            for s in view.document.sections
            if s.kind in {"summary", "scope"}
        ]
        offer_text = scope_parts(view.document, shared_and_summary)[0]
    system, user = build_scope_prompt(offer_text, _objects_block(equipment))
    try:
        result = await calls.json(
            "object_scope", system, user, _ScopeResult, thinking=False
        )
    except ModelAccessError:
        raise
    except Exception as exc:
        logger.warning(
            "Object scope check failed",
            analysis_id=calls.analysis_id,
            error=str(exc)[:300],
        )
        return {}
    known = {obj.id for obj in equipment}
    excluded: dict[str, Evidence] = {}
    for entry in result.objects:
        object_id = entry.object.strip()
        if (
            object_id not in known
            or entry.status.strip().lower() != "excluded"
        ):
            continue
        evidence = verify_quote(view.document, entry.quote, entry.section)
        if evidence is not None and evidence.verified:
            excluded[object_id] = evidence
    calls.stats["object_scope:excluded"] += len(excluded)
    return excluded


def apply_exclusions(
    objects: list[TzObject],
    verdicts: dict[str, PointVerdict],
    excluded: dict[str, Evidence],
) -> int:
    """Turn «not found» into «missing» on the points of excluded objects."""
    changed = 0
    for obj in objects:
        evidence = excluded.get(obj.id)
        if evidence is None:
            continue
        for point in obj.points:
            verdict = verdicts.get(point.key)
            if verdict is None or verdict.failed:
                continue
            if verdict.status is TZAnalysisStatus.NOT_FOUND:
                verdicts[point.key] = PointVerdict(
                    status=TZAnalysisStatus.MISSING,
                    offer_value="Не входит в предложение",
                    explanation=(
                        f"Поставщик не включил «{obj.title}» в предложение: "
                        f"«{shorten(evidence.quote, 200)}»."
                    ),
                    evidence=[evidence],
                )
                changed += 1
            elif verdict.status in (
                TZAnalysisStatus.MET,
                TZAnalysisStatus.PARTIAL,
            ):
                verdict.add_note(NOTE_EXCLUDED_CONFLICT)
    return changed
