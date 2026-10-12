"""Compare a TZ with one supplier's offer, object by object.

1. The offer is cut into its sections (positions, services, conditions,
   exclusions, deviations from the TZ).
2. The points of the TZ are grouped by the object they describe.
3. Every object is linked to the offer sections that describe it; the link
   is asked both ways and only a two-way link is firm.
4. The points of each object are checked by the model, which reads the
   offer (whole, when it fits), is pointed to the object's own sections and
   always to the exclusions and deviations; every verdict quotes the offer
   and the code checks each quote and records where it stands.
5. A verdict resting on a section not firmly linked to the object is marked
   for review. An offer too long to read whole is checked section by
   section, and points with nothing found get a second look elsewhere.

What the code cannot confirm is not hidden: the point keeps its verdict and
carries a note saying what to check.
"""

from __future__ import annotations

import asyncio
import time

from loguru import logger

from backend.core.config import get_config
from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import TZAnalysisItem
from backend.services.kp_compare.align import Alignment, align_objects
from backend.services.kp_compare.calls import ModelCalls
from backend.services.kp_compare.object_scope import (
    apply_exclusions,
    find_excluded_objects,
)
from backend.services.kp_compare.references import attach_clause_references
from backend.services.kp_compare.second_look import second_look
from backend.services.kp_compare.segments import KpDocument, segment_offer
from backend.services.kp_compare.tz_objects import TzObject, group_points
from backend.services.kp_compare.verdicts import (
    OfferView,
    PointVerdict,
    judge_points,
    not_found_verdict,
)

config = get_config()

# more failed calls than this share of all checks fails the whole comparison
_MAX_FAILED_SHARE = 0.2
# sections about a particular machine or job, as opposed to general text
_SPECIFIC_KINDS = frozenset({"equipment", "service"})

NOTE_WEAK_LINK = (
    "Подтверждение взято из раздела КП {label}: его связь с объектом ТЗ "
    "«{title}» определена неуверенно — проверьте, что речь о том же "
    "оборудовании."
)
NOTE_OTHER_SECTION = (
    "Подтверждение взято из раздела КП {label}, который система не связала с "
    "объектом ТЗ «{title}», — проверьте, что речь о том же оборудовании."
)


class ComparisonFailedError(RuntimeError):
    """Too many checks failed for the result to be worth showing."""


def _note_sources(
    objects: list[TzObject],
    verdicts: dict[str, PointVerdict],
    alignment: Alignment,
    document: KpDocument,
) -> None:
    """Mark verdicts on equipment that rest on another machine's section."""
    for obj in objects:
        if obj.kind != "equipment":
            continue
        scope = set(alignment.scope(obj.id))
        for point in obj.points:
            verdict = verdicts.get(point.key)
            if verdict is None or not verdict.verified:
                continue
            sources = [
                section
                for evidence in verdict.evidence
                if evidence.verified
                and (section := document.section(evidence.section_id))
                is not None
            ]
            if not sources or any(
                alignment.is_firm(obj.id, s.id)
                or s.is_shared
                or s.kind not in _SPECIFIC_KINDS
                for s in sources
            ):
                continue
            first = sources[0]
            note = NOTE_WEAK_LINK if first.id in scope else NOTE_OTHER_SECTION
            verdict.add_note(note.format(label=first.label, title=obj.title))


def _offer_ref(document: KpDocument, verdict: PointVerdict) -> str:
    evidence = next(
        (e for e in verdict.evidence if e.verified),
        verdict.evidence[0] if verdict.evidence else None,
    )
    section = document.section(evidence.section_id) if evidence else None
    head = "Источник КП"
    if section is not None and len(document.parts) > 1:
        head = f"Источник КП «{section.file}»"
    parts = [head]
    if evidence is not None and evidence.page is not None:
        parts.append(f"стр {evidence.page}")
    if section is not None:
        parts.append(section.label)
    return ", ".join(parts)


