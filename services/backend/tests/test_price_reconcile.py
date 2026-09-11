"""Tests for unit-price reconciliation and numeric parsing."""

from backend.enums import TZAnalysisStatus, ValueOrigin
from backend.schemas.analysis import EmailAnalysisResult, RequirementMatch
from backend.utils.comparison_price import parse_offer_numeric
from backend.utils.price_reconcile import (
    extract_table_line_amounts,
    reconcile_price_matches,
    stamp_source_message_ids,
)

PAKSTAR_TABLE = """
| № п/п | Наименование | Ед изм | К-во | Цена, руб. | Сумма, руб. | Ставка НДС, % | Сумма НДС, руб. | Сумма с НДС, руб. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ПИ-2-45/120 пленка | м2 | 600 | 0.43 | 258.00 | 20 | 51.60 | 309.60 |
"""


def _match(
    requirement: str,
    offer_value: str | None,
    numeric_value: float | None = None,
    status: TZAnalysisStatus = TZAnalysisStatus.MET,
) -> RequirementMatch:
    return RequirementMatch(
        requirement=requirement,
        offer_value=offer_value,
        numeric_value=numeric_value,
        status=status,
    )


def test_parse_spaced_thousands() -> None:
    assert parse_offer_numeric("1 250,50 BYN") == 1250.5
    assert parse_offer_numeric("1\u00a0250.50") == 1250.5


def test_parse_prefers_unit_after_multiply() -> None:
    assert parse_offer_numeric("600 м2 × 0.43") == 0.43


def test_extract_pakstar_table() -> None:
    amounts = extract_table_line_amounts(PAKSTAR_TABLE)
    assert amounts.qty == 600
    assert amounts.unit_price == 0.43
    assert amounts.sum_without_vat == 258.0
    assert amounts.sum_with_vat == 309.6
    assert amounts.vat_amount == 51.6


def test_extract_pakstar_plain_text_ocr() -> None:
    """Scanned invoices often come as OCR text without markdown tables."""
    text = """
СЧЕТ-ФАКТУРА № 1198 от 8 Июля 2026 г.
Поставщик: Частное предприятие "Пакстар" packstar.by@gmail.com
Плательщик: ООО "Органик Продакшн" inbox@tenderoptima.online
Наименование Ед изм К-во Цена, руб. Сумма, руб. Ставка НДС Сумма НДС Сумма с НДС
ПИ-2-45/120 пленка прозрачная возд.-пузырьковая м2 600 0.43 258.00 20 51.60 309.60
Итого 258.00 51.60 309.60
Всего с НДС 309.60
"""
    amounts = extract_table_line_amounts(text)
    assert amounts.qty == 600
    assert amounts.unit_price == 0.43
    assert amounts.sum_without_vat == 258.0
    assert amounts.sum_with_vat == 309.6
    assert amounts.vat_amount == 51.6


def test_reconcile_pakstar_plain_text_fixes_llm_total() -> None:
    text = """
ПИ-2-45/120 пленка м2 600 0,43 258,00 20 51,60 309,60
"""
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            _match("Цена за единицу без НДС", "309.60", 309.6),
            _match("Общая стоимость без НДС", "258", 258.0),
            _match("Общая стоимость с НДС", "309.60", 309.6),
        ],
    )
    fixed = reconcile_price_matches(result, text)
    unit = next(
        m for m in fixed.matches if m.requirement == "Цена за единицу без НДС"
    )
    assert unit.numeric_value == 0.43
    assert unit.value_origin == ValueOrigin.EXTRACTED


def test_reconcile_prefers_table_unit_over_llm_total() -> None:
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            _match(
                "Цена за единицу без НДС",
                "258.00",
                258.0,
            ),
            _match(
                "Общая стоимость без НДС",
                "258.00",
                258.0,
            ),
        ],
    )
    fixed = reconcile_price_matches(result, PAKSTAR_TABLE)
    by_req = {m.requirement: m for m in fixed.matches}
    unit = by_req["Цена за единицу без НДС"]
    assert unit.numeric_value == 0.43
    assert unit.value_origin == ValueOrigin.EXTRACTED
    assert "0.43" in (unit.offer_value or "")


def test_reconcile_calculates_unit_from_total_qty() -> None:
    text = "Поставка: количество 600, сумма без НДС 258.00 BYN"
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            _match(
                "Цена за единицу без НДС",
                None,
                None,
                status=TZAnalysisStatus.NOT_FOUND,
            ),
            _match(
                "Общая стоимость без НДС",
                "258.00 BYN",
                258.0,
            ),
        ],
    )
    # Without a table qty column, infer qty from unit≈total confusion is N/A;
    # provide a minimal markdown qty/sum table without unit column.
    table = """
| К-во | Сумма, руб. |
| --- | --- |
| 600 | 258.00 |
"""
    fixed = reconcile_price_matches(result, f"{text}\n{table}")
    unit = next(
        m for m in fixed.matches if m.requirement == "Цена за единицу без НДС"
    )
    assert unit.numeric_value == 0.43
    assert unit.value_origin == ValueOrigin.CALCULATED
    assert "рассчитано" in (unit.offer_value or "").lower()
    assert unit.status == TZAnalysisStatus.MET


def test_reconcile_fixes_unit_confused_with_total() -> None:
    table = """
| К-во | Сумма, руб. |
| --- | --- |
| 600 | 258 |
"""
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            _match("Цена за единицу без НДС", "258", 258.0),
            _match("Общая стоимость без НДС", "258", 258.0),
        ],
    )
    fixed = reconcile_price_matches(result, table)
    unit = next(
        m for m in fixed.matches if m.requirement == "Цена за единицу без НДС"
    )
    assert unit.numeric_value == 0.43
    assert unit.value_origin == ValueOrigin.CALCULATED


def test_reconcile_skips_manual_correction() -> None:
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            RequirementMatch(
                requirement="Цена за единицу без НДС",
                offer_value="0.50",
                numeric_value=0.5,
                status=TZAnalysisStatus.MET,
                corrected_from="258",
            ),
            _match("Общая стоимость без НДС", "258", 258.0),
        ],
    )
    fixed = reconcile_price_matches(result, PAKSTAR_TABLE)
    unit = next(
        m for m in fixed.matches if m.requirement == "Цена за единицу без НДС"
    )
    assert unit.numeric_value == 0.5
    assert unit.corrected_from == "258"


def test_stamp_source_message_ids_preserves_prior() -> None:
    result = EmailAnalysisResult(
        parameters={},
        matches=[
            RequirementMatch(
                requirement="Цена за единицу без НДС",
                offer_value="0.43",
                numeric_value=0.43,
                status=TZAnalysisStatus.MET,
                source_message_id="prior-id",
            ),
            _match("Общая стоимость без НДС", "258", 258.0),
        ],
    )
    stamped = stamp_source_message_ids(result, "new-id")
    by_req = {m.requirement: m for m in stamped.matches}
    assert by_req["Цена за единицу без НДС"].source_message_id == "prior-id"
    assert by_req["Общая стоимость без НДС"].source_message_id == "new-id"
