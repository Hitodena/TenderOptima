"""Hand the points read from a Word file over to the rest of the product.

The product keeps TZ requirements as a dict keyed by dotted strings
(``"3.1.2"``): the key is the identity, the order and the nesting of a point
at once (see ``backend.utils.requirements_struct``). The outline built by this
package keeps those apart, because the number a point carries in the document
can repeat, skip a value or look like ``а)``.

So here the keys are plain positions (``1``, ``1.1``, ``1.2`` ...) and what
the document calls the point travels beside the text:

``label``   the mark to show in the row, as the document has it
            (``3.1.``, ``а)``); for a list entry the document leaves
            unnumbered, the number the system gave it (``3.1.2``)
``number``  the number to quote in references and letters (``3.1``); where
            the document repeats a number in another part (the points 1, 2, 3
            of an appendix or a table), it says where: ``2 (Приложение 1)``
``auto``    the mark was assigned by the system, not taken from the document
``page``    page of the point, when the file records pages
``excluded``  the point stays in the list but is not compared with offers:
            the title of the document and other lines that only name or open
            it (see ``_not_compared_ids``); the customer can switch it back

An empty ``label`` means the point has no number in the document.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from loguru import logger

from backend.services.tz_structure import DocxReadError, extract_structure
from backend.services.tz_structure.model import (
    ExtractionResult,
    Node,
    NodeKind,
)
from backend.utils.requirements_struct import RequirementNode

# A document with fewer numbered points is treated as free text: the
# structure read from it would be a flat run of paragraphs, and the model
# does better there.
MIN_NUMBERED_POINTS = 3

_NUMBERED_KINDS = (NodeKind.ITEM, NodeKind.TABLE_ROW)
_CAPTION_KINDS = (NodeKind.SECTION, NodeKind.TABLE)

# Lines that name a part of the document and own nothing under them: the
# title, a heading or appendix with no content, an empty group of a table.
_NAMING_KINDS = (NodeKind.HEADING, NodeKind.SECTION, NodeKind.TABLE_GROUP)
_EMPTY_GROUP_KINDS = (*_NAMING_KINDS, NodeKind.ITEM)

# Unnumbered lines before the first numbered point (subtitle, description of
# the object) are not compared, but only when there are few of them: a long
# unnumbered opening is content, not a heading block.
_OPENING_LIMIT = 5

# A line with obligation language reads as a requirement and is always kept
# in the comparison, wherever it stands and however it is formatted.
_OBLIGATION_MARKERS = (
    "должен",
    "должн",
    "обязан",
    "необходим",
    "требуется",
    "требуются",
    "не менее",
    "не более",
    "не хуже",
    "не ниже",
    "не выше",
    "не позднее",
    "допускается",
    "запрещ",
    "следует",
    "нужно",
)


def _bare(label: str) -> str:
    """Label without the closing punctuation: ``3.1.`` -> ``3.1``."""
    return label.strip().rstrip(".)").lstrip("(").strip()


def structure_is_usable(result: ExtractionResult) -> bool:
    """True when the document numbers its points well enough to trust."""
    numbered = sum(
        1
        for node in result.walk()
        if node.kind in _NUMBERED_KINDS and node.label
    )
    return numbered >= MIN_NUMBERED_POINTS


def _text_of(node: Node) -> str:
    if node.kind in _CAPTION_KINDS:
        # "Приложение 1" and "Таблица 2" are part of the title, not a number
        # to reference by.
        return " ".join(part for part in (node.label, node.text) if part)
    return node.text


def _numbering_of(node: Node) -> tuple[str, str, bool]:
    """(label, number, auto) of a node for display and references."""
    if node.kind in _CAPTION_KINDS:
        return "", "", False
    if node.number_origin == "system" and node.number:
        return node.number, node.number, True
    if node.number_origin == "document" and (node.label or node.number):
        return (
            node.label or node.number,
            node.number or _bare(node.label),
            False,
        )
    if node.kind in (NodeKind.TABLE_ROW, NodeKind.TABLE_GROUP) and node.label:
        return node.label, _bare(node.label), False
    return "", "", False


def _has_content(node: Node) -> bool:
    return bool(_text_of(node).strip()) or any(
        _has_content(child) for child in node.children
    )


def _reads_as_requirement(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _OBLIGATION_MARKERS)


def _not_compared_ids(nodes: list[Node]) -> set[str]:
    """Ids of the lines that only name or open the document.

    These are shown in the list, so nothing is lost, but are not compared
    with offers until the customer switches them back on:

    * a heading, appendix title or table group with nothing under it, such as
      the title of the document;
    * the unnumbered lines at the very start, before the first numbered
      point, section or table (subtitle, description of the object), when
      there are only a few of them.

    A line that reads as a requirement («должен», «не менее» ...) is never
    taken out, and neither is a numbered point however it is formatted.
    """
    ids: set[str] = set()
    for top in nodes:
        for node in top.walk():
            if node.children or node.kind not in _NAMING_KINDS:
                continue
            if not _reads_as_requirement(_text_of(node)):
                ids.add(node.id)

    opening: list[Node] = []
    for node in nodes:
        if node.label or node.children or node.kind in _CAPTION_KINDS:
            break
        opening.append(node)
    if len(opening) <= _OPENING_LIMIT:
        ids.update(
            node.id
            for node in opening
            if not _reads_as_requirement(_text_of(node))
        )
    return ids


def _scope_of(node: Node, anchor: str) -> str:
    """Name of the part of the document where numbering starts over.

    Points numbered 1, 2, 3 in «Приложение 1», in «РАЗДЕЛ II» or in a table
    are not the points 1, 2, 3 of the document itself, so a reference to
    them has to say where they are.
    """
    if node.kind == NodeKind.SECTION:
        return node.label or node.text
    if node.kind == NodeKind.TABLE:
        if node.label:
            return node.label
        return f"таблица к п. {anchor}" if anchor else "таблица"
    return ""


def _repeated_numbers(nodes: list[Node]) -> set[str]:
    """Reference numbers the document gives to more than one point."""
    counts: Counter[str] = Counter()
    for top in nodes:
        for node in top.walk():
            number = _numbering_of(node)[1]
            if number:
                counts[number] += 1
    return {number for number, count in counts.items() if count > 1}


def _convert(
    nodes: list[Node],
    prefix: str,
    not_compared: set[str],
    repeated: set[str],
    scope: str = "",
    anchor: str = "",
) -> dict[str, RequirementNode]:
    converted: dict[str, RequirementNode] = {}
    position = 0

    def add_nodes(
        current_nodes: list[Node],
        current_scope: str,
        current_anchor: str,
    ) -> None:
        nonlocal position
        for node in current_nodes:
            if not _has_content(node):
                continue
            text = _text_of(node).strip()
            label, number, auto = _numbering_of(node)
            node_scope = _scope_of(node, current_anchor) or current_scope
            node_anchor = number or current_anchor

            # DOCX can contain a numbered item or heading whose text was lost
            # during extraction. Do not surface it as an empty heading;
            # preserve its descendants at this level. Table containers remain
            # explicit even when their text is empty.
            if not text and node.children and node.kind in _EMPTY_GROUP_KINDS:
                add_nodes(node.children, node_scope, node_anchor)
                continue

            position += 1
            key = f"{prefix}{position}"
            # the mark in the row stays as the document has it; the number that
            # is quoted in references says where a repeated number belongs
            quoted = (
                f"{number} ({node_scope})"
                if number in repeated and node_scope
                else number
            )
            entry: RequirementNode = {
                "text": text,
                "children": _convert(
                    node.children,
                    f"{key}.",
                    not_compared,
                    repeated,
                    node_scope,
                    node_anchor,
                ),
                "label": label,
                "number": quoted,
            }
            if auto:
                entry["auto"] = True
            if node.page:
                entry["page"] = node.page
            if node.id in not_compared:
                entry["excluded"] = True
            converted[key] = entry

    add_nodes(nodes, scope, anchor)
    return converted


def outline_to_requirements(
    result: ExtractionResult,
) -> dict[str, RequirementNode]:
    """Requirements hierarchy of the product from an extracted outline.

    Textless grouping nodes are collapsed so they cannot appear as empty
    headings; their descendants and document numbering are preserved. Nothing
    is renumbered in ``label`` / ``number``. Lines that only name the document
    are marked ``excluded`` (kept, but not compared).
    """
    return _convert(
        result.nodes,
        "",
        _not_compared_ids(result.nodes),
        _repeated_numbers(result.nodes),
    )


def load_docx_requirements(path: Path) -> dict[str, RequirementNode] | None:
    """Requirements read straight from a Word file, or None to fall back.

    None sends the caller to the usual route: not a .docx, a file that
    cannot be read, or a document with too little numbering to rely on.
    Never raises: a problem here must not break the upload.
    """
    if path.suffix.lower() != ".docx":
        return None
    try:
        result = extract_structure(path)
    except DocxReadError as exc:
        logger.warning(
            "Word structure not used: file not readable",
            path=str(path),
            reason=exc.message,
        )
        return None
    except Exception:
        logger.exception(
            "Word structure not used: unexpected error",
            path=str(path),
        )
        return None

    if not structure_is_usable(result):
        logger.info(
            "Word structure not used: document has little numbering",
            path=str(path),
            stats=result.stats,
        )
        return None

    requirements = outline_to_requirements(result)
    if not requirements:
        return None

    logger.info(
        "Word structure used",
        path=str(path),
        stats=result.stats,
        issues=[issue.code for issue in result.issues],
    )
    return requirements
