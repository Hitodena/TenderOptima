"""Group the points of a TZ by the object they describe.

An object is a piece of equipment (or a block of general requirements) that
the offer is expected to describe in its own place. The model marks which
sections of the TZ are objects; every point then belongs to the nearest
marked section above it, and points under no marked section form the block
of general requirements. Without an answer from the model, the top-level
sections are the objects.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from backend.services.kp_compare.calls import ModelAccessError, ModelCalls
from backend.services.kp_compare.text import shorten
from backend.services.llm.prompts.kp_compare import build_objects_prompt
from backend.utils.requirements_struct import (
    quoted_number,
    requirement_key_from_flat,
    requirement_numbers,
)

GENERAL_ID = "O0"
_OUTLINE_DEPTH = 4


class _ObjectEntry(BaseModel):
    key: str = ""
    kind: str = "equipment"
    title_ru: str = ""

    @field_validator("kind", mode="before")
    @classmethod
    def _known_kind(cls, value: object) -> str:
        kind = str(value or "").strip().lower()
        return kind if kind in {"equipment", "general"} else "equipment"


class _ObjectsResult(BaseModel):
    objects: list[_ObjectEntry] = Field(default_factory=list)


@dataclass
class TzPoint:
    """A point of the TZ to compare: a leaf of the hierarchy."""

    key: str
    flat: str
    text: str
    number: str | None
    context: list[str]
    # entries where the offer itself names this clause (see references.py)
    hints: list[str] = field(default_factory=list)


@dataclass
class TzObject:
    """A piece of equipment or a block of requirements and its points."""

    id: str
    key: str | None
    kind: str
    title: str
    points: list[TzPoint] = field(default_factory=list)


@dataclass
class _Node:
    key: str
    text: str
    number: str | None
    children: list[_Node]
    depth: int

    @property
    def is_leaf(self) -> bool:
        return not self.children


def _tree(hierarchy: dict, numbers: dict | None) -> list[_Node]:
    def build(nodes: object, depth: int) -> list[_Node]:
        if not isinstance(nodes, dict):
            return []
        result: list[_Node] = []
        for key, node in nodes.items():
            if not isinstance(node, dict) or node.get("excluded"):
                continue
            key = str(key)
            result.append(
                _Node(
                    key=key,
                    text=" ".join(str(node.get("text") or "").split()),
                    number=quoted_number(numbers, key),
                    children=build(node.get("children"), depth + 1),
                    depth=depth,
                )
            )
        return result

    return build(hierarchy, 0)


def _leaf_count(node: _Node) -> int:
    if node.is_leaf:
        return 1
    return sum(_leaf_count(child) for child in node.children)


def _first_leaf(node: _Node) -> _Node:
    while node.children:
        node = node.children[0]
    return node


def _outline(roots: list[_Node]) -> str:
    lines: list[str] = []

    def walk(nodes: list[_Node]) -> None:
        for node in nodes:
            if node.is_leaf or node.depth > _OUTLINE_DEPTH:
                continue
            text = node.text or (
                "(без названия; первый пункт: "
                f"{shorten(_first_leaf(node).text, 80)})"
            )
            lines.append(
                f"{'  ' * node.depth}[{node.key}] {node.number or '—'} | "
                f"{shorten(text, 140)} | пунктов: {_leaf_count(node)}"
            )
            walk(node.children)

    walk(roots)
    return "\n".join(lines)


def _strip_colon(text: str) -> str:
    return text.rstrip(" :;.")


def _object_title(node: _Node, heading: str, fallback: str) -> str:
    """«21.1 Сыроизготовитель»; an unnamed section takes the line above it."""
    name = _strip_colon(node.text) or heading or fallback or "Объект ТЗ"
    return f"{node.number} {name}" if node.number else name


def _fallback_marks(roots: list[_Node]) -> dict[str, _ObjectEntry]:
    return {
        node.key: _ObjectEntry(key=node.key, kind="equipment")
        for node in roots
        if not node.is_leaf and _leaf_count(node) >= 2
    }


async def _marks(
    roots: list[_Node], calls: ModelCalls
) -> dict[str, _ObjectEntry]:
    outline = _outline(roots)
    if not outline:
        return {}
    system, user = build_objects_prompt(outline)
    try:
        result = await calls.json(
            "tz_objects", system, user, _ObjectsResult, thinking=False
        )
    except ModelAccessError:
        raise
    except Exception as exc:
        logger.warning(
            "TZ objects not marked, using top-level sections",
            analysis_id=calls.analysis_id,
            error=str(exc)[:300],
        )
        return _fallback_marks(roots)
    inner = {node.key for node in _all_nodes(roots) if not node.is_leaf}
    marks = {
        entry.key.strip(): entry
        for entry in result.objects
        if entry.key.strip() in inner
    }
    return marks or _fallback_marks(roots)


def _all_nodes(roots: list[_Node]) -> list[_Node]:
    result: list[_Node] = []
    stack = list(reversed(roots))
    while stack:
        node = stack.pop()
        result.append(node)
        stack.extend(reversed(node.children))
    return result


async def group_points(
    hierarchy: dict,
    tz_flat: list[str],
    calls: ModelCalls,
) -> list[TzObject]:
    """Objects of the TZ with their points, in the order of the document.

    Only the points listed in *tz_flat* are compared (the rest are marked
    «не сравнивать»); each keeps its line from *tz_flat* unchanged.
    """
    numbers = requirement_numbers(hierarchy)
    roots = _tree(hierarchy, numbers)
    flat_by_key = {
        key: line
        for line in tz_flat
        if (key := requirement_key_from_flat(line)) is not None
    }
    marks = await _marks(roots, calls)

    general = TzObject(
        id=GENERAL_ID,
        key=None,
        kind="general",
        title="Общие требования ТЗ (пункты вне отдельных объектов)",
    )
    objects: dict[str, TzObject] = {}
    order: list[TzObject] = []

    def walk(
        nodes: list[_Node],
        owner: TzObject,
        context: list[str],
        heading: str = "",
    ) -> None:
        for node in nodes:
            if node.key in marks:
                entry = marks[node.key]
                obj = objects.get(node.key)
                if obj is None:
                    obj = TzObject(
                        id=f"O{len(objects) + 1}",
                        key=node.key,
                        kind=entry.kind,
                        title=_object_title(node, heading, entry.title_ru),
                    )
                    objects[node.key] = obj
                    order.append(obj)
                walk(
                    node.children, obj, [], _strip_colon(node.text) or heading
                )
                continue
            if node.is_leaf:
                line = flat_by_key.get(node.key)
                if line is None:
                    continue
                owner.points.append(
                    TzPoint(
                        key=node.key,
                        flat=line,
                        text=node.text,
                        number=node.number,
                        context=list(context),
                    )
                )
                continue
            inner_context = context + (
                [shorten(_strip_colon(node.text), 160)] if node.text else []
            )
            walk(
                node.children,
                owner,
                inner_context,
                _strip_colon(node.text) or heading,
            )

    walk(roots, general, [])
    placed = {point.key for obj in [general, *order] for point in obj.points}
    for key, line in flat_by_key.items():
        if key not in placed:
            # a point the tree walk did not reach is still compared
            text = line.split("\n", 1)[0].split(". ", 1)[-1]
            general.points.append(
                TzPoint(key=key, flat=line, text=text, number=key, context=[])
            )
    result = [obj for obj in [general, *order] if obj.points]
    logger.info(
        "TZ points grouped by object",
        analysis_id=calls.analysis_id,
        objects=len(result),
        points=sum(len(obj.points) for obj in result),
        general=len(general.points),
    )
    return result
