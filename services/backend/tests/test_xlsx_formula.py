"""Formulas of offer spreadsheets saved without their computed values."""

import openpyxl
import pytest

from backend.services.analysis.email_attachments import read_attachments
from backend.utils.xlsx_formula import evaluate_sheet

# row, col → value; columns: A=1 … E=5
PLAIN = {
    (2, 1): "Кабель 3х2,5",
    (2, 3): 12000,
    (2, 4): 82.36,
    (3, 3): 100,
    (3, 4): "1 200,50",  # a number typed as text with a space and a comma
}


def _calc(formulas, plain=PLAIN):
    return evaluate_sheet(formulas, plain)


@pytest.mark.parametrize(
    ("formula", "expected"),
    [
        ("=C2*D2", 988320.0),
        ("=$C$2*$D$2", 988320.0),
        ("=D3*C3", 120050.0),
        ("=SUM(C2:C3)", 12100.0),
        ("=СУММ(C2:C3)", 12100.0),
        ("=SUM(C2,C3,1)", 12101.0),
        ("=ROUND(D2*1.2,2)", 98.83),
        ("=ROUND(2.5,0)", 3.0),  # Excel: half away from zero
        ("=ROUND(-2.5,0)", -3.0),
        ("=ROUNDUP(D2,0)", 83.0),
        ("=ROUNDDOWN(D2,0)", 82.0),
        ("=D2*20%", 16.472),
        ("=-D2+100", 17.64),
        ("=(C2+C3)/2", 6050.0),
        ("=2^3", 8.0),
        ("=MAX(C2:C3)-MIN(C2:C3)", 11900.0),
        ("=AVERAGE(C2:C3)", 6050.0),
        ("=ABS(-5)", 5.0),
        ("=INT(82.9)", 82.0),
        ("=PRODUCT(C2,D2)", 988320.0),
        ("=E9+1", 1.0),  # an empty cell is 0
        ("=ROUND(C2*D2;2)", 988320.0),  # «;» as written in Russian Excel
    ],
)
def test_supported_formulas(formula, expected):
    assert _calc({(9, 9): formula})[(9, 9)] == pytest.approx(expected)


def test_formula_chain():
    formulas = {
        (2, 5): "=C2*D2",  # sum without VAT
        (2, 6): "=ROUND(E2*0.2,2)",  # VAT
        (2, 7): "=E2+F2",  # with VAT
    }
    out = _calc(formulas)
    assert out[(2, 5)] == pytest.approx(988320)
    assert out[(2, 6)] == pytest.approx(197664)
    assert out[(2, 7)] == pytest.approx(1185984)


@pytest.mark.parametrize(
    "formula",
    [
        "=IF(C2>0,1,0)",
        "=VLOOKUP(A2,A1:B9,2,0)",
        "='Лист2'!A1*2",
        "=Лист2!A1*2",
        "=C2/0",
        '="abc"',
        "=C2*",
        "=SUM(A1:Z9999)",  # too large
    ],
)
def test_unsupported_left_empty(formula):
    assert (9, 9) not in _calc({(9, 9): formula})


def test_cycle_left_empty():
    out = _calc({(1, 1): "=B1+1", (1, 2): "=A1+1", (1, 3): "=C2*D2"})
    assert (1, 1) not in out and (1, 2) not in out
    assert out[(1, 3)] == pytest.approx(988320)


def test_formula_on_unsupported_formula_left_empty():
    out = _calc({(1, 1): "=IF(1,2,3)", (1, 2): "=A1*2"})
    assert out == {}


# --------------------------------------------------- the attachment reader


def test_xlsx_without_cached_values(tmp_path):
    """openpyxl, like many generators, saves formulas without results."""
    path = tmp_path / "kp.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "КП"
    ws.append(["Наименование", "Кол-во", "Цена, руб.", "Сумма, руб."])
    ws.append(["Кабель 3х2,5", 12000, 82.36, "=B2*C2"])
    ws.append(["Итого", None, None, "=SUM(D2:D2)"])
    wb.save(path)
    text = read_attachments([path])[0].text
    assert "| Кабель 3х2,5 | 12000 | 82.36 | 988320 |" in text
    assert "| Итого |  |  | 988320 |" in text


def test_xlsx_with_unsupported_formula(tmp_path):
    path = tmp_path / "kp.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Цена", "Скидка"])
    ws.append([82.36, "=IF(A2>50,5,0)"])
    wb.save(path)
    text = read_attachments([path])[0].text
    assert "| 82.36 |  |" in text  # left empty, not guessed


def test_xlsx_plain_values_unchanged(tmp_path):
    path = tmp_path / "kp.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Цена"])
    ws.append([82.36])
    wb.save(path)
    assert "| 82.36 |" in read_attachments([path])[0].text
