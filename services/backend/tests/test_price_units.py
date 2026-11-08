"""Price ranking only between prices that are the same thing.

Every case of units, packages, currencies, VAT and the total check.
"""

import pytest

from backend.utils.price_units import (
    PriceCell,
    compare_prices,
    local_ruble,
    parse_currency,
    parse_request_quantity,
    parse_unit,
    percent_vs_min,
    position_quantities,
    says_with_vat,
)

# ------------------------------------------------------------------ units


@pytest.mark.parametrize(
    ("unit", "offer", "dimension", "factor", "label"),
    [
        (None, "82,36 руб./м", "length", 1, "м"),
        (None, "82,36 BYN за метр без НДС", "length", 1, "м"),
        (None, "82,36 руб/пог.м", "length", 1, "м"),
        (None, "0,5 руб./мм", "length", 0.001, "мм"),
        (None, "1,2 руб. за м2", "area", 1, "м²"),
        (None, "1,2 руб./м²", "area", 1, "м²"),
        (None, "1,2 руб. за кв.м", "area", 1, "м²"),
        (None, "85 руб./кг", "mass", 1, "кг"),
        (None, "85 000 руб. за тонну", "mass", 1000, "т"),
        (None, "12 руб. за шт", "count", 1, "шт"),
        (None, "1 200 руб. за 1000 шт", "count", 1000, "1 000 шт"),
        (None, "1 200 руб. за тыс. шт", "count", 1000, "тыс. шт"),
        (None, "7 900 руб. за 100 м", "length", 100, "100 м"),
        (None, "7 900 руб. за бухту 100 м", "length", 100, "бухта 100 м"),
        (None, "45 руб./л", "volume", 1, "л"),
        (None, "45 000 руб. за м3", "volume", 1000, "м³"),
        ("м", "82,36", "length", 1, "м"),
        ("за 1 м", "82,36", "length", 1, "м"),
        ("100 м", "7 900", "length", 100, "100 м"),
        ("бухта 100 м", "7 900", "length", 100, "бухта 100 м"),
        ("бухта (100 м)", "7 900", "length", 100, "бухта 100 м"),
        ("бухта по 100 м", "7 900", "length", 100, "бухта 100 м"),
        ("упаковка 10 шт", "50", "count", 10, "упаковка 10 шт"),
        ("компл.", "5 000", "set", 1, "компл."),
        (None, "300 руб. за ед.", "generic", 1, "ед."),
        # the code «3×2,5/120» in the text is not a unit
        (None, "ВВГнг 3×2,5/120 — 82 руб./м", "length", 1, "м"),
    ],
)
def test_parse_unit(unit, offer, dimension, factor, label):
    spec = parse_unit(unit, offer)
    assert spec is not None
    assert spec.dimension == dimension
    assert spec.factor == pytest.approx(factor)
    assert spec.label == label


@pytest.mark.parametrize(
    ("unit", "offer"),
    [
        (None, "82 руб."),
        (None, "82 руб. без НДС"),
        (None, "оплата за месяц вперёд"),
        (None, "в т.ч. НДС 20%"),
        (None, None),
        ("", ""),
        # packaging mentioned outside «за …» is not the price unit
        (None, "82 руб., поставка бухтами"),
    ],
)
def test_parse_unit_none(unit, offer):
    assert parse_unit(unit, offer) is None


def test_pack_without_size():
    spec = parse_unit(None, "7 900 руб. за бухту")
    assert spec is not None
    assert spec.dimension == "pack"
    assert not spec.pack_known
    assert spec.label == "бухта"


def test_pack_with_unsupported_size_is_unknown():
    # «1,2×50 м» is not a plain size: do not guess length or area
    spec = parse_unit("рулон 1,2×50 м", None)
    assert spec is not None
    assert spec.dimension == "pack"
    assert not spec.pack_known


def test_explicit_per_unit_wins_over_packaging_words():
    spec = parse_unit(None, "82 руб./м, поставка бухтами по 100 м")
    assert spec is not None and spec.label == "м"


# --------------------------------------------------------------- currency


