"""Paragraph styles of a Word document (styles.xml) with inheritance."""

from __future__ import annotations

import re
from dataclasses import dataclass

from backend.services.tz_structure._xml import flag, to_int, val, w

_HEADING_NAME_RE = re.compile(r"^(?:heading|заголовок)\s*([1-9])$", re.I)
_TOC_NAME_RE = re.compile(
    r"^(?:toc\s*\d|toc heading|оглавление\s*\d|заголовок оглавления"
    r"|table of figures|перечень рисунков)",
    re.I,
)
_TITLE_NAMES = {"title", "subtitle", "название", "подзаголовок"}


@dataclass
class _Style:
    id: str
    name: str = ""
    type: str = "paragraph"
    based_on: str | None = None
    num_id: str | None = None
    ilvl: int | None = None
    outline: int | None = None
    bold: bool | None = None
    caps: bool | None = None
    align: str | None = None
    indent: int | None = None


class StyleSheet:
    """Resolve effective paragraph properties through ``basedOn`` chains."""

    def __init__(self, root=None) -> None:
        self._styles: dict[str, _Style] = {}
        self.default_paragraph = ""
        if root is None:
            return
        for element in root.iter(w("style")):
            style_id = element.get(w("styleId"))
            if not style_id:
                continue
            style = _Style(
                id=style_id,
                name=(val(element, "name") or "").strip(),
                type=element.get(w("type")) or "paragraph",
                based_on=val(element, "basedOn"),
            )
            ppr = element.find(w("pPr"))
            if ppr is not None:
                numpr = ppr.find(w("numPr"))
                if numpr is not None:
                    style.num_id = val(numpr, "numId")
                    style.ilvl = to_int(val(numpr, "ilvl"))
                style.outline = to_int(val(ppr, "outlineLvl"))
                style.align = val(ppr, "jc")
                ind = ppr.find(w("ind"))
                if ind is not None:
                    style.indent = to_int(
                        ind.get(w("left")) or ind.get(w("start"))
                    )
            rpr = element.find(w("rPr"))
            if rpr is not None:
                style.bold = flag(rpr, "b")
                style.caps = flag(rpr, "caps")
            self._styles[style_id] = style
            is_default = element.get(w("default")) in ("1", "true")
            if is_default and style.type == "paragraph":
                self.default_paragraph = style_id

    def chain(self, style_id: str) -> list[_Style]:
        result: list[_Style] = []
        seen: set[str] = set()
        current = style_id
        while current and current not in seen and current in self._styles:
            seen.add(current)
            style = self._styles[current]
            result.append(style)
            current = style.based_on or ""
        return result

    def chain_ids(self, style_id: str) -> list[str]:
        return [style.id for style in self.chain(style_id)]

    def get(self, style_id: str, attr: str):
        """First non-empty value of *attr* along the inheritance chain."""
        for style in self.chain(style_id):
            value = getattr(style, attr)
            if value is not None:
                return value
        return None

    def numbering(self, style_id: str) -> tuple[str, int | None] | None:
        """(numId, ilvl) from the nearest style in the chain that sets it."""
        for style in self.chain(style_id):
            if style.num_id is not None:
                return style.num_id, style.ilvl
        return None

    def name(self, style_id: str) -> str:
        style = self._styles.get(style_id)
        return style.name if style else ""

    def heading_level(self, style_id: str) -> int | None:
        """Heading level 1..9 by outline level or built-in style name."""
        for style in self.chain(style_id):
            if style.outline is not None:
                if 0 <= style.outline <= 8:
                    return style.outline + 1
                return None
            match = _HEADING_NAME_RE.match(style.name)
            if match:
                return int(match.group(1))
        return None

    def is_title(self, style_id: str) -> bool:
        return any(
            style.name.lower() in _TITLE_NAMES
            for style in self.chain(style_id)
        )

    def is_toc(self, style_id: str) -> bool:
        return any(
            _TOC_NAME_RE.match(style.name) for style in self.chain(style_id)
        )

    def numbering_style_num_id(self, style_id: str) -> str | None:
        """``numId`` referenced by a numbering style (for numStyleLink)."""
        style = self._styles.get(style_id)
        return style.num_id if style else None
