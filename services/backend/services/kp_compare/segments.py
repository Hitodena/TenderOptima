"""Cut a commercial offer into its sections.

The model only names where each section starts (the heading line as it is
written); the code finds those lines in the text and cuts there, so every
section is an exact slice of the offer and every quote can be checked
against it. Lines repeated on most pages (letterhead, footers) are left out
of what the model reads.
"""

from __future__ import annotations

import asyncio
import re
from bisect import bisect_left
from collections import Counter
from dataclasses import dataclass, field

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.text import (
    FoldedText,
    PageIndex,
    fold,
    fold_plain,
    latin_share,
    shorten,
)
from backend.services.llm.prompts.kp_compare import (
    SECTION_KINDS,
    build_outline_prompt,
)

# kinds that bear on every point of the TZ
SHARED_KINDS = frozenset({"exclusions", "deviations"})

_OUTLINE_CHUNK_CHARS = 20_000
_MIN_BODY_CHARS = 60
_PAGE_MARK_LINE_RE = re.compile(r"^\s*---\s*Страница\s+(\d+)\s*---\s*$")


class _OutlineEntry(BaseModel):
    anchor: str = ""
    position: str | None = None
    title: str = ""
    title_ru: str = ""
    kind: str = "other"

    @field_validator("kind", mode="before")
    @classmethod
    def _known_kind(cls, value: object) -> str:
        kind = str(value or "").strip().lower()
        return kind if kind in SECTION_KINDS else "other"


class _OutlineResult(BaseModel):
    sections: list[_OutlineEntry] = Field(default_factory=list)


@dataclass
class KpSection:
    """A slice of one offer file: a position, a service, a condition list."""

    id: str
    file: str
    kind: str
    title: str
    title_ru: str
    position: str | None
    start: int
    end: int
    page_from: int | None
    page_to: int | None
    text: str

    @property
    def is_shared(self) -> bool:
        return self.kind in SHARED_KINDS

    @property
    def label(self) -> str:
        """How the section is named in references: «Item 6 «PUMP»»."""
        name = self.title or self.title_ru or "раздел КП"
        if self.position and fold_plain(self.position) not in fold_plain(name):
            return f"{self.position} «{name}»"
        return f"«{name}»"

    @property
    def pages(self) -> str:
        if self.page_from is None:
            return ""
        if self.page_to is None or self.page_to == self.page_from:
            return f"стр. {self.page_from}"
        return f"стр. {self.page_from}–{self.page_to}"


@dataclass
class KpPart:
    """One offer file: its text, page marks and folded form."""

    name: str
    text: str
    pages: PageIndex = field(init=False)
    folded: FoldedText = field(init=False)
    boilerplate: frozenset[str] = field(init=False)

    def __post_init__(self) -> None:
        self.text = self.text.replace("\r\n", "\n").replace("\r", "\n")
        self.pages = PageIndex(self.text)
        self.folded = fold(self.text)
        self.boilerplate = _boilerplate_lines(self.text)

    def folded_index(self, source_offset: int) -> int:
        """First folded position at or after *source_offset*."""
        return bisect_left(self.folded.origin, source_offset)


@dataclass
class KpDocument:
    """The offer of one supplier, cut into sections."""

    parts: list[KpPart]
    sections: list[KpSection]

    @property
    def language(self) -> str:
        sample = " ".join(part.text[:20_000] for part in self.parts)
        if latin_share(sample) > 0.5:
            return "английский или другой язык на латинице"
        return "русский"

    def part(self, name: str) -> KpPart:
        for part in self.parts:
            if part.name == name:
                return part
        raise KeyError(name)

    def section(self, section_id: str) -> KpSection | None:
        for section in self.sections:
            if section.id == section_id:
                return section
        return None

    def render(self, section: KpSection, *, limit: int | None = None) -> str:
        """Text of *section* for a prompt: no letterhead, pages as [стр. N]."""
        part = self.part(section.file)
        lines: list[str] = []
        for line in section.text.split("\n"):
            mark = _PAGE_MARK_LINE_RE.match(line)
            if mark:
                lines.append(f"[стр. {mark.group(1)}]")
                continue
            stripped = " ".join(line.split())
            if not stripped or fold_plain(stripped) in part.boilerplate:
                continue
            lines.append(stripped)
        body = "\n".join(lines)
        if limit is not None and len(body) > limit:
            body = body[:limit].rstrip() + "\n[… раздел обрезан]"
        return body


