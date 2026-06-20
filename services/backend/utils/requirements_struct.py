from __future__ import annotations

import re
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


_PAGE_MARKER_RE = re.compile(r"---\s*Страница\s+(\d+)\s*---", re.IGNORECASE)
_REQ_LINE_KEY_RE = re.compile(
    r"^([\d]+(?:[./][\d]+)*|[A-Za-zА-Яа-я])\s*[\.)]",
)


def build_requirement_page_map(raw_text: str) -> dict[str, int]:
    """Map requirement keys to page numbers from ``--- Страница N ---`` markers."""
    page_map: dict[str, int] = {}
    current_page = 1
    for line in raw_text.splitlines():
        page_match = _PAGE_MARKER_RE.search(line)
        if page_match:
            current_page = int(page_match.group(1))
            continue
        stripped = line.strip()
        if not stripped:
            continue
        req_match = _REQ_LINE_KEY_RE.match(stripped)
        if req_match:
            key = req_match.group(1).replace("/", ".")
            page_map[key] = current_page
    return page_map


def lookup_page_for_key(key: str, page_map: dict[str, int]) -> int | None:
    """Resolve page for a requirement key, falling back to parent keys."""
    normalized = key.replace("/", ".")
    parts = normalized.split(".")
    for end in range(len(parts), 0, -1):
        candidate = ".".join(parts[:end])
        page = page_map.get(candidate)
        if page is not None:
            return page
    return None


def requirement_key_from_flat(flat: str) -> str | None:
    """Extract hierarchy key from a flattened requirement string."""
    match = re.match(
        r"^([\d]+(?:[./][\d]+)*|[A-Za-zА-Яа-я])\.\s", flat.strip()
    )
    if match:
        return match.group(1).replace("/", ".")
    return None


_REF_KEY_RE = re.compile(r"п\.\s*([\d./]+)", re.IGNORECASE)


def key_from_reference(ref: str | None) -> str | None:
    """Extract пункт key from a TZ/KP reference string."""
    if not ref:
        return None
    match = _REF_KEY_RE.search(ref)
    if match:
        return match.group(1).replace("/", ".")
    return None


def _truncate_quote(text: str, max_len: int = 120) -> str:
    cleaned = " ".join(text.strip().split())
    if len(cleaned) <= max_len:
        return cleaned
    return f"{cleaned[: max_len - 3].rstrip()}..."


def _quote_from_flat(flat: str) -> str:
    parts = flat.strip().split(". ", 1)
    body = parts[1] if len(parts) > 1 else flat.strip()
    return _truncate_quote(body)


def format_tz_requirement_ref(
    key: str | None,
    page: int | None,
    requirement: str,
) -> str:
    """Build a TZ source reference with page and пункт when possible."""
    quote = _quote_from_flat(requirement)
    key_part = f"п. {key}" if key else "п. ?"
    if page is not None:
        return f"ТЗ, стр. {page}, {key_part}: «{quote}»"
    return f"ТЗ, {key_part}: «{quote}»"


def format_kp_offer_ref(
    key: str | None,
    page: int | None,
    offer_value: str,
) -> str:
    """Build a KP source reference with page and пункт when possible."""
    quote = _truncate_quote(offer_value)
    if page is not None and key:
        return f"КП, стр. {page}, п. {key}: «{quote}»"
    if page is not None:
        return f"КП, стр. {page}: «{quote}»"
    if key:
        return f"КП, п. {key}: «{quote}»"
    return f"КП: «{quote}»"


def _inject_page_into_ref(
    ref: str | None,
    page: int,
    *,
    doc_label: str,
) -> str | None:
    if not ref:
        return ref
    fixed = re.sub(r"стр\.\s*N\b", f"стр. {page}", ref, flags=re.IGNORECASE)
    if "стр." not in fixed.lower():
        fixed = re.sub(
            rf"^({re.escape(doc_label)},\s*)",
            rf"\1стр. {page}, ",
            fixed,
            count=1,
        )
    return fixed


def fix_requirement_ref_page(ref: str | None, page: int) -> str | None:
    """Inject or replace page number in a TZ requirement reference."""
    return _inject_page_into_ref(ref, page, doc_label="ТЗ")


def fix_offer_ref_page(ref: str | None, page: int) -> str | None:
    """Inject or replace page number in a KP offer reference."""
    return _inject_page_into_ref(ref, page, doc_label="КП")


def annotate_flat_with_page(
    flat: str,
    page_map: dict[str, int],
    *,
    doc_label: str,
) -> str:
    """Append page hint to a flat requirement/offer line for LLM prompts."""
    key = requirement_key_from_flat(flat)
    page = lookup_page_for_key(key, page_map) if key else None
    if page is None:
        return flat
    return f"{flat} [{doc_label}, стр. {page}]"


_PAGE_IN_REF_RE = re.compile(r"стр\.\s*\d+,?\s*", re.IGNORECASE)


def strip_page_from_ref(ref: str | None) -> str | None:
    """Remove page number fragments from a TZ/KP reference."""
    if not ref:
        return ref
    cleaned = _PAGE_IN_REF_RE.sub("", ref)
    cleaned = re.sub(r",\s*,", ", ", cleaned)
    cleaned = re.sub(r"\(\s*\)", "", cleaned)
    return cleaned.strip() or None
