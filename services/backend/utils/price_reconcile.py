"""Deterministic unit-price reconciliation after LLM email analysis."""

from __future__ import annotations

import re
from dataclasses import dataclass

from backend.enums import TZAnalysisStatus, ValueOrigin
from backend.schemas.analysis import EmailAnalysisResult, RequirementMatch
from backend.utils.comparison_price import (
    DELIVERY_TOTAL_ALIASES,
    format_price_amount,
    is_position_price_requirement,
    parse_offer_numeric,
    resolve_offer_currency,
)

UNIT_PRICE_LABEL = "Цена за единицу без НДС"
TOTAL_WITHOUT_VAT_LABEL = "Общая стоимость без НДС"
TOTAL_WITH_VAT_LABEL = "Общая стоимость с НДС"

_REL_TOLERANCE = 0.02
_CALC_SUFFIX_RE = re.compile(r"\s*\(рассчитано:[^)]*\)\s*$", re.IGNORECASE)

_QTY_HEADER_RE = re.compile(
    r"^(?:к-?во|кол-?во|количество|qty|quantity|кол\.?)$",
    re.IGNORECASE,
)
_UNIT_PRICE_HEADER_RE = re.compile(
    r"^(?:цена(?:\s*,?\s*руб\.?)?|цена\s+за\s+(?:ед\.?|шт\.?|единицу)|"
    r"стоимость\s+за\s+(?:ед\.?|шт\.?)|unit\s*price|тариф)$",
    re.IGNORECASE,
)
_SUM_WITHOUT_VAT_HEADER_RE = re.compile(
    r"^(?:сумма(?:\s*,?\s*руб\.?)?|стоимость(?:\s*,?\s*руб\.?)?|"
    r"сумма\s+без\s+ндс|итого\s+без\s+ндс)$",
    re.IGNORECASE,
)
_SUM_WITH_VAT_HEADER_RE = re.compile(
    r"^(?:сумма\s+с\s+ндс(?:\s*,?\s*руб\.?)?|стоимость\s+с\s+ндс|"
    r"итого\s+с\s+ндс|total\s*(?:with\s+vat)?)$",
    re.IGNORECASE,
)
_VAT_AMOUNT_HEADER_RE = re.compile(
    r"^(?:сумма\s+ндс(?:\s*,?\s*руб\.?)?|ндс(?:\s*,?\s*руб\.?)?)$",
    re.IGNORECASE,
)
_MD_ROW_RE = re.compile(r"^\|(.+)\|$")
_MD_SEP_RE = re.compile(r"^[\s|:-]+$")


@dataclass(frozen=True)
class TableLineAmounts:
    """Amounts parsed from the first data row of a commercial table."""

    qty: float | None = None
    unit_price: float | None = None
    sum_without_vat: float | None = None
    sum_with_vat: float | None = None
    vat_amount: float | None = None


def _almost_equal(a: float, b: float, *, rel: float = _REL_TOLERANCE) -> bool:
    if a == b:
        return True
    scale = max(abs(a), abs(b), 1e-9)
    return abs(a - b) / scale <= rel