def _boilerplate_lines(text: str) -> frozenset[str]:
    """Lines repeated on most pages: letterhead, footers, page counters."""
    pages = re.split(r"---\s*Страница\s+\d+\s*---", text)
    if len(pages) < 4:
        return frozenset()
    counts: Counter[str] = Counter()
    for page in pages:
        seen = {
            fold_plain(line)
            for line in page.split("\n")
            if 3 <= len(line.strip()) <= 160
        }
        counts.update(seen)
    threshold = max(3, int(len(pages) * 0.3))
    return frozenset(line for line, n in counts.items() if n >= threshold)


def _outline_chunks(text: str) -> list[tuple[int, int]]:
    """Spans of about ``_OUTLINE_CHUNK_CHARS``, cut at page marks or lines."""
    spans: list[tuple[int, int]] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(length, start + _OUTLINE_CHUNK_CHARS)
        if end < length:
            window = text[start:end]
            cut = max(window.rfind("--- Страница"), 0)
            if cut < len(window) // 2:
                cut = window.rfind("\n")
            if cut > len(window) // 2:
                end = start + cut
        spans.append((start, end))
        start = end
    return spans


def _line_start_before(text: str, offset: int) -> bool:
    """True when only spaces stand between the previous newline and *offset*."""
    index = offset - 1
    while index >= 0 and text[index] in " \t":
        index -= 1
    return index < 0 or text[index] == "\n"


def _locate_anchor(
    part: KpPart, anchor: str, start: int, end: int
) -> int | None:
    """Source offset where the heading *anchor* starts inside [start, end)."""
    needle = fold_plain(anchor).strip()
    if len(needle) < 3:
        return None
    folded_start = part.folded_index(start)
    folded_end = part.folded_index(end)
    haystack = part.folded.text
    best: tuple[int, int] | None = None
    position = haystack.find(needle, folded_start, folded_end)
    while position >= 0:
        source = part.folded.origin[position]
        score = 0
        if _line_start_before(part.text, source):
            score = 1
            line_end = part.text.find("\n", source)
            line = part.text[source : line_end if line_end >= 0 else None]
            if fold_plain(line).startswith(needle):
                score = 2
        if best is None or score > best[0]:
            best = (score, source)
            if score == 2:
                break
        position = haystack.find(needle, position + 1, folded_end)
    return None if best is None else best[1]


@dataclass
class _Start:
    offset: int
    entry: _OutlineEntry


def _build_sections(part: KpPart, starts: list[_Start]) -> list[_Start]:
    """Sorted starts without duplicates and without empty heading slices."""
    starts = sorted(starts, key=lambda s: s.offset)
    unique: list[_Start] = []
    for start in starts:
        if unique and start.offset - unique[-1].offset <= 2:
            continue
        unique.append(start)
    if not unique or unique[0].offset > 0:
        unique.insert(
            0,
            _Start(0, _OutlineEntry(title="Начало КП", title_ru="Начало КП")),
        )
    merged: list[_Start] = []
    for index, start in enumerate(unique):
        end = (
            unique[index + 1].offset
            if index + 1 < len(unique)
            else len(part.text)
        )
        slice_text = part.text[start.offset : end]
        first_newline = slice_text.find("\n")
        body = slice_text[first_newline + 1 :] if first_newline >= 0 else ""
        body_chars = len(re.sub(r"\s+|---\s*Страница\s+\d+\s*---", "", body))
        if (
            body_chars < _MIN_BODY_CHARS
            and index + 1 < len(unique)
            and start.offset > 0
        ):
            following = unique[index + 1]
            following.entry = following.entry.model_copy(
                update={
                    "position": start.entry.position
                    or following.entry.position,
                    "title": following.entry.title or start.entry.title,
                    "title_ru": following.entry.title_ru
                    or start.entry.title_ru,
                }
            )
            following.offset = start.offset
            continue
        merged.append(start)
    return merged


_FALLBACK_SLICE_CHARS = 12_000
_POSITION_WINDOW = 300


