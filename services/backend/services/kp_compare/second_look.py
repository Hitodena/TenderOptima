"""A second look for the points the first pass found nothing about.

The model names search terms for each such point, in the language of the
offer and in Russian; the code finds the offer sections outside the point's
own where those terms occur, and the point is checked there.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from loguru import logger
from pydantic import BaseModel, Field

from backend.enums import TZAnalysisStatus
from backend.services.kp_compare.align import Alignment
from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.segments import KpDocument
from backend.services.kp_compare.text import fold_plain, shorten
from backend.services.kp_compare.tz_objects import TzObject, TzPoint
from backend.services.kp_compare.verdicts import (
    OfferView,
    PointVerdict,
    judge_points,
)
from backend.services.llm.prompts.kp_compare import build_terms_prompt

_TERMS_PER_CALL = 40
_MAX_POINTS = 200
_CANDIDATES_PER_POINT = 2
_MIN_SCORE = 2


class _TermsEntry(BaseModel):
    id: str = ""
    terms: list[str] = Field(default_factory=list)


class _TermsResult(BaseModel):
    terms: list[_TermsEntry] = Field(default_factory=list)


@dataclass
class _Pending:
    obj: TzObject
    point: TzPoint
    terms: list[str]


def _weight(term: str) -> int:
    if any(ch.isdigit() for ch in term):
        return 2
    return 1 if len(term) >= 4 else 0


async def _search_terms(
    pending: list[_Pending], document: KpDocument, calls: ModelCalls
) -> None:
    groups = [
        pending[i : i + _TERMS_PER_CALL]
        for i in range(0, len(pending), _TERMS_PER_CALL)
    ]

    async def ask(group: list[_Pending]) -> None:
        lines = "\n".join(
            f"R{index}. {shorten(item.point.text, 300)}"
            + (
                f" (объект: {shorten(item.obj.title, 80)})"
                if item.obj.kind == "equipment"
                else ""
            )
            for index, item in enumerate(group, start=1)
        )
        system, user = build_terms_prompt(lines, kp_language=document.language)
        try:
            result = await calls.json(
                "search_terms", system, user, _TermsResult, thinking=False
            )
        except ModelAccessError:
            raise
        except Exception as exc:
            logger.warning(
                "KP search terms call failed",
                analysis_id=calls.analysis_id,
                error=str(exc)[:300],
            )
            return
        by_id = {f"R{i}": item for i, item in enumerate(group, start=1)}
        for entry in result.terms:
            item = by_id.get(entry.id.strip().upper())
            if item is None:
                continue
            item.terms = [
                folded
                for term in entry.terms[:8]
                if len(folded := fold_plain(str(term)).strip()) >= 3
            ]

    await asyncio.gather(*(ask(group) for group in groups))


def _candidates(
    item: _Pending,
    document: KpDocument,
    alignment: Alignment,
    folded_sections: dict[str, str],
) -> list[str]:
    own = set(alignment.scope(item.obj.id))
    scored: list[tuple[int, int, str]] = []
    for order, section in enumerate(document.sections):
        if section.is_shared or section.id in own:
            continue
        text = folded_sections[section.id]
        score = sum(_weight(term) for term in item.terms if term in text)
        if score >= _MIN_SCORE:
            scored.append((-score, order, section.id))
    scored.sort()
    return [section_id for _, _, section_id in scored[:_CANDIDATES_PER_POINT]]


async def second_look(
    objects: list[TzObject],
    verdicts: dict[str, PointVerdict],
    alignment: Alignment,
    view: OfferView,
    calls: ModelCalls,
) -> int:
    """Re-check unanswered points elsewhere in the offer; count the finds.

    Needed only when the offer is checked section by section: a model that
    reads the whole offer has already looked everywhere.
    """
    document = view.document
    pending = [
        _Pending(obj, point, [])
        for obj in objects
        for point in obj.points
        if (verdict := verdicts.get(point.key)) is not None
        and verdict.status is TZAnalysisStatus.NOT_FOUND
        and not verdict.failed
    ][:_MAX_POINTS]
    if not pending:
        return 0
    await _search_terms(pending, document, calls)

    folded_sections: dict[str, str] = {}
    for section in document.sections:
        part = document.part(section.file)
        folded_sections[section.id] = part.folded.text[
            part.folded_index(section.start) : part.folded_index(section.end)
        ]

    groups: dict[tuple[str, tuple[str, ...]], list[_Pending]] = {}
    for item in pending:
        candidates = _candidates(item, document, alignment, folded_sections)
        if candidates:
            groups.setdefault((item.obj.id, tuple(candidates)), []).append(
                item
            )
    calls.stats["second_look:points"] += len(pending)
    calls.stats["second_look:with_candidates"] += sum(
        len(items) for items in groups.values()
    )

    async def check(
        items: list[_Pending], section_ids: list[str]
    ) -> dict[str, PointVerdict]:
        return await judge_points(
            items[0].obj,
            [item.point for item in items],
            section_ids,
            view,
            calls,
            stage="second_look",
        )

    keys = list(groups)
    answers = await asyncio.gather(
        *(check(groups[key], list(key[1])) for key in keys)
    )
    # the pipeline then notes finds outside the point's own sections
    found = 0
    for answer in answers:
        for point_key, verdict in answer.items():
            if (
                verdict.status is TZAnalysisStatus.NOT_FOUND
                or not verdict.verified
            ):
                continue
            verdicts[point_key] = verdict
            found += 1
    calls.stats["second_look:found"] += found
    return found
