"""Price requirement detection and comparison stats for supplier tables."""

from __future__ import annotations

import re
from decimal import Decimal

PRICE_REQUIREMENT_LABELS: frozenset[str] = frozenset(
    {
        "Цена за единицу без НДС",
        "Общая стоимость без НДС",
        "Общая цена поставки",
    }
)

POSITION_PRICE_PREFIX = "Цена без НДС:"
DELIVERY_TOTAL_LABEL = "Общая цена поставки"
_POSITION_BLOCK_RE = re.compile(
    r"(?:^|\n)Позиция\s+(\d+):\s*\n?",
    re.IGNORECASE,
)
_POSITION_TITLE_MAX = 60


def is_position_price_requirement(requirement: str) -> bool:
    return requirement.strip().startswith(POSITION_PRICE_PREFIX)


def is_price_requirement(requirement: str) -> bool:
    text = requirement.strip()
    return text in PRICE_REQUIREMENT_LABELS or is_position_price_requirement(
        text
    )


def parse_position_titles(description: str | None) -> list[str]:
    """Extract short titles from ``Позиция N:`` description blocks."""
    if not description or not str(description).strip():
        return []
    text = str(description).strip()
    matches = list(_POSITION_BLOCK_RE.finditer(text))
    if len(matches) < 2:
        return []
    titles: list[str] = []
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[start:end].strip()
        if not chunk:
            continue
        first_line = chunk.splitlines()[0].strip()
        if not first_line:
            continue
        titles.append(first_line[:_POSITION_TITLE_MAX].rstrip(" .,;:"))
    return titles


def position_price_labels(description: str | None) -> list[str]:
    """Build ``Цена без НДС: {title}`` labels from multi-position description."""
    return [
        f"{POSITION_PRICE_PREFIX} {title}"
        for title in parse_position_titles(description)
    ]


def merge_multi_position_price_params(
    labels: list | None,
    description: str | None,
) -> list[str]:
    """
    Inject per-position VAT-free price rows into additional_params.

    Removes stale ``Цена без НДС:`` labels, keeps other params, inserts new
    position prices after ``Описание товара`` (or at the start), and ensures
    ``Общая цена поставки`` is present.
    """
    existing = [
        str(item).strip()
        for item in (labels or [])
        if str(item).strip() and not is_position_price_requirement(str(item))
    ]
    per_item = position_price_labels(description)
    if not per_item:
        return existing

    without_total = [item for item in existing if item != DELIVERY_TOTAL_LABEL]
    insert_at = 0
    for idx, item in enumerate(without_total):
        if item == "Описание товара":
            insert_at = idx + 1
            break

    merged = without_total[:insert_at] + per_item + without_total[insert_at:]
    if DELIVERY_TOTAL_LABEL not in merged:
        # Prefer placing total right after per-item prices.
        total_at = insert_at + len(per_item)
        merged = merged[:total_at] + [DELIVERY_TOTAL_LABEL] + merged[total_at:]
    return merged


def format_price_amount(value: float) -> str:
    """Human-readable amount without trailing zeros."""
    if value == int(value):
        return str(int(value))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def apply_delivery_total(
    requirements: list[str],
    numeric_values: dict[str, float | None],
    values: dict[str, str | None],
) -> None:
    """
    Set delivery total only when every per-item VAT-free price is numeric.

    Mutates ``numeric_values`` and ``values`` in place when the delivery total
    requirement is present among ``requirements``.
    """
    if DELIVERY_TOTAL_LABEL not in requirements:
        return
    item_reqs = [
        req for req in requirements if is_position_price_requirement(req)
    ]
    if not item_reqs:
        return

    amounts: list[float] = []
    for req in item_reqs:
        amount = numeric_values.get(req)
        if amount is None:
            numeric_values[DELIVERY_TOTAL_LABEL] = None
            values[DELIVERY_TOTAL_LABEL] = None
            return
        amounts.append(float(amount))

    total = round(sum(amounts), 4)
    numeric_values[DELIVERY_TOTAL_LABEL] = total
    values[DELIVERY_TOTAL_LABEL] = format_price_amount(total)


def apply_delivery_total_to_matches(matches: list) -> list:
    """
    Return match dicts with delivery total recomputed from per-item prices.

    Accepts dicts or Pydantic-like objects; always returns plain dicts.
    """
    normalized: list[dict] = []
    for item in matches:
        if isinstance(item, dict):
            normalized.append(dict(item))
        elif hasattr(item, "model_dump"):
            normalized.append(item.model_dump())
        else:
            continue

    requirements: list[str] = []
    numeric_values: dict[str, float | None] = {}
    values: dict[str, str | None] = {}
    by_req: dict[str, dict] = {}

    for entry in normalized:
        req = str(entry.get("requirement", "")).strip()
        if not req:
            continue
        requirements.append(req)
        by_req[req] = entry
        offer = entry.get("offer_value")
        values[req] = str(offer) if offer is not None else None
        numeric_values[req] = resolve_numeric_value(
            req,
            values[req],
            entry.get("numeric_value"),
        )

    if DELIVERY_TOTAL_LABEL not in by_req:
        return normalized

    apply_delivery_total(requirements, numeric_values, values)
    target = by_req[DELIVERY_TOTAL_LABEL]
    target["numeric_value"] = numeric_values.get(DELIVERY_TOTAL_LABEL)
    target["offer_value"] = values.get(DELIVERY_TOTAL_LABEL)
    return normalized


def parse_offer_numeric(value: str | None) -> float | None:
    """Extract the first numeric amount from a free-text offer value."""
    if not value or not str(value).strip():
        return None
    normalized = (
        str(value)
        .replace("\u00a0", " ")
        .replace("\u202f", " ")
        .replace(",", ".")
    )

    match = re.search(r"-?\d+(?:\.\d+)?", normalized)
    if not match:
        return None
    try:
        num = float(match.group(0))
    except ValueError:
        return None
    return num if num == num else None  # NaN guard


def resolve_numeric_value(
    requirement: str,
    offer_value: str | None,
    stored_numeric: float | Decimal | None,
) -> float | None:
    """Prefer LLM-provided numeric_value; fallback to parsing offer_value."""
    if stored_numeric is not None:
        try:
            return float(stored_numeric)
        except (TypeError, ValueError):
            pass
    if is_price_requirement(requirement):
        return parse_offer_numeric(offer_value)
    return None


def compute_percent_vs_min(
    value: float | None,
    minimum: float | None,
) -> float | None:
    """Return percent difference vs minimum (0 = cheapest, +12.5 = 12.5% above min)."""
    if value is None or minimum is None or minimum <= 0:
        return None
    if value == minimum:
        return 0.0
    return round((value - minimum) / minimum * 100, 1)


def compute_row_minima(
    requirements: list[str],
    suppliers_numeric: list[dict[str, float | None]],
) -> dict[str, float | None]:
    """Minimum numeric value per price requirement across suppliers."""
    row_min: dict[str, float | None] = {}
    for req in requirements:
        if not is_price_requirement(req):
            continue
        values = [
            numeric.get(req)
            for numeric in suppliers_numeric
            if numeric.get(req) is not None
        ]
        row_min[req] = min(values) if values else None
    return row_min