def _parse_markdown_tables(text: str) -> list[list[list[str]]]:
    """Return list of tables; each table is list of rows of cell strings."""
    tables: list[list[list[str]]] = []
    current: list[list[str]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        match = _MD_ROW_RE.match(line)
        if not match:
            if current:
                tables.append(current)
                current = []
            continue
        cells = [c.strip() for c in match.group(1).split("|")]
        if _MD_SEP_RE.match(line.replace("|", " ").strip()) or all(
            set(c) <= {"-", ":", " "} for c in cells if c
        ):
            continue
        current.append(cells)
    if current:
        tables.append(current)
    return tables


def _classify_header(cell: str) -> str | None:
    text = re.sub(r"\s+", " ", cell.strip().lower())
    text = text.replace("ё", "е")
    if not text:
        return None
    if _QTY_HEADER_RE.match(text):
        return "qty"
    if _SUM_WITH_VAT_HEADER_RE.match(text):
        return "sum_with_vat"
    if _VAT_AMOUNT_HEADER_RE.match(text):
        return "vat_amount"
    if _SUM_WITHOUT_VAT_HEADER_RE.match(text):
        return "sum_without_vat"
    if _UNIT_PRICE_HEADER_RE.match(text):
        return "unit_price"
    # Broader: "цена" column that is not "сумма"
    if "цена" in text and "сумма" not in text and "ндс" not in text:
        return "unit_price"
    if text in {"сумма", "сумма руб", "сумма, руб", "сумма, руб."}:
        return "sum_without_vat"
    return None


def _cell_number(cell: str) -> float | None:
    return parse_offer_numeric(cell)


def extract_table_line_amounts(text: str) -> TableLineAmounts:
    """Pull qty / unit / sums from the first matching markdown table row."""
    best = TableLineAmounts()
    best_score = -1
    for table in _parse_markdown_tables(text):
        if len(table) < 2:
            continue
        header = table[0]
        roles: dict[int, str] = {}
        for idx, cell in enumerate(header):
            role = _classify_header(cell)
            if role:
                roles[idx] = role
        if "unit_price" not in roles.values() and "qty" not in roles.values():
            continue
        for row in table[1:]:
            amounts: dict[str, float] = {}
            for idx, role in roles.items():
                if idx >= len(row):
                    continue
                num = _cell_number(row[idx])
                if num is not None:
                    amounts[role] = num
            score = len(amounts)
            if score > best_score:
                best_score = score
                best = TableLineAmounts(
                    qty=amounts.get("qty"),
                    unit_price=amounts.get("unit_price"),
                    sum_without_vat=amounts.get("sum_without_vat"),
                    sum_with_vat=amounts.get("sum_with_vat"),
                    vat_amount=amounts.get("vat_amount"),
                )
            if score >= 3:
                return best
    return best


def _infer_qty(
    table: TableLineAmounts,
    unit: float | None,
    total: float | None,
) -> float | None:
    if table.qty is not None and table.qty > 0:
        return table.qty
    if (
        unit is not None
        and total is not None
        and unit > 0
        and total > unit
        and not _almost_equal(unit, total)
    ):
        ratio = total / unit
        # Prefer near-integer quantities from unit×qty≈total.
        if abs(ratio - round(ratio)) < 0.02 and round(ratio) >= 2:
            return float(round(ratio))
    return None


def _resolve_total_without_vat(
    table: TableLineAmounts,
    match_total: float | None,
    match_with_vat: float | None,
) -> float | None:
    if table.sum_without_vat is not None:
        return table.sum_without_vat
    if table.sum_with_vat is not None and table.vat_amount is not None:
        return round(table.sum_with_vat - table.vat_amount, 4)
    if match_total is not None:
        # Reject totals that equal with-VAT when без НДС is required.
        if (
            match_with_vat is not None
            and _almost_equal(match_total, match_with_vat)
            and table.vat_amount is not None
        ):
            return round(match_with_vat - table.vat_amount, 4)
        return match_total
    if match_with_vat is not None and table.vat_amount is not None:
        return round(match_with_vat - table.vat_amount, 4)
    return None


def _strip_calc_suffix(offer: str | None) -> str | None:
    if offer is None:
        return None
    return _CALC_SUFFIX_RE.sub("", str(offer)).strip() or None


def _format_calculated_offer(
    unit: float,
    total: float,
    qty: float,
    currency: str | None,
) -> str:
    base = format_price_amount(unit, currency)
    total_txt = format_price_amount(total, None)
    qty_txt = format_price_amount(qty, None)
    return f"{base} (рассчитано: {total_txt} / {qty_txt})"


def _match_numeric(match: RequirementMatch) -> float | None:
    if match.numeric_value is not None:
        try:
            return float(match.numeric_value)
        except (TypeError, ValueError):
            pass
    return parse_offer_numeric(match.offer_value)


def _by_requirement(
    matches: list[RequirementMatch],
) -> dict[str, RequirementMatch]:
    return {m.requirement.strip(): m for m in matches if m.requirement.strip()}


def _update_match(
    match: RequirementMatch,
    *,
    numeric_value: float,
    offer_value: str,
    value_origin: ValueOrigin,
) -> RequirementMatch:
    updates: dict = {
        "numeric_value": numeric_value,
        "offer_value": offer_value,
        "value_origin": value_origin,
    }
    if match.status == TZAnalysisStatus.NOT_FOUND:
        updates["status"] = TZAnalysisStatus.MET
        updates["explanation"] = None
    return match.model_copy(update=updates)


def _reconcile_unit_total_pair(
    unit_match: RequirementMatch,
    total_match: RequirementMatch | None,
    with_vat_match: RequirementMatch | None,
    table: TableLineAmounts,
) -> RequirementMatch:
    if unit_match.corrected_from:
        return unit_match

    unit_llm = _match_numeric(unit_match)
    total_llm = _match_numeric(total_match) if total_match else None
    with_vat_llm = _match_numeric(with_vat_match) if with_vat_match else None
    total = _resolve_total_without_vat(table, total_llm, with_vat_llm)
    qty = _infer_qty(table, unit_llm or table.unit_price, total)
    currency = resolve_offer_currency(
        unit_match.currency,
        unit_match.offer_value,
    ) or (
        resolve_offer_currency(
            total_match.currency if total_match else None,
            total_match.offer_value if total_match else None,
        )
    )

    # Prefer explicit table unit price when present.
    if table.unit_price is not None:
        table_unit = table.unit_price
        if (
            total is not None
            and qty is not None
            and qty > 0
            and not _almost_equal(table_unit * qty, total)
            and _almost_equal(total / qty, total / qty)
        ):
            # Table unit disagrees with total/qty — prefer calculated.
            calc = round(total / qty, 4)
            return _update_match(
                unit_match,
                numeric_value=calc,
                offer_value=_format_calculated_offer(
                    calc, total, qty, currency
                ),
                value_origin=ValueOrigin.CALCULATED,
            )
        offer = format_price_amount(table_unit, currency)
        if unit_llm is None or not _almost_equal(unit_llm, table_unit):
            return _update_match(
                unit_match,
                numeric_value=table_unit,
                offer_value=offer,
                value_origin=ValueOrigin.EXTRACTED,
            )
        return unit_match.model_copy(
            update={"value_origin": ValueOrigin.EXTRACTED}
        )

    # Derive unit from total / qty when missing or confused with total.
    if total is not None and qty is not None and qty > 1:
        calc = round(total / qty, 4)
        needs_calc = (
            unit_llm is None
            or _almost_equal(unit_llm, total)
            or (
                unit_llm is not None
                and not _almost_equal(unit_llm * qty, total)
            )
        )
        if needs_calc:
            return _update_match(
                unit_match,
                numeric_value=calc,
                offer_value=_format_calculated_offer(
                    calc, total, qty, currency
                ),
                value_origin=ValueOrigin.CALCULATED,
            )

    if unit_llm is not None and unit_match.value_origin is None:
        return unit_match.model_copy(
            update={"value_origin": ValueOrigin.EXTRACTED}
        )
    return unit_match


def reconcile_price_matches(
    result: EmailAnalysisResult,
    email_text: str,
) -> EmailAnalysisResult:
    """
    Fix unit-price matches using table columns and total÷qty when needed.

    Skips rows with manual ``corrected_from``. Marks calculated values via
    ``value_origin`` and an ``(рассчитано: …)`` offer_value suffix.
    """
    if not result.matches:
        return result

    table = extract_table_line_amounts(email_text or "")
    by_req = _by_requirement(result.matches)
    updated: dict[str, RequirementMatch] = dict(by_req)

    unit_match = by_req.get(UNIT_PRICE_LABEL)
    if unit_match is not None:
        updated[UNIT_PRICE_LABEL] = _reconcile_unit_total_pair(
            unit_match,
            by_req.get(TOTAL_WITHOUT_VAT_LABEL),
            by_req.get(TOTAL_WITH_VAT_LABEL),
            table,
        )

    # Multi-position unit rows: only auto-calc when a single shared qty/total
    # table line exists and exactly one position price is missing/wrong.
    position_keys = [
        key for key in by_req if is_position_price_requirement(key)
    ]
    delivery_key = next(
        (key for key in by_req if key.strip() in DELIVERY_TOTAL_ALIASES),
        None,
    )
    if len(position_keys) == 1:
        key = position_keys[0]
        updated[key] = _reconcile_unit_total_pair(
            by_req[key],
            by_req.get(delivery_key) if delivery_key else None,
            by_req.get(TOTAL_WITH_VAT_LABEL),
            table,
        )
    else:
        for key in position_keys:
            match = by_req[key]
            if match.corrected_from:
                continue
            if match.numeric_value is not None and match.value_origin is None:
                updated[key] = match.model_copy(
                    update={"value_origin": ValueOrigin.EXTRACTED}
                )

    # Stamp extracted origin on other price rows that already have numbers.
    for key, match in list(updated.items()):
        if match.value_origin is not None or match.corrected_from:
            continue
        is_price = (
            key
            in {
                UNIT_PRICE_LABEL,
                TOTAL_WITHOUT_VAT_LABEL,
                TOTAL_WITH_VAT_LABEL,
            }
            or is_position_price_requirement(key)
            or key.strip() in DELIVERY_TOTAL_ALIASES
        )
        if not is_price:
            continue
        if _match_numeric(match) is not None:
            updated[key] = match.model_copy(
                update={"value_origin": ValueOrigin.EXTRACTED}
            )

    # Optionally correct total-without-VAT from table when LLM used with-VAT.
    total_match = updated.get(TOTAL_WITHOUT_VAT_LABEL)
    if (
        total_match is not None
        and not total_match.corrected_from
        and table.sum_without_vat is not None
    ):
        current = _match_numeric(total_match)
        if current is None or not _almost_equal(
            current, table.sum_without_vat
        ):
            currency = resolve_offer_currency(
                total_match.currency,
                total_match.offer_value,
            )
            updated[TOTAL_WITHOUT_VAT_LABEL] = _update_match(
                total_match,
                numeric_value=table.sum_without_vat,
                offer_value=format_price_amount(
                    table.sum_without_vat, currency
                ),
                value_origin=ValueOrigin.EXTRACTED,
            )

    ordered = [updated.get(m.requirement.strip(), m) for m in result.matches]
    return result.model_copy(update={"matches": ordered})


def stamp_source_message_ids(
    result: EmailAnalysisResult,
    message_id: str,
) -> EmailAnalysisResult:
    """Attach current message id unless a match already has provenance."""
    if not message_id:
        return result
    stamped: list[RequirementMatch] = []
    for match in result.matches:
        if match.source_message_id:
            stamped.append(match)
        else:
            stamped.append(
                match.model_copy(update={"source_message_id": message_id})
            )
    return result.model_copy(update={"matches": stamped})


def clear_calc_suffix_for_manual(offer_value: str | None) -> str | None:
    """Expose suffix strip for manual edits if needed."""
    return _strip_calc_suffix(offer_value)
