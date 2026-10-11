"""Data model for structure-first TZ extraction from Word documents.

The document number of a point (``label``) is stored verbatim and is never
recalculated: identity lives in ``Node.id``, reading order in ``Node.order``
and nesting in ``Node.children``.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum


class LabelKind(StrEnum):
    DECIMAL = "decimal"  # 1. / 4.2 / 4.2.1.
    LETTER = "letter"  # а) / b) / A.
    ROMAN = "roman"  # IV.
    BULLET = "bullet"  # • / – / -
    WORD = "word"  # Приложение 1 / Раздел 2 / Лот № 3


@dataclass(frozen=True)
class Label:
    """Numbering mark of a paragraph exactly as the reader sees it."""

    raw: str
    kind: LabelKind
    nums: tuple[int, ...] = ()
    suffix: str = ""
    script: str = ""  # letters: ru-lower/ru-upper/lat-lower/lat-upper
    word: str = ""  # WORD: normalized keyword, e.g. "приложение"
    auto: bool = False  # produced by Word automatic numbering
    list_id: str = ""  # auto: abstract numbering id
    level: int = 0  # auto: list level (ilvl)
    tab: bool = False  # manual: separated from the text by a tab


@dataclass
class Paragraph:
    index: int
    text: str
    label: Label | None = None
    style_id: str = ""
    style_name: str = ""
    heading_level: int | None = None
    is_title: bool = False
    bold: bool = False
    caps: bool = False
    align: str = ""
    indent: int = 0
    page: int | None = None
    has_image: bool = False
    is_toc: bool = False
    from_textbox: bool = False
    forced_label: str = ""  # number taken from the label column of a table


@dataclass
class Cell:
    paragraphs: list[Paragraph]
    col: int
    col_span: int = 1
    v_merge: str = ""  # "" | "restart" | "continue"
    nested_tables: int = 0

    @property
    def text(self) -> str:
        parts: list[str] = []
        for paragraph in self.paragraphs:
            label = paragraph.label.raw if paragraph.label else ""
            line = f"{label} {paragraph.text}".strip()
            if line:
                parts.append(line)
        return "\n".join(parts)

    @property
    def bold(self) -> bool:
        filled = [p for p in self.paragraphs if p.text.strip()]
        return bool(filled) and all(p.bold for p in filled)


@dataclass
class Row:
    cells: list[Cell]
    is_header: bool = False


@dataclass
class Table:
    index: int
    rows: list[Row]
    n_cols: int
    page: int | None = None


@dataclass
class DocStats:
    paragraphs: int = 0
    tables: int = 0
    images: int = 0
    embedded_objects: int = 0
    textboxes: int = 0
    tracked_insertions: int = 0
    tracked_deletions: int = 0
    hidden_runs: int = 0
    footnotes: int = 0
    formulas: int = 0
    toc_paragraphs: int = 0
    nested_tables: int = 0
    broken_numbering_refs: int = 0
    pages: int | None = None


@dataclass
class DocModel:
    blocks: list[Paragraph | Table]
    stats: DocStats


class NodeKind(StrEnum):
    SECTION = "section"  # Приложение / Раздел / Лот
    HEADING = "heading"  # unnumbered heading
    ITEM = "item"  # numbered point
    BULLET = "bullet"  # list entry without a number
    PARAGRAPH = "paragraph"  # unnumbered text
    TABLE = "table"
    TABLE_GROUP = "table_group"  # heading row inside a table
    TABLE_ROW = "table_row"


@dataclass
class Node:
    id: str
    kind: NodeKind
    label: str = ""  # number exactly as written in the document
    # Reference number for comparison with offers. For a point the
    # document numbers it repeats the document; for a list entry without
    # a number it is assigned by the system inside the parent point
    # ("20.3"), and ``number_origin`` says which of the two it is.
    number: str = ""
    number_origin: str = ""  # "document" | "system"
    text: str = ""
    order: int = 0
    page: int | None = None
    origin: str = "document"
    is_heading: bool = False
    blocks: list[int] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    children: list[Node] = field(default_factory=list)
    columns: list[str] | None = None
    cells: list[dict[str, str]] | None = None

    def walk(self):
        """Yield this node and all descendants in document order."""
        yield self
        for child in self.children:
            yield from child.walk()


@dataclass
class Issue:
    code: str
    severity: str  # "warning" | "info"
    message: str
    node_id: str | None = None


@dataclass
class ExtractionResult:
    nodes: list[Node]
    issues: list[Issue]
    stats: dict

    def walk(self):
        for node in self.nodes:
            yield from node.walk()

    def to_dict(self) -> dict:
        return {
            "nodes": [asdict(node) for node in self.nodes],
            "issues": [asdict(issue) for issue in self.issues],
            "stats": self.stats,
        }