def _page_slices(part: KpPart) -> list[_Start]:
    """Starts every few pages, for an offer whose sections were not found."""
    marks = [
        m.start() for m in re.finditer(r"---\s*Страница\s+\d+", part.text)
    ]
    starts = [0]
    for mark in marks:
        if mark - starts[-1] >= _FALLBACK_SLICE_CHARS:
            starts.append(mark)
    if len(starts) == 1:
        starts = list(range(0, len(part.text), _FALLBACK_SLICE_CHARS))
    result: list[_Start] = []
    for index, offset in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else len(part.text)
        first, last = part.pages.page_range(offset, end)
        name = (
            f"Страницы {first}–{last}"
            if first is not None and last != first
            else f"Страница {first}"
            if first is not None
            else f"Фрагмент {index + 1}"
        )
        result.append(_Start(offset, _OutlineEntry(title=name, title_ru=name)))
    return result


async def _outline_part(part: KpPart, calls: ModelCalls) -> list[_Start]:
    spans = _outline_chunks(part.text)

    async def ask(index: int, span: tuple[int, int]) -> list[_Start]:
        system, user = build_outline_prompt(
            part.text[span[0] : span[1]],
            chunk_no=index + 1,
            total=len(spans),
        )
        try:
            result = await calls.json(
                "kp_outline", system, user, _OutlineResult, thinking=False
            )
        except ModelAccessError:
            raise
        except Exception as exc:
            logger.warning(
                "KP outline chunk failed",
                analysis_id=calls.analysis_id,
                kp_name=calls.kp_name,
                chunk=index + 1,
                error=str(exc)[:300],
            )
            return []
        found: list[_Start] = []
        for entry in result.sections:
            offset = _locate_anchor(part, entry.anchor, span[0], span[1])
            if offset is None:
                calls.stats["kp_outline:anchor_missed"] += 1
                continue
            found.append(_Start(offset, entry))
        return found

    groups = await asyncio.gather(
        *(ask(index, span) for index, span in enumerate(spans))
    )
    return [start for group in groups for start in group]


def _own_position(position: str | None, text: str) -> str | None:
    """The position number, if the section itself starts with it.

    The model sometimes takes the number from a summary table elsewhere;
    a number the section does not show would only mislead the reader.
    """
    value = (position or "").strip()
    if not value:
        return None
    head = fold_plain(text[:_POSITION_WINDOW])
    return value if fold_plain(value) in head else None


async def segment_offer(
    parts: list[tuple[str, str]], calls: ModelCalls
) -> KpDocument:
    """Cut every file of the offer into sections (ids S1, S2, …)."""
    kp_parts = [KpPart(name, text) for name, text in parts if text.strip()]
    outlines = await asyncio.gather(
        *(_outline_part(part, calls) for part in kp_parts)
    )
    sections: list[KpSection] = []
    for part, starts in zip(kp_parts, outlines, strict=True):
        ordered = _build_sections(part, starts)
        if len(ordered) <= 1 and len(part.text) > _FALLBACK_SLICE_CHARS:
            # nothing recognised: page slices still keep each prompt small
            ordered = _page_slices(part)
            calls.stats["kp_outline:page_fallback"] += 1
        for index, start in enumerate(ordered):
            end = (
                ordered[index + 1].offset
                if index + 1 < len(ordered)
                else len(part.text)
            )
            if not part.text[start.offset : end].strip():
                continue
            page_from, page_to = part.pages.page_range(start.offset, end)
            entry = start.entry
            title = shorten(entry.title or entry.anchor, 120)
            sections.append(
                KpSection(
                    id=f"S{len(sections) + 1}",
                    file=part.name,
                    kind=entry.kind,
                    title=title,
                    title_ru=shorten(entry.title_ru, 120),
                    position=_own_position(
                        entry.position, part.text[start.offset : end]
                    ),
                    start=start.offset,
                    end=end,
                    page_from=page_from,
                    page_to=page_to,
                    text=part.text[start.offset : end],
                )
            )
    logger.info(
        "KP sections found",
        analysis_id=calls.analysis_id,
        kp_name=calls.kp_name,
        files=len(kp_parts),
        sections=len(sections),
        shared=sum(1 for s in sections if s.is_shared),
        kinds=dict(Counter(s.kind for s in sections)),
    )
    return KpDocument(parts=kp_parts, sections=sections)
