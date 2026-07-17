from __future__ import annotations

import re
from typing import NotRequired, TypedDict


class RequirementNode(TypedDict):
    text: str
    children: dict[str, RequirementNode]
    ref_value: NotRequired[str]
    ref: NotRequired[str]


def _empty_node() -> RequirementNode:
    return {"text": "", "children": {}}


def parent_requirement_key(key: str) -> str | None:
    """Return parent key for a dotted requirement key."""
    normalized = key.replace("/", ".").strip()
    segments = normalized.split(".")
    if len(segments) <= 1:
        return None
    return ".".join(segments[:-1])


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
    result: RequirementNode = {
        "text": str(node.get("text") or "").strip(),
        "children": children,
    }
    ref_value = str(node.get("ref_value") or "").strip()
    if ref_value:
        result["ref_value"] = ref_value
    ref = str(node.get("ref") or "").strip().replace("/", ".")
    if ref:
        result["ref"] = ref
    return result


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
    ref_value = str(
        incoming.get("ref_value") or existing.get("ref_value") or ""
    ).strip()
    if not ref_value and text:
        ref_value = text
    ref = str(incoming.get("ref") or existing.get("ref") or "").strip()
    merged: RequirementNode = {"text": text, "children": merged_children}
    if ref_value:
        merged["ref_value"] = ref_value
    if ref:
        merged["ref"] = ref.replace("/", ".")
    return merged


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


def find_node_by_key(
    hierarchy: dict[str, RequirementNode],
    key: str,
) -> RequirementNode | None:
    """Locate a node by dotted key in a normalized hierarchy."""
    normalized = key.replace("/", ".").strip()
    segments = normalized.split(".")
    top = segments[0]
    if top not in hierarchy:
        return None
    current = _normalize_node(hierarchy[top])
    if len(segments) == 1:
        return current
    for index in range(1, len(segments)):
        path = ".".join(segments[: index + 1])
        children = _node_children(current)
        if path not in children:
            return None
        current = _normalize_node(children[path])
    return current


def _is_split_parent(node: RequirementNode) -> bool:
    """True when a node groups atomically split leaf requirements."""
    children = _node_children(node)
    if not children:
        return False
    text = node["text"].strip()
    ref_value = str(node.get("ref_value") or "").strip()
    return bool(ref_value) or not text


def enrich_hierarchy_refs(
    hierarchy: dict[str, RequirementNode],
) -> dict[str, RequirementNode]:
    """Fill ref/ref_value on nodes and propagate parent refs to split leaves."""

    def enrich_nodes(
        nodes: dict[str, RequirementNode],
    ) -> dict[str, RequirementNode]:
        result: dict[str, RequirementNode] = {}
        for key in sorted(nodes.keys(), key=_version_sort_key):
            node = _normalize_node(nodes[key])
            key_str = str(key)
            text = node["text"].strip()
            ref_value = str(node.get("ref_value") or "").strip()
            children = enrich_nodes(_node_children(node))

            if not ref_value and text:
                ref_value = text

            enriched: RequirementNode = {"text": text, "children": children}
            if ref_value:
                enriched["ref_value"] = ref_value
            explicit_ref = str(node.get("ref") or "").strip().replace("/", ".")
            if explicit_ref:
                enriched["ref"] = explicit_ref

            if _is_split_parent(enriched):
                parent_ref_value = str(
                    enriched.get("ref_value") or enriched["text"]
                ).strip()
                if parent_ref_value:
                    enriched["ref_value"] = parent_ref_value
                for child in children.values():
                    child_ref = str(child.get("ref") or "").strip()
                    if not child_ref:
                        child["ref"] = key_str
                    if parent_ref_value:
                        child["ref_value"] = parent_ref_value

            result[key_str] = enriched
        return result

    return enrich_nodes(hierarchy)


def resolve_letter_tz_fields(
    hierarchy: dict[str, RequirementNode],
    leaf_key: str,
) -> tuple[str | None, str | None]:
    """Return (original TZ key, original TZ text) for letter generation."""
    node = find_node_by_key(hierarchy, leaf_key)
    if node is None:
        return None, None

    explicit_ref = str(node.get("ref") or "").strip() or None
    explicit_ref_value = str(node.get("ref_value") or "").strip() or None

    if explicit_ref:
        parent = find_node_by_key(hierarchy, explicit_ref)
        ref_value = explicit_ref_value
        if parent is not None:
            parent_ref_value = (
                str(parent.get("ref_value") or parent["text"] or "").strip()
                or None
            )
            if parent_ref_value:
                ref_value = parent_ref_value
        if not ref_value and parent is not None:
            ref_value = (
                str(parent.get("ref_value") or parent["text"] or "").strip()
                or None
            )
        return explicit_ref, ref_value

    parent_key = parent_requirement_key(leaf_key)
    if parent_key:
        parent = find_node_by_key(hierarchy, parent_key)
        if parent is not None and _is_split_parent(parent):
            ref_value = (
                str(parent.get("ref_value") or parent["text"] or "").strip()
                or None
            )
            return parent_key, ref_value

    ref_value = explicit_ref_value or node["text"].strip() or None
    return leaf_key, ref_value