@pytest.mark.parametrize(
    ("field", "offer", "region", "code", "factor"),
    [
        (None, "82 BYN", None, "BYN", 1),
        (None, "82 бел. руб.", None, "BYN", 1),
        (None, "82 белорусских рубля", None, "BYN", 1),
        (None, "82 руб.", "Минск", "BYN", 1),
        (None, "82 руб.", "Беларусь", "BYN", 1),
        (None, "82 руб.", "РБ", "BYN", 1),
        (None, "82 руб.", "Москва", "RUB", 1),
        (None, "82 руб.", "Россия", "RUB", 1),
        (None, "82 руб.", "", "руб", 1),
        # «рб» inside a word is not Belarus
        (None, "82 руб.", "Сербия", "руб", 1),
        (None, "82 ₽", "Минск", "RUB", 1),
        (None, "$12", None, "USD", 1),
        (None, "12 долларов", None, "USD", 1),
        (None, "12 €", None, "EUR", 1),
        (None, "1250 коп.", "Минск", "BYN", 0.01),
        ("BYN", "82 руб.", "Москва", "BYN", 1),
        ("руб.", "82", "Гомель", "BYN", 1),
        # the model writes ₽/RUB for a Belarusian «руб.»: the region decides
        ("₽", "82 руб. за метр", "Минск", "BYN", 1),
        ("RUB", "82,36", "Минск", "BYN", 1),
        ("RUB", "82,36", "Москва", "RUB", 1),
        ("RUB", "82,36", "", "RUB", 1),
        # an explicit ₽ in the supplier's own text stays RUB
        ("₽", "82 ₽/м", "Минск", "RUB", 1),
        ("USD", "24.50 per meter", "Минск", "USD", 1),
        ("коп.", "1250", "Минск", "BYN", 0.01),
    ],
)
def test_parse_currency(field, offer, region, code, factor):
    money = parse_currency(field, offer, region)
    assert money is not None
    assert money.code == code
    assert money.factor == pytest.approx(factor)


def test_parse_currency_none():
    assert parse_currency(None, "82,36", "Минск") is None
    assert parse_currency(None, None, None) is None


def test_local_ruble():
    assert local_ruble("Брестская область") == "BYN"
    assert local_ruble("Могилёв") == "BYN"
    assert local_ruble("г. Лида") == "BYN"
    assert local_ruble("Санкт-Петербург") == "RUB"
    assert local_ruble("Казахстан") is None
    assert local_ruble(None) is None


@pytest.mark.parametrize(
    ("offer", "with_vat"),
    [
        ("100 руб. с НДС", True),
        ("100 руб. с учётом НДС", True),
        ("100 руб., в т.ч. НДС 20%", True),
        ("100 руб. включая НДС", True),
        ("100 руб. без НДС", False),
        ("100 руб., НДС не облагается", False),
        ("100 руб.", False),
        (None, False),
        # both written: the row asks for без НДС, the value is that one
        ("100 руб. без НДС (120 руб. с НДС)", False),
    ],
)
def test_says_with_vat(offer, with_vat):
    assert says_with_vat(offer) is with_vat


# --------------------------------------------------------- request quantity


@pytest.mark.parametrize(
    ("text", "amount", "dimension", "label"),
    [
        ("Кабель ВВГнг(А)-LS 3×2,5 — 12 000 м", 12000, "length", "12 000 м"),
        ("Плёнка\nКоличество: 600 м2", 600, "area", "600 м²"),
        ("Нужен кабель в объёме 12 000 м", 12000, "length", "12 000 м"),
        ("Болты М12, кол-во 5 000 шт", 5000, "count", "5 000 шт"),
        ("Цемент М500 — 20 т", 20000, "mass", "20 т"),
        # the same quantity twice is still one quantity
        ("Кабель — 100 м\nКоличество: 100 м", 100, "length", "100 м"),
    ],
)
def test_request_quantity(text, amount, dimension, label):
    q = parse_request_quantity(text)
    assert q is not None
    assert q.amount == pytest.approx(amount)
    assert q.dimension == dimension
    assert q.label == label


@pytest.mark.parametrize(
    "text",
    [
        "Труба ПВХ 50 мм",  # a size, not a quantity
        "Кабель ВВГнг 3×2,5",
        "Плёнка 2-45/120, 5 рулонов",  # packages: unit size unknown
        "Кабель — 100 м\nКоличество: 200 м",  # two different quantities
        "Работы — 10 ед.",  # generic unit
        "",
        None,
    ],
)
def test_request_quantity_none(text):
    assert parse_request_quantity(text) is None


