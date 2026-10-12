"""Places where the offer names a clause of the TZ by its number.

A deviation list usually does: «Section 21.2 – Buffer tank 10 m3 … not
included». Each such entry is shown to the model next to every point it
names, so the supplier's own word on a clause is never overlooked. Only the
sections that bear on every point (deviations, exclusions) are read: the
offer's own position numbers elsewhere are not the TZ's.
"""

from __future__ import annotations

import re

from backend.services.kp_compare.segments import KpDocument
from backend.services.kp_compare.text import shorten
from backend.services.kp_compare.tz_objects import TzObject

_NUMBER = r"\d+(?:\.\d+)*"
_REFERENCE_RE = re.compile(
    r"(?:\bsections?|\bsect\.|\bclauses?|\bchapters?|\bпп?\.|\bпункт\w*"
    r"|\bраздел\w*)\s*"
    rf"({_NUMBER}(?:\s*(?:,|;|\band\b|\bи\b|&)\s*{_NUMBER})*)",
    re.IGNORECASE,
)
_ENTRY_CHARS = 320
_HINTS_PER_POINT = 3


def _numbers(group: str) -> list[str]:
    return re.findall(_NUMBER, group)


def _covers(reference: str, number: str) -> bool:
    """True when the TZ point *number* is *reference* or lies under it."""
    return (
        number == reference
        or number.startswith(reference + ".")
        or number.startswith(reference + " (")
    )


def clause_references(document: KpDocument) -> list[tuple[list[str], str]]:
    """(referenced TZ numbers, the offer's entry about them) pairs."""
    found: list[tuple[list[str], str]] = []
    for section in document.sections:
        if not section.is_shared:
            continue
        text = document.render(section)
        matches = list(_REFERENCE_RE.finditer(text))
        for index, match in enumerate(matches):
            end = (
                matches[index + 1].start()
                if index + 1 < len(matches)
                else len(text)
            )
            entry = shorten(text[match.start() : end], _ENTRY_CHARS)
            pages = f", {section.pages}" if section.pages else ""
            found.append(
                (
                    _numbers(match.group(1)),
                    f"{section.id}{pages}: «{entry}»",
                )
            )
    return found


def attach_clause_references(
    objects: list[TzObject], document: KpDocument
) -> int:
    """Put every entry next to the points it names; count the points."""
    references = clause_references(document)
    if not references:
        return 0
    touched = 0
    for obj in objects:
        for point in obj.points:
            if not point.number:
                continue
            hints = [
                entry
                for numbers, entry in references
                if any(_covers(n, point.number) for n in numbers)
            ]
            if hints:
                point.hints = hints[:_HINTS_PER_POINT]
                touched += 1
    return touched