def normalize_tz_requirements(data: object) -> dict[str, RequirementNode]:
    """Coerce stored TZ requirements to a hierarchical dict."""
    if not isinstance(data, dict):
        return {}
    normalized = {
        str(key): _normalize_node(value) for key, value in data.items()
    }
    canonical = _canonicalize_hierarchy(normalized)
    return enrich_hierarchy_refs(canonical)


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
            node: RequirementNode = {"text": text, "children": children}
            ref_value = str(normalized.get("ref_value") or "").strip()
            if ref_value:
                node["ref_value"] = ref_value
            ref = str(normalized.get("ref") or "").strip()
            if ref:
                node["ref"] = ref.replace("/", ".")
            result[str(key)] = node
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


def flatten_hierarchy_for_matching(
    hierarchy: dict[str, RequirementNode],
) -> list[str]:
    """Flat strings with ref_value context for LLM matching."""
    normalized = normalize_tz_requirements(hierarchy)
    result: list[str] = []
    for key, text in collect_leaf_entries(normalized):
        line = f"{key}. {text}"
        node = find_node_by_key(normalized, key)
        if node is not None:
            ref_value = str(node.get("ref_value") or "").strip()
            if (
                ref_value
                and ref_value != text
                and not line.endswith(ref_value)
            ):
                line = f"{line}\n  (исходный пункт: {ref_value})"
        result.append(line)
    return result


def _count_leaves_in_node(node: RequirementNode) -> int:
    children = _node_children(node)
    if not children:
        return 1 if node["text"].strip() else 0
    return sum(_count_leaves_in_node(child) for child in children.values())


def iter_hierarchy_rows(
    hierarchy: dict[str, RequirementNode],
) -> list[tuple[str, int, RequirementNode]]:
    """Flatten a hierarchy into document-order ``(key, depth, node)`` rows.

    Depth is 0 for top-level keys (``1``, ``2``, ...), 1 for their direct
    children (``1.1``, ``1.2``, ...), and so on. Order follows
    ``_version_sort_key`` at every level, matching the numbering a reader
    expects (``1 -> 1.1 -> 1.2 -> 1.2.1 -> 1.2.2 -> 2 -> ...``).
    """
    normalized = normalize_tz_requirements(hierarchy)
    rows: list[tuple[str, int, RequirementNode]] = []

    def walk(nodes: dict[str, RequirementNode], depth: int) -> None:
        for key in sorted(nodes.keys(), key=_version_sort_key):
            node = _normalize_node(nodes[key])
            rows.append((str(key), depth, node))
            children = _node_children(node)
            if children:
                walk(children, depth + 1)

    walk(normalized, 0)
    return rows


def collect_tz_sections(
    hierarchy: dict[str, RequirementNode],
) -> list[tuple[str, str, int]]:
    """Return top-level TZ sections as (key, title, leaf_count)."""
    normalized = normalize_tz_requirements(hierarchy)
    sections: list[tuple[str, str, int]] = []
    for key in sorted(normalized.keys(), key=_version_sort_key):
        node = normalized[key]
        title = str(node.get("text") or "").strip() or f"Раздел {key}"
        count = _count_leaves_in_node(node)
        if count > 0:
            sections.append((str(key), title, count))
    return sections


def top_section_key(requirement_key: str | None) -> str | None:
    """Return the top-level section key for a dotted requirement key."""
    if not requirement_key:
        return None
    return requirement_key.replace("/", ".").split(".")[0]


def group_flat_by_top_section(
    tz_flat: list[str],
) -> dict[str, list[str]]:
    """Group flat requirement lines by top-level TZ section key."""
    grouped: dict[str, list[str]] = {}
    for requirement in tz_flat:
        key = requirement_key_from_flat(requirement) or ""
        section = top_section_key(key) or "__other__"
        grouped.setdefault(section, []).append(requirement)
    return grouped