def test_position_quantities():
    description = (
        "Позиция 1:\nКабель ВВГнг 3×2,5\nКоличество: 1 000 м\n\n"
        "Позиция 2:\nАвтомат 16А\nКоличество: 20 шт\n\n"
        "Позиция 3:\nМонтаж щита"
    )
    out = position_quantities(description)
    assert out["Кабель ВВГнг 3×2,5"].amount == 1000
    assert out["Автомат 16А"].dimension == "count"
    assert "Монтаж щита" not in out
    assert position_quantities("Кабель — 100 м") == {}
    assert position_quantities(None) == {}


# ------------------------------------------------------------- comparison


def _cell(
    numeric, offer=None, currency=None, unit=None, total=None, total_offer=None
):
    return PriceCell(
        numeric=numeric,
        offer_value=offer,
        currency=currency,
        unit=unit,
        total_without_vat=total,
        total_offer_value=total_offer,
    )


def _unit_row(cells, region="Минск", quantity=None):
    return compare_prices(
        cells,
        unit_price=True,
        without_vat=True,
        region=region,
        request_quantity=quantity,
    )


def test_same_unit_ranks_and_percent():
    row = _unit_row(
        {
            "a": _cell(82.36, "82,36 руб./м"),
            "b": _cell(86.11, "86,11 руб./м"),
        }
    )
    assert row.reference_unit == "м"
    assert row.reference_currency == "BYN"
    assert all(v.comparable for v in row.verdicts.values())
    pct = percent_vs_min(row)
    assert pct == {"a": 0.0, "b": 4.6}


def test_single_supplier_is_minimum():
    row = _unit_row({"a": _cell(10, "10 руб./м")})
    assert percent_vs_min(row) == {"a": 0.0}


def test_millimetres_converted_to_metres():
    row = _unit_row(
        {
            "a": _cell(80, "80 руб./м"),
            "b": _cell(85, "85 руб./м"),
            "c": _cell(0.07, "0,07 руб./мм"),
        }
    )
    c = row.verdicts["c"]
    assert c.comparable
    assert c.normalized == pytest.approx(70)
    assert "пересчитано" in c.note
    assert percent_vs_min(row)["c"] == 0.0


def test_pack_with_size_converted():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(7900, "7 900 руб. за бухту 100 м"),
        }
    )
    b = row.verdicts["b"]
    assert b.comparable
    assert b.normalized == pytest.approx(79)
    assert "бухта 100 м" in b.note
    assert percent_vs_min(row) == {"a": 3.8, "b": 0.0}


def test_pack_without_size_not_compared():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(7900, "7 900 руб. за бухту"),
        }
    )
    b = row.verdicts["b"]
    assert not b.comparable
    assert "размер не указан" in b.note
    assert percent_vs_min(row) == {"a": 0.0, "b": None}


def test_same_package_everywhere_compared():
    row = _unit_row(
        {
            "a": _cell(30, "30 руб. за лист"),
            "b": _cell(32, "32 руб./лист"),
            "c": _cell(31, "31 руб."),  # unit not written
        }
    )
    assert row.reference_unit == "лист"
    assert all(v.comparable for v in row.verdicts.values())
    assert percent_vs_min(row)["a"] == 0.0


def test_different_packages_not_guessed():
    row = _unit_row(
        {
            "a": _cell(30, "30 руб. за лист"),
            "b": _cell(900, "900 руб. за рулон"),
        }
    )
    assert not row.verdicts["a"].comparable
    assert not row.verdicts["b"].comparable


def test_package_with_measured_units_not_compared():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(85, "85 руб./м"),
            "c": _cell(900, "900 руб. за рулон"),
        }
    )
    assert not row.verdicts["c"].comparable


def test_other_dimension_not_compared():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(85, "85 руб./м"),
            "c": _cell(120, "120 руб./кг"),
        }
    )
    assert not row.verdicts["c"].comparable
    assert "за кг" in row.verdicts["c"].note
    assert row.reference_unit == "м"


def test_request_unit_decides_dimension():
    # one supplier per kg, one per m, request is in metres
    q = parse_request_quantity("Кабель — 1 000 м")
    row = _unit_row(
        {"a": _cell(120, "120 руб./кг"), "b": _cell(82, "82 руб./м")},
        quantity=q,
    )
    assert row.verdicts["b"].comparable
    assert not row.verdicts["a"].comparable


