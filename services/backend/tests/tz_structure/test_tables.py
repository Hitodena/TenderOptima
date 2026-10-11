"""Specification tables: every data row is a point with its own number."""

from __future__ import annotations

from backend.services.tz_structure.model import NodeKind
from backend.tests.tz_structure.docx_builder import (
    DocxBuilder,
    paragraph_xml,
    table_xml,
)
from backend.tests.tz_structure.test_outline import codes, run, shape

HEADER = ["№ п/п", "Наименование параметра", "Требуемое значение", "Ед. изм."]


def test_specification_table_under_its_point(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие требования.")
    builder.p("2. Технические характеристики")
    builder.table(
        [
            HEADER,
            ["1", "Производительность", "не менее 1000", "л/ч"],
            ["2", "Материал корпуса", "AISI 304", "—"],
            ["3", "Мощность привода", "не более 5,5", "кВт"],
        ]
    )
    builder.p("3. Требования к документации")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие требования.",
        "2. | Технические характеристики",
        "  [T] |",
        "    1 | Производительность: не менее 1000 л/ч",
        "    2 | Материал корпуса: AISI 304",
        "    3 | Мощность привода: не более 5,5 кВт",
        "3. | Требования к документации",
    ]
    assert codes(result) == []
    table = result.nodes[1].children[0]
    assert table.kind == NodeKind.TABLE
    assert table.columns == HEADER
    assert table.children[0].cells == [
        {"column": "Наименование параметра", "text": "Производительность"},
        {"column": "Требуемое значение", "text": "не менее 1000"},
        {"column": "Ед. изм.", "text": "л/ч"},
    ]


