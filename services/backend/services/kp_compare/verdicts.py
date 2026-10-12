"""Verdicts for the points of a TZ object.

One call checks up to ``_POINTS_PER_CALL`` points of one object. The model
reads the whole offer when it fits (the same text for every object, so the
provider caches it) and is told which sections describe the object, and
which sections — exclusions, deviations from the TZ — bear on every point.
An offer too long for that is checked section by section instead.

Every verdict other than «not found» must quote the offer; the code finds
each quote in the text, records its page and section, and notes for review
what it cannot confirm. Nothing is merged by picking the best of many
answers.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from backend.enums import TZAnalysisStatus
from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.segments import KpDocument, KpSection
from backend.services.kp_compare.text import find_quote, shorten
from backend.services.kp_compare.tz_objects import TzObject, TzPoint
from backend.services.llm.prompts.kp_compare import build_verdict_prompt

_POINTS_PER_CALL = 10
_POINT_CHARS_PER_CALL = 6_000
# the whole offer goes into each call up to this size (≈ 250K tokens)
FULL_OFFER_LIMIT = 900_000
# otherwise the object's own sections, packed into parts of this size
_SCOPE_LIMIT = 60_000
_EVIDENCE_PER_POINT = 3

_STATUS_ALIASES = {
    "met": TZAnalysisStatus.MET,
    "partial": TZAnalysisStatus.PARTIAL,
    "missing": TZAnalysisStatus.MISSING,
    "not_found": TZAnalysisStatus.NOT_FOUND,
    "notfound": TZAnalysisStatus.NOT_FOUND,
    "not found": TZAnalysisStatus.NOT_FOUND,
}
# which verdict stands when parts of the offer disagree
_CONFLICT_ORDER = {
    TZAnalysisStatus.MISSING: 3,
    TZAnalysisStatus.PARTIAL: 2,
    TZAnalysisStatus.MET: 1,
    TZAnalysisStatus.NOT_FOUND: 0,
}

NOTE_UNVERIFIED = (
    "Цитата, на которую опирается вердикт, не найдена в тексте КП дословно — "
    "проверьте этот пункт по КП."
)
NOTE_NO_EVIDENCE = "Вердикт дан без цитаты из КП — проверьте этот пункт по КП."
NOTE_NO_ANSWER = (
    "Нейросеть не дала ответа по этому пункту — проверьте вручную."
)
NOTE_FAILED = (
    "Пункт не проверен: сбой при обращении к нейросети — повторите анализ "
    "или проверьте вручную."
)
NOTE_CONFLICT = (
    "Разные места КП дают разные сведения по пункту — проверьте по цитатам."
)


class _EvidenceAnswer(BaseModel):
    section: str = ""
    quote: str = ""

    @field_validator("section", "quote", mode="before")
    @classmethod
    def _text(cls, value: object) -> str:
        return "" if value is None else str(value)


class _VerdictAnswer(BaseModel):
    id: str = ""
    status: str = "not_found"
    evidence: list[_EvidenceAnswer] = Field(default_factory=list)
    offer_value: str | None = None
    explanation: str = ""

    @field_validator("evidence", mode="before")
    @classmethod
    def _list(cls, value: object) -> object:
        return [] if value is None else value

    @field_validator("id", "status", "explanation", mode="before")
    @classmethod
    def _text(cls, value: object) -> str:
        return "" if value is None else str(value)

    @field_validator("offer_value", mode="before")
    @classmethod
    def _optional_text(cls, value: object) -> str | None:
        return None if value is None else str(value)


class _VerdictResult(BaseModel):
    results: list[_VerdictAnswer] = Field(default_factory=list)


@dataclass
class Evidence:
    """A quote from the offer that a verdict rests on."""

    section_id: str
    quote: str
    page: int | None
    verified: bool


@dataclass
class PointVerdict:
    """The outcome for one point of the TZ."""

    status: TZAnalysisStatus
    offer_value: str | None
    explanation: str
    evidence: list[Evidence] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    failed: bool = False

    @property
    def verified(self) -> bool:
        return any(e.verified for e in self.evidence)

    def add_note(self, note: str) -> None:
        if note not in self.notes:
            self.notes.append(note)


def not_found_verdict(note: str | None = None) -> PointVerdict:
    verdict = PointVerdict(
        status=TZAnalysisStatus.NOT_FOUND,
        offer_value=None,
        explanation="В КП не найдена информация по требованию.",
    )
    if note:
        verdict.add_note(note)
    return verdict


def merge_verdicts(first: PointVerdict, second: PointVerdict) -> PointVerdict:
    """One verdict from two looks at different parts of the offer."""
    if second.status is TZAnalysisStatus.NOT_FOUND and not second.failed:
        return first
    if first.status is TZAnalysisStatus.NOT_FOUND and not first.failed:
        return second
    if first.failed:
        return second
    if second.failed:
        return first
    if first.verified != second.verified:
        return first if first.verified else second
    if first.status == second.status:
        first.evidence = (first.evidence + second.evidence)[
            :_EVIDENCE_PER_POINT
        ]
        return first
    winner, other = (
        (first, second)
        if _CONFLICT_ORDER[first.status] >= _CONFLICT_ORDER[second.status]
        else (second, first)
    )
    winner.evidence = (winner.evidence + other.evidence)[:_EVIDENCE_PER_POINT]
    winner.add_note(NOTE_CONFLICT)
    return winner


def _status(value: str) -> TZAnalysisStatus | None:
    return _STATUS_ALIASES.get(str(value or "").strip().lower())


def point_line(index: int, point: TzPoint) -> str:
    number = f"ТЗ п. {point.number}" if point.number else "ТЗ, без номера"
    line = f"R{index}. [{number}] {point.text}"
    if point.context:
        line += f"\n    контекст: {' → '.join(point.context)}"
    for hint in point.hints:
        line += f"\n    КП о пункте: {hint}"
    return line


def _batches(points: list[TzPoint]) -> list[list[TzPoint]]:
    batches: list[list[TzPoint]] = []
    current: list[TzPoint] = []
    chars = 0
    for point in points:
        size = len(point.text) + sum(len(c) for c in point.context) + 40
        if current and (
            len(current) >= _POINTS_PER_CALL
            or chars + size > _POINT_CHARS_PER_CALL
        ):
            batches.append(current)
            current, chars = [], 0
        current.append(point)
        chars += size
    if current:
        batches.append(current)
    return batches


def section_header(section: KpSection, part_no: int = 0) -> str:
    where = f" | {section.pages}" if section.pages else ""
    part = f" | часть {part_no}" if part_no else ""
    return f"[{section.id}{where}{part} | {section.label}]"


def section_refs(sections: list[KpSection]) -> str:
    """«S5 Item 2 «CHEESE VAT» (стр. 7–12); S6 …» for the prompt."""
    return "; ".join(
        f"{s.id} {s.label}" + (f" ({s.pages})" if s.pages else "")
        for s in sections
    )


def render_offer(document: KpDocument) -> str:
    """The whole offer, every section under its header."""
    return "\n\n".join(
        f"{section_header(s)}\n{document.render(s)}" for s in document.sections
    )


def _rendered_pieces(document: KpDocument, section: KpSection) -> list[str]:
    body = document.render(section)
    if len(body) <= _SCOPE_LIMIT:
        return [f"{section_header(section)}\n{body}"]
    pieces: list[str] = []
    chunk: list[str] = []
    size = 0
    for line in body.split("\n"):
        if size + len(line) > _SCOPE_LIMIT and chunk:
            pieces.append(
                f"{section_header(section, len(pieces) + 1)}\n"
                + "\n".join(chunk)
            )
            chunk, size = [], 0
        chunk.append(line)
        size += len(line) + 1
    if chunk:
        pieces.append(
            f"{section_header(section, len(pieces) + 1)}\n" + "\n".join(chunk)
        )
    return pieces


def scope_parts(document: KpDocument, section_ids: list[str]) -> list[str]:
    """Shared sections plus the object's own, packed into prompt-sized parts.

    For an offer too long to read whole. A long section is split at line
    boundaries, so nothing is cut off; the shared sections open every part.
    """
    shared = [
        piece
        for section in document.sections
        if section.is_shared
        for piece in _rendered_pieces(document, section)
    ]
    own: list[str] = []
    for section_id in section_ids:
        section = document.section(section_id)
        if section is not None and not section.is_shared:
            own.extend(_rendered_pieces(document, section))
    head = "\n\n".join(shared)
    parts: list[str] = []
    current: list[str] = []
    size = len(head)
    for piece in own:
        if current and size + len(piece) > _SCOPE_LIMIT:
            parts.append("\n\n".join([head, *current]).strip())
            current, size = [], len(head)
        current.append(piece)
        size += len(piece) + 2
    if current or not parts:
        parts.append("\n\n".join([head, *current]).strip())
    return parts


def section_at(
    document: KpDocument, file: str, offset: int
) -> KpSection | None:
    for section in document.sections:
        if section.file == file and section.start <= offset < section.end:
            return section
    return None


def verify_quote(
    document: KpDocument, quote: str, cited_id: str
) -> Evidence | None:
    """Find *quote* in the offer: in the cited section first, then anywhere."""
    quote = " ".join(quote.split())
    if not quote:
        return None
    cited = document.section(cited_id.strip())
    if cited is not None:
        part = document.part(cited.file)
        match = find_quote(
            quote,
            part.folded,
            start=part.folded_index(cited.start),
            end=part.folded_index(cited.end),
        )
        if match is not None:
            return Evidence(
                section_id=cited.id,
                quote=shorten(quote, 400),
                page=part.pages.page_at(match.start),
                verified=True,
            )
    for part in document.parts:
        match = find_quote(quote, part.folded)
        if match is None:
            continue
        section = section_at(document, part.name, match.start)
        return Evidence(
            section_id=section.id if section is not None else "",
            quote=shorten(quote, 400),
            page=part.pages.page_at(match.start),
            verified=True,
        )
    return Evidence(
        section_id=cited.id if cited is not None else "",
        quote=shorten(quote, 400),
        page=None,
        verified=False,
    )


def _to_verdict(document: KpDocument, answer: _VerdictAnswer) -> PointVerdict:
    status = _status(answer.status)
    if status is None:
        return not_found_verdict(NOTE_NO_ANSWER)
    offer_value = (answer.offer_value or "").strip() or None
    explanation = answer.explanation.strip()
    if status is TZAnalysisStatus.NOT_FOUND:
        verdict = not_found_verdict()
        if explanation:
            verdict.explanation = explanation
        return verdict
    evidence = [
        found
        for item in answer.evidence[:_EVIDENCE_PER_POINT]
        if (found := verify_quote(document, item.quote, item.section))
        is not None
    ]
    verdict = PointVerdict(
        status=status,
        offer_value=offer_value,
        explanation=explanation or "Обоснование не указано.",
        evidence=evidence,
    )
    if not evidence:
        verdict.add_note(NOTE_NO_EVIDENCE)
    elif not verdict.verified:
        verdict.add_note(NOTE_UNVERIFIED)
    return verdict


@dataclass
class OfferView:
    """What every verdict call of one comparison shows of the offer."""

    document: KpDocument
    full_text: str | None
    shared_refs: str

    @classmethod
    def build(cls, document: KpDocument) -> OfferView:
        full = render_offer(document)
        shared = [s for s in document.sections if s.is_shared]
        return cls(
            document=document,
            full_text=full if len(full) <= FULL_OFFER_LIMIT else None,
            shared_refs=section_refs(shared),
        )

    @property
    def whole(self) -> bool:
        return self.full_text is not None

    def texts_for(self, section_ids: list[str]) -> list[str]:
        if self.full_text is not None:
            return [self.full_text]
        return scope_parts(self.document, section_ids)


async def _ask(
    obj: TzObject,
    points: list[TzPoint],
    *,
    offer_text: str,
    object_sections: str,
    view: OfferView,
    calls: ModelCalls,
    stage: str,
    thinking: bool,
) -> dict[str, PointVerdict]:
    """Verdicts for *points* from one call; points without an answer absent."""
    requirements = "\n".join(
        point_line(index, point) for index, point in enumerate(points, start=1)
    )
    system, user = build_verdict_prompt(
        offer_text=offer_text,
        shared_sections=view.shared_refs,
        object_title=obj.title,
        object_sections=object_sections,
        requirements=requirements,
    )
    result = await calls.json(
        stage, system, user, _VerdictResult, thinking=thinking
    )
    by_id = {f"R{index}": point for index, point in enumerate(points, 1)}
    verdicts: dict[str, PointVerdict] = {}
    for answer in result.results:
        point = by_id.get(answer.id.strip().upper())
        if point is None or point.key in verdicts:
            continue
        verdicts[point.key] = _to_verdict(view.document, answer)
    return verdicts


async def judge_points(
    obj: TzObject,
    points: list[TzPoint],
    section_ids: list[str],
    view: OfferView,
    calls: ModelCalls,
    *,
    stage: str = "verdict",
    thinking: bool = True,
    weak_ids: list[str] | None = None,
) -> dict[str, PointVerdict]:
    """Verdicts for *points* of *obj*, pointing the model to *section_ids*.

    Sections in *weak_ids* are shown as only possibly describing the object.
    """
    weak = set(weak_ids or [])
    sections = [
        s
        for section_id in section_ids
        if (s := view.document.section(section_id)) is not None
    ]
    object_sections = section_refs([s for s in sections if s.id not in weak])
    possible = section_refs([s for s in sections if s.id in weak])
    if possible:
        object_sections = (
            f"{object_sections}; возможно также: {possible}"
            if object_sections
            else f"возможно: {possible}"
        )
    texts = view.texts_for(section_ids)

    async def run(batch: list[TzPoint], text: str) -> dict[str, PointVerdict]:
        try:
            found = await _ask(
                obj,
                batch,
                offer_text=text,
                object_sections=object_sections,
                view=view,
                calls=calls,
                stage=stage,
                thinking=thinking,
            )
            missing = [p for p in batch if p.key not in found]
            if missing:
                found.update(
                    await _ask(
                        obj,
                        missing,
                        offer_text=text,
                        object_sections=object_sections,
                        view=view,
                        calls=calls,
                        stage=f"{stage}_retry",
                        thinking=thinking,
                    )
                )
        except ModelAccessError:
            raise
        except Exception as exc:
            logger.warning(
                "KP verdict batch failed",
                analysis_id=calls.analysis_id,
                kp_name=calls.kp_name,
                object=obj.title,
                points=len(batch),
                error=str(exc)[:300],
            )
            calls.stats[f"{stage}:failed_batches"] += 1
            failed: dict[str, PointVerdict] = {}
            for point in batch:
                verdict = not_found_verdict(NOTE_FAILED)
                verdict.failed = True
                failed[point.key] = verdict
            return failed
        for point in batch:
            if point.key not in found:
                found[point.key] = not_found_verdict(NOTE_NO_ANSWER)
        return found

    batches = _batches(points)
    calls.stats[f"{stage}:batches"] += len(batches) * len(texts)
    answers = await asyncio.gather(
        *(run(batch, text) for text in texts for batch in batches)
    )
    verdicts: dict[str, PointVerdict] = {}
    for answer in answers:
        for key, verdict in answer.items():
            verdicts[key] = (
                merge_verdicts(verdicts[key], verdict)
                if key in verdicts
                else verdict
            )
    return verdicts