def test_no_unit_assumed_reference():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(
                80, "80 руб."
            ),  # unit not written: price per unit asked
        }
    )
    assert row.verdicts["b"].comparable
    assert percent_vs_min(row)["b"] == 0.0


def test_generic_unit_assumed_reference():
    row = _unit_row(
        {"a": _cell(82, "82 руб./м"), "b": _cell(80, "80 руб. за ед.")}
    )
    assert row.verdicts["b"].comparable


def test_no_units_at_all_uses_request_unit():
    q = parse_request_quantity("Цемент — 20 т")
    row = _unit_row(
        {"a": _cell(300, "300 руб."), "b": _cell(310, "310 руб.")}, quantity=q
    )
    assert row.reference_unit == "т"
    assert all(v.comparable for v in row.verdicts.values())


def test_other_currency_not_compared():
    row = _unit_row(
        {
            "a": _cell(82, "82 BYN/м"),
            "b": _cell(85, "85 BYN/м"),
            "c": _cell(25, "25 USD/м"),
        }
    )
    assert not row.verdicts["c"].comparable
    assert "USD" in row.verdicts["c"].note
    assert percent_vs_min(row)["c"] is None


def test_currency_tie_not_guessed():
    row = _unit_row({"a": _cell(82, "82 BYN/м"), "b": _cell(25, "25 USD/м")})
    assert not row.verdicts["a"].comparable
    assert not row.verdicts["b"].comparable
    assert percent_vs_min(row) == {"a": None, "b": None}


def test_rub_and_byn_same_in_belarus():
    row = _unit_row(
        {"a": _cell(82, "82 руб./м"), "b": _cell(85, "85 BYN/м")},
        region="Гродно",
    )
    assert all(v.comparable for v in row.verdicts.values())


def test_rub_and_byn_differ_in_russia():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м"),
            "b": _cell(85, "85 руб./м"),
            "c": _cell(3, "3 BYN/м"),
        },
        region="Москва",
    )
    assert row.reference_currency == "RUB"
    assert not row.verdicts["c"].comparable


def test_unknown_currency_compared_with_note():
    row = _unit_row({"a": _cell(82, "82 руб./м"), "b": _cell(80, "80 за м")})
    b = row.verdicts["b"]
    assert b.comparable
    assert b.note == "валюта не указана"


def test_kopecks_converted():
    row = _unit_row(
        {"a": _cell(82, "82 руб./м"), "b": _cell(7900, "7900 коп./м")}
    )
    b = row.verdicts["b"]
    assert b.comparable
    assert b.normalized == pytest.approx(79)
    assert "копеек" in b.note


def test_with_vat_not_compared():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м без НДС"),
            "b": _cell(98, "98 руб./м с НДС"),
        }
    )
    assert not row.verdicts["b"].comparable
    assert "с НДС" in row.verdicts["b"].note


def test_with_vat_allowed_when_row_is_not_without_vat():
    row = compare_prices(
        {"a": _cell(98, "98 руб. с НДС"), "b": _cell(99, "99 руб. с НДС")},
        unit_price=False,
        without_vat=False,
        region="Минск",
    )
    assert all(v.comparable for v in row.verdicts.values())


def test_no_price_not_compared_without_note():
    row = _unit_row(
        {"a": _cell(82, "82 руб./м"), "b": _cell(None, "по запросу")}
    )
    assert not row.verdicts["b"].comparable
    assert row.verdicts["b"].note is None


def test_total_check_with_request_quantity_passes():
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м", total=984_000),
            "b": _cell(86, "86 руб./м", total=1_032_000),
        },
        quantity=q,
    )
    assert all(v.comparable for v in row.verdicts.values())


def test_total_check_catches_price_per_package():
    # «7900 руб.» without a unit, but 7 900 × 12 000 ≠ 948 000
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row(
        {
            "a": _cell(82, "82 руб./м", total=984_000),
            "b": _cell(7900, "7 900 руб.", total=948_000),
        },
        quantity=q,
    )
    b = row.verdicts["b"]
    assert not b.comparable
    assert "не сходится" in b.note and "12 000 м" in b.note
    assert "похоже, цена за 100 м" in b.note
    assert percent_vs_min(row) == {"a": 0.0, "b": None}


def test_total_check_within_two_percent_tolerance():
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row({"a": _cell(82, "82 руб./м", total=990_000)}, quantity=q)
    assert row.verdicts["a"].comparable  # 0.6 % off: rounding