def render_digest_for_matching(
    digest: dict[str, dict],
    *,
    section_keys: list[str] | None = None,
) -> str:
    """Render KP digest as compact Russian text for LLM matching."""
    if not digest:
        return ""

    keys = section_keys if section_keys is not None else sorted(digest.keys())
    lines: list[str] = []
    for section_key in keys:
        section = digest.get(section_key)
        if not section or not isinstance(section, dict):
            continue
        title = str(section.get("title") or section_key).strip()
        summary = str(section.get("summary") or "").strip()
        header = f"[раздел {section_key}: {title}]"
        if summary and summary != title:
            header = f"{header} — {summary}"
        lines.append(header)
        for fact_index, fact in enumerate(section.get("facts") or [], start=1):
            if not isinstance(fact, dict):
                continue
            ru_text = str(fact.get("ru_text") or "").strip()
            if not ru_text:
                continue
            page = fact.get("page")
            page_hint = ""
            if page is not None:
                try:
                    page_hint = f" [КП, стр. {int(page)}]"
                except (TypeError, ValueError):
                    pass
            lines.append(f"  {fact_index}. {ru_text}{page_hint}")
            src_quote = str(fact.get("src_quote") or "").strip()
            if src_quote:
                lines.append(f"     (цитата: {src_quote})")
        lines.append("")
    return "\n".join(lines).strip()


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
                merged: RequirementNode = {
                    "text": str(normalized.get("text") or "").strip(),
                    "children": dict(normalized.get("children") or {}),
                }
                ref_value = str(normalized.get("ref_value") or "").strip()
                if ref_value:
                    merged["ref_value"] = ref_value
                ref = str(normalized.get("ref") or "").strip()
                if ref:
                    merged["ref"] = ref.replace("/", ".")
                result[key_str] = merged
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
                out: RequirementNode = {"text": text, "children": children}
                ref_value = str(node.get("ref_value") or "").strip()
                if ref_value:
                    out["ref_value"] = ref_value
                ref = str(node.get("ref") or "").strip()
                if ref:
                    out["ref"] = ref.replace("/", ".")
                result[str(key)] = out
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
    *,
    quote: str | None = None,
) -> str:
    """Build a short TZ source reference: «Источник ТЗ, стр X, пункт Y»."""
    del requirement, quote  # short format omits inline quotes
    if not key:
        return "Не найдено"
    key_part = f"пункт {key}"
    if page is not None:
        return f"Источник ТЗ, стр {page}, {key_part}"
    return f"Источник ТЗ, {key_part}"


def format_kp_offer_ref(
    key: str | None,
    page: int | None,
    offer_value: str,
) -> str:
    """Build a short KP source reference: «Источник КП, стр X, пункт Y»."""
    del offer_value  # short format omits inline quotes
    if not key:
        return "Не найдено"
    key_part = f"пункт {key}"
    if page is not None:
        return f"Источник КП, стр {page}, {key_part}"
    return f"Источник КП, {key_part}"


def _inject_page_into_ref(
    ref: str | None,
    page: int,
    *,
    doc_label: str,
) -> str | None:
    if not ref:
        return ref
    fixed = re.sub(r"стр\.?\s*\d+", f"стр {page}", ref, flags=re.IGNORECASE)
    if not re.search(r"стр\.?\s*\d+", fixed, flags=re.IGNORECASE):
        fixed = re.sub(
            rf"^({re.escape(doc_label)},\s*)",
            rf"\1стр {page}, ",
            fixed,
            count=1,
        )
    return fixed


def fix_requirement_ref_page(ref: str | None, page: int) -> str | None:
    """Inject or replace page number in a TZ requirement reference."""
    return _inject_page_into_ref(ref, page, doc_label="Источник ТЗ")


def fix_offer_ref_page(ref: str | None, page: int) -> str | None:
    """Inject or replace page number in a KP offer reference."""
    return _inject_page_into_ref(ref, page, doc_label="Источник КП")


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


def parse_page_from_ref(ref: str | None) -> int | None:
    """Extract page number from a TZ/KP reference string."""
    if not ref:
        return None
    match = re.search(r"стр\.?\s*(\d+)", ref, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def ref_value_starts_with_key(key: str | None, ref_value: str | None) -> bool:
    """True when *ref_value* already begins with the requirement key."""
    if not key or not ref_value:
        return False
    normalized_key = key.replace("/", ".")
    trimmed = ref_value.strip()
    prefix = f"{normalized_key}. "
    if trimmed.startswith(prefix):
        return True
    return bool(
        re.match(
            rf"^{re.escape(normalized_key)}\.\s",
            trimmed,
        )
    )


def format_numbered_ref_value(
    key: str | None, ref_value: str | None
) -> str | None:
    """Build display line «key. text» without duplicating an existing prefix."""
    if not ref_value or not ref_value.strip():
        return None
    trimmed = ref_value.strip()
    if key and ref_value_starts_with_key(key, trimmed):
        return trimmed
    if key:
        return f"{key.replace('/', '.')}. {trimmed}"
    return trimmed


def format_letter_requirement_line(
    key: str | None,
    ref_value: str | None,
    *,
    fallback_requirement: str | None = None,
) -> str:
    """Format TZ requirement text for letters and exports."""
    formatted = format_numbered_ref_value(key, ref_value)
    if formatted:
        return formatted
    return (fallback_requirement or "").strip()