def _item(
    flat: str,
    verdict: PointVerdict,
    document: KpDocument,
    kp_name: str,
) -> TZAnalysisItem:
    quotes = [e.quote for e in verdict.evidence if e.verified][:2]
    found = verdict.status is not TZAnalysisStatus.NOT_FOUND
    offer_value = verdict.offer_value if found else None
    if found and not offer_value and quotes:
        offer_value = quotes[0]
    return TZAnalysisItem(
        requirement=flat,
        offer_value=offer_value,
        offer_ref=_offer_ref(document, verdict) if offer_value else None,
        offer_quote=" … ".join(quotes) or None,
        explanation=verdict.explanation,
        status=verdict.status,
        kp_name=kp_name,
        review_note=" ".join(verdict.notes) or None,
    )


def _kp_hierarchy(document: KpDocument) -> dict:
    return {
        str(index): {
            "text": f"{section.label} ({section.pages})"
            if section.pages
            else section.label,
            "children": {},
        }
        for index, section in enumerate(document.sections, start=1)
    }


def _check_failures(calls: ModelCalls) -> None:
    batches = calls.stats["verdict:batches"]
    failed = calls.stats["verdict:failed_batches"]
    if batches and failed / batches > _MAX_FAILED_SHARE:
        raise ComparisonFailedError(
            f"{failed} of {batches} comparison calls failed"
        )


async def run_kp_comparison(
    kp_parts: list[tuple[str, str]],
    tz_flat: list[str],
    tz_hierarchy: dict,
    kp_name: str,
    *,
    analysis_id: str,
    user_id: str,
    thinking: bool | None = None,
) -> tuple[list[TZAnalysisItem], dict]:
    """Items for every point of *tz_flat* (in its order) and the offer outline.

    *kp_parts* holds (file name, text) for each file of the offer;
    *thinking* lets the model reason before each verdict (default from
    ``kp_compare_reasoning``).
    """
    if thinking is None:
        thinking = config.kp_compare_reasoning
    started = time.monotonic()
    calls = ModelCalls(
        analysis_id=analysis_id, user_id=user_id, kp_name=kp_name
    )
    try:
        document, objects = await asyncio.gather(
            segment_offer(kp_parts, calls),
            group_points(tz_hierarchy, tz_flat, calls),
        )
        view = OfferView.build(document)
        calls.stats["clause_references"] = attach_clause_references(
            objects, document
        )
        alignment, excluded = await asyncio.gather(
            align_objects(objects, document, calls),
            find_excluded_objects(objects, view, calls),
        )

        verdicts: dict[str, PointVerdict] = {}
        answers = await asyncio.gather(
            *(
                judge_points(
                    obj,
                    obj.points,
                    alignment.scope(obj.id),
                    view,
                    calls,
                    thinking=thinking,
                    weak_ids=alignment.weak.get(obj.id),
                )
                for obj in objects
            )
        )
        for answer in answers:
            verdicts.update(answer)
        _check_failures(calls)
        found_again = 0
        if not view.whole:
            found_again = await second_look(
                objects, verdicts, alignment, view, calls
            )
        calls.stats["excluded_points"] = apply_exclusions(
            objects, verdicts, excluded
        )
        _note_sources(objects, verdicts, alignment, document)

        key_by_flat = {p.flat: p.key for obj in objects for p in obj.points}
        items: list[TZAnalysisItem] = []
        for flat in tz_flat:
            key = key_by_flat.get(flat)
            verdict = verdicts.get(key) if key else None
            items.append(
                _item(flat, verdict or not_found_verdict(), document, kp_name)
            )
        logger.info(
            "KP comparison finished",
            analysis_id=analysis_id,
            user_id=user_id,
            kp_name=kp_name,
            seconds=round(time.monotonic() - started),
            whole_offer=view.whole,
            sections=len(document.sections),
            objects=len(objects),
            points=len(items),
            found_on_second_look=found_again,
            met=sum(i.status is TZAnalysisStatus.MET for i in items),
            partial=sum(i.status is TZAnalysisStatus.PARTIAL for i in items),
            missing=sum(i.status is TZAnalysisStatus.MISSING for i in items),
            not_found=sum(
                i.status is TZAnalysisStatus.NOT_FOUND for i in items
            ),
            for_review=sum(1 for i in items if i.review_note),
            **{k.replace(":", "_"): v for k, v in calls.stats.items()},
        )
        return items, _kp_hierarchy(document)
    finally:
        await calls.close()