def test_total_check_skipped_without_total():
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row({"a": _cell(7900, "7 900 руб.")}, quantity=q)
    assert row.verdicts["a"].comparable


def test_total_in_other_currency_not_used():
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row(
        {"a": _cell(82, "82 BYN/м", total=300_000, total_offer=None)},
        quantity=q,
    )
    # total currency unknown → treated as the same: 82 × 12 000 ≠ 300 000
    assert not row.verdicts["a"].comparable
    cells = {
        "a": PriceCell(
            numeric=82,
            offer_value="82 BYN/м",
            total_without_vat=300_000,
            total_offer_value="300 000 USD",
        )
    }
    row = _unit_row(cells, quantity=q)
    assert row.verdicts["a"].comparable


def test_total_majority_without_request_quantity():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб.", total=984_000),
            "b": _cell(86, "86 руб.", total=1_032_000),
            "c": _cell(80, "80 руб.", total=960_000),
            "d": _cell(7900, "7 900 руб.", total=948_000),
        }
    )
    assert not row.verdicts["d"].comparable
    assert "как у остальных" in row.verdicts["d"].note
    assert all(row.verdicts[k].comparable for k in "abc")


def test_total_no_majority_does_not_guess():
    row = _unit_row(
        {
            "a": _cell(82, "82 руб.", total=984_000),
            "b": _cell(7900, "7 900 руб.", total=948_000),
        }
    )
    assert all(v.comparable for v in row.verdicts.values())


def test_total_row_checks_currency_only():
    row = compare_prices(
        {
            "a": _cell(984_000, "984 000 руб. без НДС"),
            "b": _cell(1_032_000, "1 032 000 BYN"),
            "c": _cell(300_000, "300 000 USD"),
        },
        unit_price=False,
        without_vat=True,
        region="Минск",
    )
    assert row.reference_unit is None
    assert row.verdicts["a"].comparable and row.verdicts["b"].comparable
    assert not row.verdicts["c"].comparable


# ------------------------------------------------------------ excel export


def test_export_shows_price_notes():
    from types import SimpleNamespace

    from backend.utils.xlsx_export import build_comparison_workbook

    req = "Цена за единицу без НДС"

    def supplier(name, value, pct, note):
        return SimpleNamespace(
            company_name=name,
            main_email=f"{name}@example.com",
            values={req: value},
            previous_values={},
            explanations={},
            corrected_from={},
            statuses={req: "met"},
            numeric_values={},
            percent_vs_min={req: pct},
            price_notes={req: note},
        )

    wb = build_comparison_workbook(
        requirements=[req],
        suppliers=[
            supplier(
                "a",
                "7 900 руб. за бухту 100 м",
                0.0,
                "пересчитано: 7 900 → 79 за м",
            ),
            supplier(
                "b", "25 USD/м", None, "другая валюта (USD) — не сравнивается"
            ),
        ],
        status_labels={"met": "Выполнено"},
    )
    cells = [c.value for row in wb.active.iter_rows() for c in row if c.value]
    assert any("(0%)" in str(v) and "пересчитано" in str(v) for v in cells)
    assert any(
        "не сравнивается" in str(v) and "%" not in str(v) for v in cells
    )


def test_other_product_not_compared():
    cells = {
        "a": _cell(82, "82 руб./м"),
        "b": PriceCell(
            numeric=76,
            offer_value="76 руб./м",
            other_product="запрошен ВВГнг(А)-LS, предложен ВВГнг-LS",
        ),
    }
    row = _unit_row(cells)
    b = row.verdicts["b"]
    assert not b.comparable
    assert "другой товар" in b.note and "ВВГнг-LS" in b.note
    assert percent_vs_min(row) == {"a": 0.0, "b": None}


def test_calculated_total_not_used_for_the_check():
    # the model multiplied the price by our own quantity: no evidence
    q = parse_request_quantity("Кабель — 12 000 м")
    row = _unit_row(
        {
            "a": _cell(
                7900,
                "7 900 руб.",
                total=50_000_000,  # would fail the check if it were used
                total_offer="50 000 000 руб. (рассчитано)",
            ),
            "b": _cell(
                82, "82 руб./м", total=990_000, total_offer="990 000 руб."
            ),
        },
        quantity=q,
    )
    assert row.verdicts["a"].comparable  # not confirmed, not refuted
    assert row.verdicts["b"].comparable
