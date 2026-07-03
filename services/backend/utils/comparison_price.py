"""Price requirement detection and comparison stats for supplier tables."""

from decimal import Decimal

PRICE_REQUIREMENT_LABELS: frozenset[str] = frozenset(
    {
        "Цена за единицу без НДС",
    }
)


def is_price_requirement(requirement: str) -> bool:
    return requirement.strip() in PRICE_REQUIREMENT_LABELS


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
    import re

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
