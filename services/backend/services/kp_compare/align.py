"""Which sections of the offer describe which object of the TZ.

The model is asked twice, independently: for each TZ object, the offer
sections that describe it; and for each offer section, the TZ objects it
describes. A link named both ways is firm; a link named only one way is kept
as a weaker candidate, so a point is still checked there but a verdict that
rests on it alone is marked for review.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field

from loguru import logger
from pydantic import BaseModel, Field

from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.segments import KpDocument, KpSection
from backend.services.kp_compare.text import fold_plain, shorten
from backend.services.kp_compare.tz_objects import TzObject
from backend.services.llm.prompts.kp_compare import build_align_prompt

_SECTIONS_PER_CALL = 80
_SAMPLE_POINTS = 6


class _ForwardEntry(BaseModel):
    object: str = ""
    sections: list[str] = Field(default_factory=list)


class _ForwardResult(BaseModel):
    objects: list[_ForwardEntry] = Field(default_factory=list)


class _BackwardEntry(BaseModel):
    section: str = ""
    objects: list[str] = Field(default_factory=list)


class _BackwardResult(BaseModel):
    sections: list[_BackwardEntry] = Field(default_factory=list)


@dataclass
class Alignment:
    """Offer sections of every TZ object: firm links and weaker ones."""

    firm: dict[str, list[str]] = field(default_factory=dict)
    weak: dict[str, list[str]] = field(default_factory=dict)

    def scope(self, object_id: str) -> list[str]:
        return [*self.firm.get(object_id, []), *self.weak.get(object_id, [])]

    def is_firm(self, object_id: str, section_id: str) -> bool:
        return section_id in self.firm.get(object_id, [])


def _objects_block(objects: list[TzObject]) -> str:
    lines: list[str] = []
    for obj in objects:
        samples = "; ".join(
            f"«{shorten(point.text, 90)}»"
            for point in obj.points[:_SAMPLE_POINTS]
        )
        lines.append(
            f"{obj.id} [{obj.kind}] {obj.title} "
            f"({len(obj.points)} пунктов) — например: {samples}"
        )
    return "\n".join(lines)


def _section_line(document: KpDocument, section: KpSection) -> str:
    body = document.render(section, limit=600)
    first_break = body.find("\n")
    excerpt = shorten(
        body[first_break + 1 :] if first_break >= 0 else body, 220
    )
    where = "; ".join(
        part
        for part in (section.kind, section.pages, section.position)
        if part
    )
    title = section.title
    if section.title_ru and section.title_ru != section.title:
        title = f"{title} ({section.title_ru})"
    return f"{section.id} [{where}] {title} — «{excerpt}»"


_STEM = 5
_ALIKE_MIN_WORDS = 2
_ALIKE_MAX_SECTIONS = 3
# words in nearly every equipment name, which say nothing about the object
_COMMON_STEMS = frozenset(
    {
        "автом",
        "систе",
        "машин",
        "обору",
        "устан",
        "издел",
        "едини",
        "налич",
        "конст",
        "проду",
        "должн",
        "долже",
        "обесп",
        "функц",
        "транс",
        "необх",
        "котор",
        "соотв",
        "работ",
        "участ",
        "требо",
        "испол",
        "между",
        "также",
        "через",
        "после",
        "перед",
    }
)
_WORD_RE = re.compile(r"[а-яё]+")


def _stems(text: str) -> set[str]:
    words = _WORD_RE.findall(fold_plain(text))
    return {
        word[:_STEM]
        for word in words
        if len(word) >= _STEM and word[:_STEM] not in _COMMON_STEMS
    }


def _named_alike(obj: TzObject, sections: list[KpSection]) -> set[str]:
    """Sections whose Russian name shares two telling words with the object.

    A second signal beside the model's: «Трейсилер с мультиголовочным
    весовым дозатором» and «Многоголовочный весовой дозатор» name the same
    machine whichever way the model read them. Such a link is only weak.
    """
    if obj.kind != "equipment":
        return set()
    wanted = _stems(obj.title)
    if len(wanted) < _ALIKE_MIN_WORDS:
        return set()
    scored = sorted(
        (
            (len(wanted & _stems(section.title_ru)), index, section.id)
            for index, section in enumerate(sections)
            if section.kind == "equipment"
        ),
        key=lambda item: (-item[0], item[1]),
    )
    return {
        section_id
        for shared, _, section_id in scored[:_ALIKE_MAX_SECTIONS]
        if shared >= _ALIKE_MIN_WORDS
    }


def _valid(ids: list[str], known: set[str]) -> list[str]:
    seen: list[str] = []
    for raw in ids:
        value = str(raw).strip()
        if value in known and value not in seen:
            seen.append(value)
    return seen


async def align_objects(
    objects: list[TzObject],
    document: KpDocument,
    calls: ModelCalls,
) -> Alignment:
    """Link every TZ object to the offer sections that describe it."""
    candidates = [s for s in document.sections if not s.is_shared]
    if not objects or not candidates:
        return Alignment()
    objects_text = _objects_block(objects)
    object_ids = {obj.id for obj in objects}
    groups = [
        candidates[i : i + _SECTIONS_PER_CALL]
        for i in range(0, len(candidates), _SECTIONS_PER_CALL)
    ]

    async def ask(
        group: list[KpSection], backward: bool
    ) -> dict[str, set[str]]:
        sections_text = "\n".join(_section_line(document, s) for s in group)
        section_ids = {s.id for s in group}
        system, user = build_align_prompt(
            objects_text, sections_text, backward=backward
        )
        links: dict[str, set[str]] = {}
        try:
            if backward:
                back = await calls.json(
                    "align_backward",
                    system,
                    user,
                    _BackwardResult,
                    thinking=False,
                )
                for entry in back.sections:
                    section = entry.section.strip()
                    if section not in section_ids:
                        continue
                    for obj in _valid(entry.objects, object_ids):
                        links.setdefault(obj, set()).add(section)
            else:
                forward = await calls.json(
                    "align_forward",
                    system,
                    user,
                    _ForwardResult,
                    thinking=False,
                )
                for entry in forward.objects:
                    obj = entry.object.strip()
                    if obj not in object_ids:
                        continue
                    links.setdefault(obj, set()).update(
                        _valid(entry.sections, section_ids)
                    )
        except ModelAccessError:
            raise
        except Exception as exc:
            logger.warning(
                "KP alignment call failed",
                analysis_id=calls.analysis_id,
                kp_name=calls.kp_name,
                backward=backward,
                error=str(exc)[:300],
            )
        return links

    answers = await asyncio.gather(
        *(
            ask(group, backward)
            for group in groups
            for backward in (False, True)
        )
    )
    forward: dict[str, set[str]] = {}
    backward: dict[str, set[str]] = {}
    for index, links in enumerate(answers):
        target = backward if index % 2 else forward
        for obj, sections in links.items():
            target.setdefault(obj, set()).update(sections)

    order = {s.id: index for index, s in enumerate(document.sections)}
    alignment = Alignment()
    for obj in objects:
        named_forward = forward.get(obj.id, set())
        named_backward = backward.get(obj.id, set())
        firm = sorted(named_forward & named_backward, key=order.__getitem__)
        weak = sorted(
            (named_forward | named_backward | _named_alike(obj, candidates))
            - set(firm),
            key=order.__getitem__,
        )
        if firm:
            alignment.firm[obj.id] = firm
        if weak:
            alignment.weak[obj.id] = weak
    logger.info(
        "KP sections aligned with TZ objects",
        analysis_id=calls.analysis_id,
        kp_name=calls.kp_name,
        objects=len(objects),
        with_firm=len(alignment.firm),
        only_weak=sum(
            1
            for obj in objects
            if obj.id not in alignment.firm and obj.id in alignment.weak
        ),
        without_sections=sum(
            1 for obj in objects if not alignment.scope(obj.id)
        ),
    )
    return alignment
