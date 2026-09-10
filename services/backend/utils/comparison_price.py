"""Price requirement detection and comparison stats for supplier tables."""

from __future__ import annotations

import re
from decimal import Decimal

DELIVERY_TOTAL_LABEL = "Общая цена поставки без НДС"
DELIVERY_TOTAL_LEGACY_LABEL = "Общая цена поставки"
DELIVERY_TOTAL_ALIASES: frozenset[str] = frozenset(
    {
        DELIVERY_TOTAL_LABEL,
        DELIVERY_TOTAL_LEGACY_LABEL,
    }
)

PRICE_REQUIREMENT_LABELS: frozenset[str] = frozenset(
    {
        "Цена за единицу без НДС",
        "Общая стоимость без НДС",
        *DELIVERY_TOTAL_ALIASES,
    }
)

POSITION_PRICE_PREFIX = "Цена без НДС:"
_POSITION_BLOCK_RE = re.compile(
    r"(?:^|\n)Позиция\s+(\d+):\s*\n?",
    re.IGNORECASE,
)
_POSITION_TITLE_MAX_WORDS = 5
_CURRENCY_CODE_RE = re.compile(r"\b([A-Z]{3})\b")
_CURRENCY_SYMBOL_RE = re.compile(
    r"(₽|\$|€|£|¥|руб\.?|коп\.?)",
    re.IGNORECASE,
)


def is_position_price_requirement(requirement: str) -> bool:
    return requirement.strip().startswith(POSITION_PRICE_PREFIX)


def is_delivery_total_requirement(requirement: str) -> bool:
    return requirement.strip() in DELIVERY_TOTAL_ALIASES


def is_price_requirement(requirement: str) -> bool:
    text = requirement.strip()
    return text in PRICE_REQUIREMENT_LABELS or is_position_price_requirement(
        text
    )


def find_delivery_total_key(keys: list[str] | set[str]) -> str | None:
    """Return the delivery-total key present in ``keys`` (prefer new label)."""
    key_set = {str(k).strip() for k in keys}
    if DELIVERY_TOTAL_LABEL in key_set:
        return DELIVERY_TOTAL_LABEL
    if DELIVERY_TOTAL_LEGACY_LABEL in key_set:
        return DELIVERY_TOTAL_LEGACY_LABEL
    return None


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
        words = first_line.split()
        short = " ".join(words[:_POSITION_TITLE_MAX_WORDS]).rstrip(" .,;:")
        if short:
            titles.append(short)
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

    Removes stale ``Цена без НДС:`` labels and legacy delivery-total aliases,
    inserts new position prices after ``Описание товара`` (or at the start),
    and ensures ``Общая цена поставки без НДС`` is present.
    """
    existing = [
        str(item).strip()
        for item in (labels or [])
        if str(item).strip()
        and not is_position_price_requirement(str(item))
        and not is_delivery_total_requirement(str(item))
    ]
    per_item = position_price_labels(description)
    if not per_item:
        return existing

    insert_at = 0
    for idx, item in enumerate(existing):
        if item == "Описание товара":
            insert_at = idx + 1
            break

    merged = existing[:insert_at] + per_item + existing[insert_at:]
    total_at = insert_at + len(per_item)
    return merged[:total_at] + [DELIVERY_TOTAL_LABEL] + merged[total_at:]


def format_price_amount(value: float, currency: str | None = None) -> str:
    """Human-readable amount without trailing zeros, optional currency suffix."""
    if value == int(value):
        amount = str(int(value))
    else:
        amount = f"{value:.4f}".rstrip("0").rstrip(".")
    code = (currency or "").strip()
    if code:
        return f"{amount} {code}"
    return amount


def resolve_offer_currency(
    currency: str | None,
    offer_value: str | None,
) -> str | None:
    """Prefer stored currency; else extract from free-text offer value."""
    if currency is not None and str(currency).strip():
        return str(currency).strip()
    if not offer_value or not str(offer_value).strip():
        return None
    text = str(offer_value).replace("\u00a0", " ").replace("\u202f", " ")
    code_match = _CURRENCY_CODE_RE.search(text)
    if code_match:
        return code_match.group(1).upper()
    symbol_match = _CURRENCY_SYMBOL_RE.search(text)
    if symbol_match:
        return symbol_match.group(1)
    return None


def shared_item_currency(
    item_reqs: list[str],
    currencies: dict[str, str | None],
    values: dict[str, str | None],
) -> str | None:
    """Return common currency across items, or None if missing/mixed."""
    resolved: list[str] = []
    for req in item_reqs:
        code = resolve_offer_currency(
            currencies.get(req),
            values.get(req),
        )
        if not code:
            return None
        resolved.append(code)
    if not resolved:
        return None
    first = resolved[0]
    if any(code != first for code in resolved[1:]):
        return None
    return first


def apply_delivery_total(
    requirements: list[str],
    numeric_values: dict[str, float | None],
    values: dict[str, str | None],
    currencies: dict[str, str | None] | None = None,
) -> str | None:
    """
    Preserve LLM/document delivery total; do not invent it from unit prices.

    Summing per-item unit prices without quantity produces wrong delivery
    totals whenever qty != 1. Call sites keep this helper for API symmetry
    and shared currency resolution of an existing total.
    """
    del requirements, numeric_values, values, currencies
    return None


def apply_delivery_total_to_matches(matches: list) -> list:
    """
    Normalize match dicts without overwriting delivery total from unit prices.

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
    return normalized


_NUMBER_TOKEN_RE = re.compile(
    r"-?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?"
)
_UNIT_HINT_RE = re.compile(
    r"(?:×|x|за\s*(?:ед\.?|шт\.?)|=)\s*"
    r"(-?(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)(?:[.,]\d+)?)",
    re.IGNORECASE,
)


def _token_to_float(token: str) -> float | None:
    cleaned = (
        token.replace("\u00a0", "")
        .replace("\u202f", "")
        .replace(" ", "")
        .replace(",", ".")
    )
    try:
        num = float(cleaned)
    except ValueError:
        return None
    return num if num == num else None  # NaN guard


def parse_offer_numeric(value: str | None) -> float | None:
    """Extract a numeric amount from free-text (handles spaced thousands)."""
    if not value or not str(value).strip():
        return None
    text = str(value).replace("\u00a0", " ").replace("\u202f", " ")
    # Prefer amount after × / x / за ед. (unit price in "600 × 0.43").
    hint = _UNIT_HINT_RE.search(text)
    if hint:
        hinted = _token_to_float(hint.group(1))
        if hinted is not None:
            return hinted

    tokens = list(_NUMBER_TOKEN_RE.finditer(text))
    if not tokens:
        return None

    # Prefer a fractional amount when several numbers are present
    # (qty often integer, unit price often decimal).
    decimals: list[float] = []
    integers: list[float] = []
    for match in tokens:
        num = _token_to_float(match.group(0))
        if num is None:
            continue
        if "." in match.group(0).replace(",", ".") or "," in match.group(0):
            decimals.append(num)
        else:
            integers.append(num)
    if decimals:
        return decimals[0]
    if integers:
        return integers[0]
    return None


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