def test_table_rows_do_not_overwrite_document_sections(tmp_path) -> None:
    """Row numbers 1, 2 repeat section numbers 1, 2: both are kept."""
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие требования.")
    builder.p("2. Спецификация:")
    builder.table(
        [
            ["№", "Наименование", "Количество"],
            ["1", "Насос центробежный", "2 шт."],
            ["2", "Электродвигатель 5,5 кВт", "2 шт."],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие требования.",
        "2. | Спецификация:",
        "  [T] |",
        "    1 | Наименование: Насос центробежный; Количество: 2 шт.",
        "    2 | Наименование: Электродвигатель 5,5 кВт; Количество: 2 шт.",
    ]
    assert codes(result) == []


def test_parameter_value_table_without_number_column(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["Параметр", "Значение"],
            ["Напряжение питания", "380 В"],
            ["Частота", "50 Гц"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  [R] | Напряжение питания: 380 В",
        "  [R] | Частота: 50 Гц",
    ]


def test_table_without_header(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["Напряжение питания", "380 В"],
            ["Частота сети", "50 Гц"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  [R] | Напряжение питания | 380 В",
        "  [R] | Частота сети | 50 Гц",
    ]
    assert result.nodes[0].columns is None


def test_group_rows_hold_the_rows_below(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Наименование", "Значение"],
            [{"text": "Насос", "span": 3}],
            ["1", "Подача", "10 м3/ч"],
            ["2", "Напор", "30 м"],
            [{"text": "Мешалка", "span": 3}],
            ["3", "Мощность", "3 кВт"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  [G] | Насос",
        "    1 | Подача: 10 м3/ч",
        "    2 | Напор: 30 м",
        "  [G] | Мешалка",
        "    3 | Мощность: 3 кВт",
    ]


def test_vertically_merged_cells_become_sub_rows(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Наименование", "Значение"],
            [
                {"text": "1", "vmerge": "restart"},
                {"text": "Электродвигатель", "vmerge": "restart"},
                "Мощность 5,5 кВт",
            ],
            [
                {"text": "", "vmerge": "continue"},
                {"text": "", "vmerge": "continue"},
                "Напряжение 380 В",
            ],
            ["2", "Насос", "Подача 10 м3/ч"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  1 | Электродвигатель: Мощность 5,5 кВт",
        "    [R] | Электродвигатель: Напряжение 380 В",
        "  2 | Насос: Подача 10 м3/ч",
    ]


def test_hierarchical_numbers_in_first_column(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Требование", "Значение"],
            ["1", "Общие требования", ""],
            ["1.1", "Мощность", "5 кВт"],
            ["1.2", "Напряжение", "380 В"],
            ["2", "Комплектность", ""],
            ["2.1", "ЗИП", "1 комплект"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  1 | Общие требования",
        "    1.1 | Мощность: 5 кВт",
        "    1.2 | Напряжение: 380 В",
        "  2 | Комплектность",
        "    2.1 | ЗИП: 1 комплект",
    ]


def test_word_numbers_in_number_column(tmp_path) -> None:
    builder = DocxBuilder(pages=1).abstract(0, [{"text": "%1."}]).num(1, 0)
    builder.table(
        [
            ["№", "Наименование", "Значение"],
            [{"text": "", "num": (1, 0)}, "Мощность", "5 кВт"],
            [{"text": "", "num": (1, 0)}, "Напряжение", "380 В"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  1. | Мощность: 5 кВт",
        "  2. | Напряжение: 380 В",
    ]


def test_repeated_header_and_column_number_row(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№ п/п", "Наименование", "Значение"],
            ["1", "2", "3"],
            ["1", "Мощность", "5 кВт"],
        ],
        header_rows=1,
    )
    result = run(builder, tmp_path)
    assert shape(result) == ["[T] |", "  1 | Мощность: 5 кВт"]


def test_duplicate_and_missing_row_numbers(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Наименование", "Значение"],
            ["1", "Мощность", "5 кВт"],
            ["2", "Напряжение", "380 В"],
            ["2", "Частота", "50 Гц"],
            ["5", "Масса", "100 кг"],
        ]
    )
    result = run(builder, tmp_path)
    assert len(result.nodes[0].children) == 4
    assert codes(result) == ["numbering_duplicate", "numbering_gap"]


def test_cell_with_several_paragraphs_and_nested_table(tmp_path) -> None:
    inner = table_xml([["Класс", "IP65"], ["Климат", "УХЛ4"]])
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Наименование", "Значение"],
            ["1", "Корпус", "нержавеющая сталь\n\nтолщина не менее 2 мм"],
            ["2", "Шкаф", {"xml": inner + paragraph_xml("")}],
        ]
    )
    result = run(builder, tmp_path)
    rows = result.nodes[0].children
    assert rows[0].text == "Корпус: нержавеющая сталь толщина не менее 2 мм"
    assert rows[0].cells[1]["text"] == (
        "нержавеющая сталь\nтолщина не менее 2 мм"
    )
    assert rows[1].text == "Шкаф: Класс | IP65 Климат | УХЛ4"
    assert "nested_table" in codes(result, "info")


def test_one_column_table_is_only_a_frame(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table([["1. Первый пункт"], ["2. Второй пункт"]])
    result = run(builder, tmp_path)
    assert shape(result) == ["1. | Первый пункт", "2. | Второй пункт"]


def test_table_caption_and_following_text(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Характеристики приведены в таблице 1.")
    builder.p("Таблица 1 – Технические характеристики")
    builder.table([["Параметр", "Значение"], ["Напряжение", "380 В"]])
    builder.p("Примечание: допускается эквивалент.")
    builder.p("2. Гарантия.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Характеристики приведены в таблице 1.",
        "  Таблица 1 | Технические характеристики",
        "    [R] | Напряжение: 380 В",
        "  · | Примечание: допускается эквивалент.",
        "2. | Гарантия.",
    ]


def test_document_that_is_only_a_table(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["№", "Наименование требования", "Содержание требования"],
            ["1", "Гарантия", "не менее 24 месяцев"],
            ["2", "Срок поставки", "не более 90 дней"],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "[T] |",
        "  1 | Гарантия: не менее 24 месяцев",
        "  2 | Срок поставки: не более 90 дней",
    ]
    assert codes(result) == []
