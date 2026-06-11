from __future__ import annotations

from typing import TypedDict


class RequirementNode(TypedDict):
    text: str
    children: dict[str, RequirementNode]


def _empty_node() -> RequirementNode:
    return {"text": "", "children": {}}


def _node_children(node: RequirementNode) -> dict[str, RequirementNode]:
    return node["children"]


def _version_sort_key(key: object) -> tuple[tuple[int, object], ...]:
    parts = str(key).replace("/", ".").split(".")
    result: list[tuple[int, object]] = []
    for part in parts:
        if part.isdigit():
            result.append((0, int(part)))
        else:
            result.append((1, part))
    return tuple(result)


def _normalize_node(node: object) -> RequirementNode:
    if not isinstance(node, dict):
        return _empty_node()
    children_raw = node.get("children") or {}
    children: dict[str, RequirementNode] = {}
    if isinstance(children_raw, dict):
        for key, child in children_raw.items():
            children[str(key)] = _normalize_node(child)
    return {
        "text": str(node.get("text") or "").strip(),
        "children": children,
    }


def _normalize_for_dedupe(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _merge_node(
    existing: RequirementNode,
    incoming: RequirementNode,
) -> RequirementNode:
    merged_children: dict[str, RequirementNode] = dict(
        _node_children(existing)
    )
    for key, child in _node_children(incoming).items():
        key_str = str(key)
        if key_str in merged_children:
            merged_children[key_str] = _merge_node(
                merged_children[key_str],
                child,
            )
        else:
            merged_children[key_str] = child

    text = str(incoming["text"] or existing["text"] or "").strip()
    return {"text": text, "children": merged_children}


def _canonicalize_hierarchy(
    hierarchy: dict[str, RequirementNode],
) -> dict[str, RequirementNode]:
    """Nest top-level dotted keys under their parent heading nodes."""
    result: dict[str, RequirementNode] = {}

    def ensure_parent_chain(full_key: str) -> dict[str, RequirementNode]:
        segments = full_key.replace("/", ".").split(".")
        top_key = segments[0]
        if top_key not in result:
            result[top_key] = _empty_node()

        current = result[top_key]
        for index in range(1, len(segments) - 1):
            path = ".".join(segments[: index + 1])
            children = _node_children(current)
            if path not in children:
                children[path] = _empty_node()
            current = children[path]
        return _node_children(current)

    for key in sorted(hierarchy.keys(), key=_version_sort_key):
        node = _normalize_node(hierarchy[key])
        key_str = str(key).replace("/", ".")
        segments = key_str.split(".")

        if len(segments) == 1:
            if key_str in result:
                result[key_str] = _merge_node(result[key_str], node)
            else:
                result[key_str] = node
            continue

        parent_children = ensure_parent_chain(key_str)
        if key_str in parent_children:
            parent_children[key_str] = _merge_node(
                parent_children[key_str],
                node,
            )
        else:
            parent_children[key_str] = node

    return result


def normalize_tz_requirements(data: object) -> dict[str, RequirementNode]:
    """Coerce stored TZ requirements to a hierarchical dict."""
    if not isinstance(data, dict):
        return {}
    normalized = {
        str(key): _normalize_node(value) for key, value in data.items()
    }
    return _canonicalize_hierarchy(normalized)


def normalize_requirements_kp(
    data: object,
) -> dict[str, dict[str, RequirementNode]]:
    """Normalize KP offerings map to hierarchical dicts per KP name."""
    if not isinstance(data, dict):
        return {}
    return {
        str(name): normalize_tz_requirements(items)
        for name, items in data.items()
    }


def normalize_requirements_kp_flat(
    data: object,
) -> dict[str, list[str]]:
    """Flatten KP offerings map to string lists for comparison."""
    hierarchical = normalize_requirements_kp(data)
    return {
        name: flatten_hierarchy(items) for name, items in hierarchical.items()
    }


def _prune_hierarchy(
    hierarchy: dict[str, RequirementNode],
) -> dict[str, RequirementNode]:
    """Drop nodes with no text and no children."""
    result: dict[str, RequirementNode] = {}
    for key, node in hierarchy.items():
        normalized = _normalize_node(node)
        children = _prune_hierarchy(_node_children(normalized))
        text = normalized["text"].strip()
        if text or children:
            result[str(key)] = {"text": text, "children": children}
    return result


def collect_leaf_entries(
    hierarchy: dict[str, RequirementNode],
) -> list[tuple[str, str]]:
    """Return (key, text) pairs for leaf requirements only."""
    entries: list[tuple[str, str]] = []

    def walk(nodes: dict[str, RequirementNode]) -> None:
        for key in sorted(nodes.keys(), key=_version_sort_key):
            node = _normalize_node(nodes[key])
            text = node["text"].strip()
            children = _node_children(node)
            if children:
                walk(children)
            elif text:
                entries.append((str(key), text))

    walk(hierarchy)
    return entries


def collect_leaf_keys(hierarchy: dict[str, RequirementNode]) -> list[str]:
    """Return requirement keys for leaf nodes only."""
    return [key for key, _ in collect_leaf_entries(hierarchy)]


def flatten_hierarchy(hierarchy: dict[str, RequirementNode]) -> list[str]:
    """Convert a hierarchical tree to flat strings (leaf nodes only)."""
    return [f"{key}. {text}" for key, text in collect_leaf_entries(hierarchy)]


def count_requirements(data: object) -> int:
    """Count leaf requirements in a hierarchy."""
    return len(flatten_hierarchy(normalize_tz_requirements(data)))


def requirements_nonempty(data: object) -> bool:
    """Return True when *data* contains at least one leaf requirement."""
    return count_requirements(data) > 0


def merge_requirement_chunks(
    parts: list[dict[str, RequirementNode]],
) -> dict[str, RequirementNode]:
    """Merge partial hierarchical dicts produced by chunked extraction."""
    result: dict[str, RequirementNode] = {}
    for part in parts:
        if not part:
            continue
        for key, node in part.items():
            key_str = str(key)
            normalized = _normalize_node(node)
            if key_str in result:
                result[key_str] = _merge_node(result[key_str], normalized)
            else:
                result[key_str] = {
                    "text": str(normalized.get("text") or "").strip(),
                    "children": dict(normalized.get("children") or {}),
                }
    return result


def dedupe_hierarchy(
    hierarchy: dict[str, RequirementNode],
) -> dict[str, RequirementNode]:
    """Drop exact duplicate requirement texts (keep first by key order)."""
    pruned = _prune_hierarchy(hierarchy)
    kept_norms: set[str] = set()

    def walk(nodes: dict[str, RequirementNode]) -> dict[str, RequirementNode]:
        result: dict[str, RequirementNode] = {}
        for key in sorted(nodes.keys(), key=_version_sort_key):
            node = _normalize_node(nodes[key])
            children = walk(_node_children(node))
            text = node["text"].strip()

            if text:
                norm = _normalize_for_dedupe(text)
                if norm in kept_norms:
                    text = ""
                else:
                    kept_norms.add(norm)

            if text or children:
                result[str(key)] = {"text": text, "children": children}
        return result

    return walk(pruned)
