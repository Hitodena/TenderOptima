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


# ---------------------------------------------------------- several goods rows

TWO_CABLES = """
| № | Наименование | Ед. | Кол-во | Цена, руб. | Сумма, руб. |
|---|---|---|---|---|---|
| 1 | Кабель ВВГнг 3х1,5 | м | 12000 | 55,10 | 661200,00 |
| 2 | Кабель ВВГнг 3х2,5 | м | 12000 | 82,36 | 988320,00 |
| | Итого | | | | 1649520,00 |
"""


def _two_matches(unit, total):
    return EmailAnalysisResult(
        parameters={},
        matches=[
            _match(
                "Цена за единицу без НДС",
                f"{unit} руб./м" if unit else None,
                unit,
            ),
            _match(
                "Общая стоимость без НДС",
                f"{total} руб." if total else None,
                total,
            ),
        ],
    )


def test_several_rows_keep_model_price_and_total() -> None:
    """The second row is the requested cable: the first row must not win."""
    out = reconcile_price_matches(_two_matches(82.36, 988320), TWO_CABLES)
    unit, total = out.matches
    assert unit.numeric_value == 82.36
    assert total.numeric_value == 988320


def test_several_rows_model_price_matches_a_row() -> None:
    out = reconcile_price_matches(_two_matches(55.10, 661200), TWO_CABLES)
    unit, total = out.matches
    assert unit.numeric_value == 55.10
    assert unit.value_origin == ValueOrigin.EXTRACTED
    assert total.numeric_value == 661200


def test_several_rows_no_model_price_no_guess() -> None:
    out = reconcile_price_matches(_two_matches(None, None), TWO_CABLES)
    unit, total = out.matches
    assert unit.numeric_value is None
    assert total.numeric_value is None


def test_several_rows_model_price_not_in_table_kept() -> None:
    out = reconcile_price_matches(_two_matches(80.0, 960000), TWO_CABLES)
    assert out.matches[0].numeric_value == 80.0
    assert out.matches[1].numeric_value == 960000


def test_summary_row_does_not_count_as_item() -> None:
    one_row = """
| Наименование | Кол-во | Цена, руб. | Сумма, руб. |
|---|---|---|---|
| Кабель ВВГнг 3х2,5 | 12000 | 82,36 | 988320,00 |
| Итого | | | 988320,00 |
"""
    out = reconcile_price_matches(_two_matches(None, None), one_row)
    assert out.matches[0].numeric_value == 82.36
    assert out.matches[1].numeric_value == 988320


def test_several_rows_plain_ocr() -> None:
    text = (
        "Кабель 3х1,5 м 12000 55.10 661200.00 20 132240.00 793440.00\n"
        "Кабель 3х2,5 м 12000 82.36 988320.00 20 197664.00 1185984.00\n"
    )
    out = reconcile_price_matches(_two_matches(82.36, 988320), text)
    assert out.matches[0].numeric_value == 82.36
    assert out.matches[1].numeric_value == 988320


# ------------------------------------------------------------ number parsing

import pytest  # noqa: E402


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("1 200 руб., скидка 2,5%", 1200.0),
        ("НДС 20%: 98,40", 98.4),
        ("Срок 14 дней, цена 82 руб.", 82.0),
        ("1,250.50 USD", 1250.5),
        ("1.250,50 EUR", 1250.5),
        ("1.250.000 руб.", 1250000.0),
        ("1 250,50 BYN", 1250.5),
        ("$12.50", 12.5),
        ("2 400 BYN за 1 000 шт", 2400.0),
        ("ВВГнг 3×2,5 — 82 руб./м", 82.0),
        ("Болт М12 — 5,20 руб.", 5.2),
        ("ПИ-2-45/120 0,43", 0.43),
        ("0.43 (рассчитано: 258 / 600)", 0.43),
        ("600 м2 × 0.43", 0.43),
        ("82,36", 82.36),
        ("1,25", 1.25),
        ("дешевле от 100 руб", 100.0),
        # a range is not one price
        ("от 79,90 до 85,00 руб.", None),
        ("79–85 руб.", None),
        ("Цена 79-85 руб.", None),
        ("по запросу", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_offer_numeric_cases(text, expected) -> None:
    assert parse_offer_numeric(text) == expected
