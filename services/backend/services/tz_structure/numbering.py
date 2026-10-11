"""Compute Word automatic numbering the way Word renders it.

Automatic numbers are not stored in paragraph text: Word derives them from
``numbering.xml`` while laying out the document. This module replays that
logic so every paragraph gets the exact label the reader sees.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass, field

from backend.services.tz_structure._xml import (
    is_on,
    mc,
    to_int,
    val,
    w,
)
from backend.services.tz_structure.model import Label, LabelKind

MAX_LEVELS = 9
# Word's Russian lettered lists skip ё, й, ъ, ь.
_RU_LOWER = "абвгдежзиклмнопрстуфхцчшщыэюя"
_LAT_LOWER = "abcdefghijklmnopqrstuvwxyz"
_LETTER_FORMATS = {
    "lowerLetter": (_LAT_LOWER, "lat-lower"),
    "upperLetter": (_LAT_LOWER.upper(), "lat-upper"),
    "russianLower": (_RU_LOWER, "ru-lower"),
    "russianUpper": (_RU_LOWER.upper(), "ru-upper"),
}
_ROMAN_FORMATS = {"lowerRoman": "lower", "upperRoman": "upper"}
_SECTION_WORDS = (
    "приложение",
    "подраздел",
    "раздел",
    "глава",
    "часть",
    "лот",
    "этап",
    "статья",
    "позиция",
    "таблица",
)
_REF_RE = re.compile(r"%([1-9])")


def to_roman(number: int) -> str:
    if number <= 0:
        return str(number)
    pairs = (
        (1000, "M"),
        (900, "CM"),
        (500, "D"),
        (400, "CD"),
        (100, "C"),
        (90, "XC"),
        (50, "L"),
        (40, "XL"),
        (10, "X"),
        (9, "IX"),
        (5, "V"),
        (4, "IV"),
        (1, "I"),
    )
    result = []
    for value, symbol in pairs:
        while number >= value:
            result.append(symbol)
            number -= value
    return "".join(result)


def _to_letters(number: int, alphabet: str) -> str:
    """Word repeats the letter after the alphabet ends: z, aa, bb, ..."""
    if number <= 0:
        return str(number)
    size = len(alphabet)
    return alphabet[(number - 1) % size] * ((number - 1) // size + 1)


def format_number(number: int, fmt: str) -> str:
    if fmt in _LETTER_FORMATS:
        return _to_letters(number, _LETTER_FORMATS[fmt][0])
    if fmt == "upperRoman":
        return to_roman(number)
    if fmt == "lowerRoman":
        return to_roman(number).lower()
    if fmt == "decimalZero":
        return f"{number:02d}"
    if fmt == "none":
        return ""
    return str(number)


@dataclass
class _Level:
    ilvl: int
    start: int = 0
    fmt: str = "decimal"
    text: str = ""
    restart: int | None = None
    is_lgl: bool = False
    pstyle: str | None = None
    indent: int | None = None


@dataclass
class _Num:
    abstract_id: str
    start_overrides: dict[int, int] = field(default_factory=dict)
    level_overrides: dict[int, _Level] = field(default_factory=dict)


def _parse_level(element) -> _Level | None:
    ilvl = to_int(element.get(w("ilvl")))
    if ilvl is None:
        return None
    fmt_el = element.find(w("numFmt"))
    if fmt_el is None:
        fmt_el = element.find(
            f"{mc('AlternateContent')}/{mc('Fallback')}/{w('numFmt')}"
        )
    level = _Level(ilvl=ilvl)
    level.start = to_int(val(element, "start"), 0) or 0
    if fmt_el is not None:
        level.fmt = fmt_el.get(w("val")) or "decimal"
    level.text = val(element, "lvlText") or ""
    level.restart = to_int(val(element, "lvlRestart"))
    lgl = element.find(w("isLgl"))
    level.is_lgl = lgl is not None and is_on(lgl)
    level.pstyle = val(element, "pStyle")
    ppr = element.find(w("pPr"))
    if ppr is not None:
        ind = ppr.find(w("ind"))
        if ind is not None:
            level.indent = to_int(ind.get(w("left")) or ind.get(w("start")))
    return level


class NumberingResolver:
    """Stateful replay of list counters in document order."""

    def __init__(
        self,
        root=None,
        numbering_style_num_id: Callable[[str], str | None] | None = None,
    ) -> None:
        self._abstract: dict[str, dict[int, _Level]] = {}
        self._style_link: dict[str, str] = {}
        self._single_level: set[str] = set()
        self._nums: dict[str, _Num] = {}
        self._counters: dict[str, list[int | None]] = {}
        self._override_applied: set[tuple[str, int]] = set()
        self._style_num_id = numbering_style_num_id or (lambda _id: None)
        if root is None:
            return
        for element in root.findall(w("abstractNum")):
            abstract_id = element.get(w("abstractNumId"))
            if abstract_id is None:
                continue
            levels: dict[int, _Level] = {}
            for lvl_el in element.findall(w("lvl")):
                level = _parse_level(lvl_el)
                if level is not None:
                    levels[level.ilvl] = level
            self._abstract[abstract_id] = levels
            if val(element, "multiLevelType") == "singleLevel":
                self._single_level.add(abstract_id)
            link = val(element, "numStyleLink")
            if link:
                self._style_link[abstract_id] = link
        for element in root.findall(w("num")):
            num_id = element.get(w("numId"))
            abstract_id = val(element, "abstractNumId")
            if num_id is None or abstract_id is None:
                continue
            num = _Num(abstract_id=abstract_id)
            for override in element.findall(w("lvlOverride")):
                ilvl = to_int(override.get(w("ilvl")))
                if ilvl is None:
                    continue
                start = to_int(val(override, "startOverride"))
                if start is not None:
                    num.start_overrides[ilvl] = start
                lvl_el = override.find(w("lvl"))
                if lvl_el is not None:
                    level = _parse_level(lvl_el)
                    if level is not None:
                        level.ilvl = ilvl
                        num.level_overrides[ilvl] = level
            self._nums[num_id] = num

    def _resolve_abstract(self, abstract_id: str) -> str:
        """Follow numStyleLink to the abstract list that holds the levels."""
        seen: set[str] = set()
        current = abstract_id
        while current in self._style_link and current not in seen:
            seen.add(current)
            linked_num = self._style_num_id(self._style_link[current])
            target = self._nums.get(linked_num or "")
            if target is None:
                break
            current = target.abstract_id
        return current

    def _levels(self, num: _Num) -> dict[int, _Level]:
        levels = dict(
            self._abstract.get(self._resolve_abstract(num.abstract_id), {})
        )
        levels.update(num.level_overrides)
        return levels

    def _level_index(self, num: _Num, ilvl: int) -> int:
        """Level Word really uses: single-level lists ignore ``ilvl``."""
        if self._resolve_abstract(num.abstract_id) in self._single_level:
            return 0
        return max(0, min(MAX_LEVELS - 1, ilvl))

    def is_defined(self, num_id: str) -> bool:
        return num_id in self._nums

    def style_may_use(
        self, num_id: str, ilvl: int, style_ids: list[str]
    ) -> bool:
        """Whether numbering inherited from a style applies at *ilvl*.

        Word ignores style numbering when the list level is linked to a
        different style (``w:pStyle``) outside the paragraph style chain.
        """
        num = self._nums.get(num_id)
        if num is None:
            return False
        level = self._levels(num).get(self._level_index(num, ilvl))
        if level is None:
            return False
        return level.pstyle is None or level.pstyle in style_ids

    def indent_for(self, num_id: str, ilvl: int) -> int | None:
        num = self._nums.get(num_id)
        if num is None:
            return None
        level = self._levels(num).get(self._level_index(num, ilvl))
        return level.indent if level else None

    def next_label(self, num_id: str, ilvl: int) -> Label | None:
        """Advance counters for a numbered paragraph and render its label.

        Returns ``None`` when the list is undefined or the level shows no
        visible mark; counters are still advanced in the latter case.
        """
        num = self._nums.get(num_id)
        if num is None:
            return None
        ilvl = self._level_index(num, ilvl)
        levels = self._levels(num)
        level = levels.get(ilvl)
        abstract_id = self._resolve_abstract(num.abstract_id)
        state = self._counters.setdefault(abstract_id, [None] * MAX_LEVELS)

        def start_of(index: int) -> int:
            if index in num.start_overrides:
                return num.start_overrides[index]
            lvl = levels.get(index)
            return lvl.start if lvl else 1

        # Word treats skipped parent levels as already started: a list
        # that opens with "1.1" continues with "2", not "1".
        for parent in range(ilvl):
            if state[parent] is None:
                state[parent] = start_of(parent)
        if level is None:
            # a level the list does not define shows no number in Word
            return None

        key = (num_id, ilvl)
        if ilvl in num.start_overrides and key not in self._override_applied:
            # A list instance with startOverride restarts the shared
            # counter the first time it is used ("Restart numbering").
            self._override_applied.add(key)
            state[ilvl] = start_of(ilvl)
        elif state[ilvl] is None:
            state[ilvl] = start_of(ilvl)
        else:
            state[ilvl] += 1

        for deeper in range(ilvl + 1, MAX_LEVELS):
            deeper_level = levels.get(deeper)
            restart = deeper_level.restart if deeper_level else None
            if restart == 0:
                continue
            if restart is None or ilvl < restart:
                state[deeper] = None

        def value_of(index: int) -> int:
            current = state[index]
            return start_of(index) if current is None else current

        own_value = value_of(ilvl)
        if level.fmt == "bullet":
            return Label(
                raw=_bullet_char(level.text),
                kind=LabelKind.BULLET,
                auto=True,
                list_id=abstract_id,
                level=ilvl,
            )

        refs = [int(digit) - 1 for digit in _REF_RE.findall(level.text)]

        def render_ref(match: re.Match) -> str:
            index = int(match.group(1)) - 1
            ref_level = levels.get(index)
            fmt = ref_level.fmt if ref_level else "decimal"
            if level.is_lgl:
                fmt = "decimal"
            return format_number(value_of(index), fmt)

        raw = _REF_RE.sub(render_ref, level.text).strip()
        if not raw:
            return None
        if not refs:
            # Constant text instead of a number behaves like a bullet.
            return Label(
                raw=raw,
                kind=LabelKind.BULLET,
                auto=True,
                list_id=abstract_id,
                level=ilvl,
            )

        own_fmt = "decimal" if level.is_lgl else level.fmt
        prefix = level.text.split("%", 1)[0]
        word = re.sub(r"[^A-Za-zА-Яа-яЁё]", "", prefix).lower()
        suffix = raw[-1] if raw[-1] in ".)" else ""
        values = tuple(value_of(index) for index in refs)
        common = {
            "raw": raw,
            "suffix": suffix,
            "auto": True,
            "list_id": abstract_id,
            "level": ilvl,
        }
        if word in _SECTION_WORDS:
            return Label(kind=LabelKind.WORD, nums=values, word=word, **common)
        if own_fmt in _LETTER_FORMATS:
            return Label(
                kind=LabelKind.LETTER,
                nums=(own_value,),
                script=_LETTER_FORMATS[own_fmt][1],
                **common,
            )
        if own_fmt in _ROMAN_FORMATS:
            return Label(
                kind=LabelKind.ROMAN,
                nums=(own_value,),
                script=_ROMAN_FORMATS[own_fmt],
                **common,
            )
        return Label(kind=LabelKind.DECIMAL, nums=values, **common)


def _bullet_char(text: str) -> str:
    """Printable bullet; Symbol/Wingdings private-use glyphs become ``•``."""
    char = text.strip()[:1]
    if not char or 0xE000 <= ord(char) <= 0xF8FF:
        return "•"
    return char
