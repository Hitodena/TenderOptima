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
_PLAIN_TOKEN_NUM_RE = re.compile(r"^-?\d+(?:[.,]\d+)?$")
_COMMON_VAT_RATES = frozenset({0.0, 10.0, 20.0, 25.0})


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


def _score_line_amounts(amounts: TableLineAmounts) -> int:
    score = 0
    if amounts.qty is not None:
        score += 1
    if amounts.unit_price is not None:
        score += 2
    if amounts.sum_without_vat is not None:
        score += 2
    if amounts.sum_with_vat is not None:
        score += 1
    if amounts.vat_amount is not None:
        score += 1
    if (
        amounts.qty
        and amounts.unit_price is not None
        and amounts.sum_without_vat is not None
        and _almost_equal(
            amounts.unit_price * amounts.qty,
            amounts.sum_without_vat,
        )
    ):
        score += 3
    if (
        amounts.sum_without_vat is not None
        and amounts.vat_amount is not None
        and amounts.sum_with_vat is not None
        and _almost_equal(
            amounts.sum_without_vat + amounts.vat_amount,
            amounts.sum_with_vat,
        )
    ):
        score += 2
    return score


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


def _extract_markdown_table_amounts(text: str) -> TableLineAmounts:
    """Pull qty / unit / sums from markdown tables (pdfplumber path)."""
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
            candidate = TableLineAmounts(
                qty=amounts.get("qty"),
                unit_price=amounts.get("unit_price"),
                sum_without_vat=amounts.get("sum_without_vat"),
                sum_with_vat=amounts.get("sum_with_vat"),
                vat_amount=amounts.get("vat_amount"),
            )
            score = _score_line_amounts(candidate)
            if score > best_score:
                best_score = score
                best = candidate
            if score >= 8:
                return best
    return best


def _plain_line_numbers(line: str) -> list[float]:
    """
    Tokenize a plain OCR line into numbers.

    Avoids product codes (``ПИ-2-45/120``) and false thousands joins
    (``м2 600`` must not become ``2600``).
    """
    nums: list[float] = []
    for raw in re.split(r"\s+", line.strip()):
        token = raw.strip(".,;:()[]")
        if not token:
            continue
        # Skip mixed alphanumeric tokens (units, SKUs, codes).
        if re.search(r"[A-Za-zА-Яа-яЁё]", token):
            continue
        if "/" in token or token.count("-") > 1:
            continue
        if not _PLAIN_TOKEN_NUM_RE.match(token):
            continue
        num = parse_offer_numeric(token.replace(",", "."))
        if num is not None:
            nums.append(num)
    return nums


def _candidate_from_number_window(
    nums: list[float],
) -> TableLineAmounts | None:
    """
    Match Belarusian invoice row shapes:

    qty, unit, sum, vat_rate%, vat_amount, sum_with_vat
    qty, unit, sum, vat_amount, sum_with_vat
    """
    if len(nums) == 6:
        qty, unit, total, rate, vat, with_vat = nums
        if qty < 2 or unit <= 0 or total <= 0:
            return None
        if rate not in _COMMON_VAT_RATES and not (0 <= rate <= 25):
            return None
        if not _almost_equal(unit * qty, total):
            return None
        if not (
            _almost_equal(total + vat, with_vat)
            or _almost_equal(total * (1 + rate / 100.0), with_vat)
        ):
            return None
        return TableLineAmounts(
            qty=qty,
            unit_price=unit,
            sum_without_vat=total,
            sum_with_vat=with_vat,
            vat_amount=vat,
        )
    if len(nums) == 5:
        qty, unit, total, vat, with_vat = nums
        if qty < 2 or unit <= 0 or total <= 0:
            return None
        if not _almost_equal(unit * qty, total):
            return None
        if not _almost_equal(total + vat, with_vat):
            return None
        return TableLineAmounts(
            qty=qty,
            unit_price=unit,
            sum_without_vat=total,
            sum_with_vat=with_vat,
            vat_amount=vat,
        )
    return None


def _extract_plain_invoice_amounts(text: str) -> TableLineAmounts:
    """
    Fallback for OCR / plain-text invoices without markdown tables.

    Looks for validated number sequences like:
    ``600 0.43 258.00 20 51.60 309.60`` (qty, цена, сумма, ставка, НДС, с НДС).
    """
    best = TableLineAmounts()
    best_score = -1
    # Join wrapped lines lightly so split cells still form one sequence.
    compact = re.sub(r"[ \t]+", " ", text)
    for source in (text, compact):
        for line in source.splitlines():
            nums = _plain_line_numbers(line)
            if len(nums) < 5:
                continue
            for start in range(0, len(nums) - 4):
                for width in (6, 5):
                    if start + width > len(nums):
                        continue
                    candidate = _candidate_from_number_window(
                        nums[start : start + width]
                    )
                    if candidate is None:
                        continue
                    score = _score_line_amounts(candidate)
                    if score > best_score:
                        best_score = score
                        best = candidate
    return best


def extract_table_line_amounts(text: str) -> TableLineAmounts:
    """Pull qty / unit / sums from markdown tables or plain invoice text."""
    from_md = _extract_markdown_table_amounts(text)
    if _score_line_amounts(from_md) >= 5:
        return from_md
    from_plain = _extract_plain_invoice_amounts(text or "")
    if _score_line_amounts(from_plain) > _score_line_amounts(from_md):
        return from_plain
    return from_md


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
