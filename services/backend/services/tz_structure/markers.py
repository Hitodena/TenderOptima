"""Recognise numbering typed by hand at the start of a paragraph."""

from __future__ import annotations

import re
from dataclasses import dataclass

from backend.services.tz_structure.model import Label, LabelKind
from backend.services.tz_structure.numbering import to_roman

RU_FULL = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"
RU_SKIPPABLE = frozenset("ёйъыь")
LAT = "abcdefghijklmnopqrstuvwxyz"
# Latin letters typed by mistake inside a Cyrillic list (same glyph).
_LOOKALIKE = str.maketrans("aceopxyABCEHKMOPTX", "асеорхуАВСЕНКМОРТХ")

SCOPE_WORDS = frozenset({"приложение", "лот"})
SECTION_WORDS = (
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

_SP = r"[ \t ]"
_RE_WORD = re.compile(
    r"^(?P<word>(?i:"
    + "|".join(SECTION_WORDS)
    + r"))"
    + _SP
    + r"*(?:(?:№|N|No\.?)"
    + _SP
    + r"*)?"
    r"(?P<num>\d{1,3}(?:\.\d{1,3}){0,4}|[IVXLCDM]{1,7}|[А-ЯЁA-Z])"
    r"(?P<suf>[.:)]?)(?=" + _SP + r"|$)"
)
_RE_DEC = re.compile(
    r"^(?P<num>\d{1,3}(?:\.\d{1,3}){0,7})(?P<suf>[.)])?"
    r"(?P<sep>" + _SP + r"+|$)"
)
# "1.1.Текст" — no space after the mark, text starts with a capital.
_RE_DEC_TIGHT = re.compile(
    r"^(?P<num>\d{1,3}(?:\.\d{1,3}){0,7})(?P<suf>[.)])"
    r"(?=[A-ZА-ЯЁ«\"„(])"
)
_RE_ROMAN = re.compile(
    r"^(?P<rom>[IVXLCDM]{1,7})(?P<suf>[.)])(?P<sep>" + _SP + r"+|$)"
)
_RE_LETTER_PAREN = re.compile(
    r"^\(?(?P<let>[а-яёa-zА-ЯЁA-Z])\)(?P<sep>" + _SP + r"+|$|(?=\S))"
)
_RE_LETTER_DOT = re.compile(
    r"^(?P<let>[А-ЯЁA-Z])\.(?P<sep>" + _SP + r"+)(?=\S)"
)
_RE_BULLET = re.compile(
    r"^(?P<b>[-–—−•·▪■□●○◦‣⁃*])"
    r"(?P<sep>" + _SP + r"+)(?=\S)"
)


# "-страна, регион": a dash glued to a lowercase word is still a list mark
_RE_BULLET_TIGHT = re.compile(r"^[-–—](?=[а-яёa-z])")


@dataclass(frozen=True)
class ManualMark:
    label: Label
    rest: str
    weak: bool = False  # needs confirmation by the surrounding sequence


def roman_to_int(text: str) -> int | None:
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    upper = text.upper()
    total = 0
    previous = 0
    for char in reversed(upper):
        value = values.get(char)
        if value is None:
            return None
        if value < previous:
            total -= value
        else:
            total += value
            previous = value
    if total <= 0 or to_roman(total) != upper:
        return None
    return total


def letter_info(char: str) -> tuple[str, int] | None:
    """Return (script, ordinal) for a list letter."""
    lower = char.lower()
    case = "lower" if char == lower else "upper"
    if lower in RU_FULL:
        return f"ru-{case}", RU_FULL.index(lower) + 1
    if lower in LAT:
        return f"lat-{case}", LAT.index(lower) + 1
    return None


def letter_follows(previous: int, current: int, script: str) -> bool:
    """True when *current* is the next list letter after *previous*.

    Russian lists usually skip ё, й, ъ, ы, ь, so a jump over them is still
    a regular continuation.
    """
    if current <= previous:
        return False
    if not script.startswith("ru"):
        return current == previous + 1
    skipped = RU_FULL[previous : current - 1]
    return all(char in RU_SKIPPABLE for char in skipped)


def as_cyrillic(char: str) -> str:
    """Cyrillic twin of a Latin look-alike letter (or the char itself)."""
    return char.translate(_LOOKALIKE)


def _strip_title(text: str) -> str:
    return text.lstrip(" \t ").lstrip(".:–—-").lstrip(" \t ")


def split_manual_label(text: str) -> ManualMark | None:
    """Split typed numbering from the paragraph text.

    The result is only a candidate: the outline builder accepts it when it
    fits the numbering sequence around it.
    """
    stripped = text.lstrip(" \t ")
    if not stripped:
        return None

    match = _RE_WORD.match(stripped)
    if match:
        raw_num = match.group("num")
        nums: tuple[int, ...]
        if raw_num[0].isdigit():
            nums = tuple(int(part) for part in raw_num.split("."))
        else:
            roman = roman_to_int(raw_num)
            if roman is not None and not (
                len(raw_num) == 1 and raw_num in "CDML"
            ):
                nums = (roman,)
            else:
                info = letter_info(raw_num)
                if info is None:
                    return None
                nums = (info[1],)
        label = Label(
            raw=match.group(0).rstrip(".:)").strip(),
            kind=LabelKind.WORD,
            nums=nums,
            suffix=match.group("suf"),
            word=match.group("word").lower(),
        )
        return ManualMark(label, _strip_title(stripped[match.end() :]))

    match = _RE_DEC.match(stripped) or _RE_DEC_TIGHT.match(stripped)
    if match:
        parts = match.group("num").split(".")
        suffix = match.group("suf") or ""
        sep = match.groupdict().get("sep") or ""
        has_tab = "\t" in sep
        leading_zero = any(len(part) > 1 and part[0] == "0" for part in parts)
        single_bare = len(parts) == 1 and not suffix and not has_tab
        rest = stripped[match.end() :].lstrip()
        # "1 Сведения о себе": a number without a dot is a mark only if
        # the builder later finds its sub-points (1.1, 1.2 ...).
        plausible_bare = len(parts[0]) <= 2 and rest[:1].isupper()
        if not leading_zero and (not single_bare or plausible_bare):
            label = Label(
                raw=match.group("num") + suffix,
                kind=LabelKind.DECIMAL,
                nums=tuple(int(part) for part in parts),
                suffix=suffix,
                tab=has_tab,
            )
            return ManualMark(label, rest, weak=single_bare)

    match = _RE_ROMAN.match(stripped)
    if match:
        raw_num = match.group("rom")
        value = roman_to_int(raw_num)
        if value is not None and not (len(raw_num) == 1 and raw_num in "CDML"):
            label = Label(
                raw=raw_num + match.group("suf"),
                kind=LabelKind.ROMAN,
                nums=(value,),
                suffix=match.group("suf"),
                script="upper",
            )
            return ManualMark(label, stripped[match.end() :].lstrip())

    match = _RE_LETTER_PAREN.match(stripped)
    if match:
        info = letter_info(match.group("let"))
        if info is not None:
            raw = stripped[: match.end()].strip()
            label = Label(
                raw=raw,
                kind=LabelKind.LETTER,
                nums=(info[1],),
                suffix=")",
                script=info[0],
            )
            return ManualMark(label, stripped[match.end() :].lstrip())

    match = _RE_LETTER_DOT.match(stripped)
    if match:
        info = letter_info(match.group("let"))
        if info is not None:
            label = Label(
                raw=match.group("let") + ".",
                kind=LabelKind.LETTER,
                nums=(info[1],),
                suffix=".",
                script=info[0],
            )
            return ManualMark(
                label, stripped[match.end() :].lstrip(), weak=True
            )

    match = _RE_BULLET.match(stripped) or _RE_BULLET_TIGHT.match(stripped)
    if match:
        label = Label(raw="–", kind=LabelKind.BULLET)
        return ManualMark(label, stripped[match.end() :].lstrip())

    return None
