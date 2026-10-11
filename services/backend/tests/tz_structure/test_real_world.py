"""Patterns found in real customer documents (mixed numbering, layouts)."""

from __future__ import annotations

from backend.tests.tz_structure.docx_builder import DocxBuilder
from backend.tests.tz_structure.test_outline import codes, doc, run, shape

LEGAL = [{"text": "%1."}, {"text": "%1.%2"}, {"text": "%1.%2.%3"}]


def test_typed_table_of_contents_is_skipped(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("КОНКУРСНЫЕ ДОКУМЕНТЫ", bold=True, jc="center")
    builder.p("СОДЕРЖАНИЕ")
    builder.p("РАЗДЕЛ I. Приглашение")
    builder.p("РАЗДЕЛ II. Предмет закупки")
    builder.p("")
    builder.p("Приложение №1 Форма предложения")
    builder.p("РАЗДЕЛ I КОНКУРСНОЕ ПРИГЛАШЕНИЕ")
    builder.p("1. Сведения о заказчике")
    builder.p("Раздел II. ПРЕДМЕТ ЗАКУПКИ")
    builder.p("1. Мощность производства")
    builder.p("Приложение №1", jc="right")
    builder.p("1. Сведения об участнике")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "# | КОНКУРСНЫЕ ДОКУМЕНТЫ",
        "РАЗДЕЛ I | КОНКУРСНОЕ ПРИГЛАШЕНИЕ",
        "  1. | Сведения о заказчике",
        "Раздел II | ПРЕДМЕТ ЗАКУПКИ",
        "  1. | Мощность производства",
        "Приложение №1 |",
        "  1. | Сведения об участнике",
    ]
    assert codes(result) == []
    assert "contents_skipped" in codes(result, "info")


def test_word_list_continued_by_typed_numbers(tmp_path) -> None:
    """ "1." made by Word, then "2." and "2.1." typed by hand."""
    builder = DocxBuilder(pages=1).abstract(0, [{"text": "%1."}]).num(1, 0)
    builder.p("СВЕДЕНИЯ О ЗАКАЗЧИКЕ", num=(1, 0))
    builder.p("2. СВЕДЕНИЯ О ЗАКУПКЕ")
    builder.p("2.1. Предмет закупки:")
    builder.p("2.1.1 Комплектное оборудование")
    builder.p("3. ТРЕБОВАНИЯ К УЧАСТНИКАМ")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | СВЕДЕНИЯ О ЗАКАЗЧИКЕ",
        "2. | СВЕДЕНИЯ О ЗАКУПКЕ",
        "  2.1. | Предмет закупки:",
        "    2.1.1 | Комплектное оборудование",
        "3. | ТРЕБОВАНИЯ К УЧАСТНИКАМ",
    ]
    assert codes(result) == []


def test_word_subpoints_under_typed_parent(tmp_path) -> None:
    """ "3." typed, "3.1" from a Word list level, "3.2" typed again."""
    builder = DocxBuilder(pages=1).abstract(0, LEGAL).num(1, 0)
    builder._nums.append(
        '<w:num w:numId="2"><w:abstractNumId w:val="0"/>'
        '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/>'
        "</w:lvlOverride></w:num>"
    )
    builder.p("1. Общие сведения.")
    builder.p("2. Предмет закупки.")
    builder.p("3. ТРЕБОВАНИЯ К УЧАСТНИКАМ:")
    builder.p("Только европейские производители.", num=(2, 1))
    builder.p("3.2 Поставщик обеспечивает шефмонтаж.")
    builder.p("3.3 Предложения на часть оборудования не принимаются.")
    builder.p("4. Документы участника")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие сведения.",
        "2. | Предмет закупки.",
        "3. | ТРЕБОВАНИЯ К УЧАСТНИКАМ:",
        "  3.1 | Только европейские производители.",
        "  3.2 | Поставщик обеспечивает шефмонтаж.",
        "  3.3 | Предложения на часть оборудования не принимаются.",
        "4. | Документы участника",
    ]
    assert codes(result) == []


def test_numbering_restarts_in_every_section(tmp_path) -> None:
    result = run(
        doc(
            "РАЗДЕЛ I ПРИГЛАШЕНИЕ",
            "1. Сведения о заказчике",
            "1.1 Наименование",
            "1.2 Адрес",
            "2. Сведения о закупке",
            "Раздел II. ПРЕДМЕТ ЗАКУПКИ",
            "1. Мощность производства",
            "1.1 Объём молока — 150 тонн в сутки.",
            "2. Исходные данные по сырью:",
            "2.1 Молоко коровье.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "РАЗДЕЛ I | ПРИГЛАШЕНИЕ",
        "  1. | Сведения о заказчике",
        "    1.1 | Наименование",
        "    1.2 | Адрес",
        "  2. | Сведения о закупке",
        "Раздел II | ПРЕДМЕТ ЗАКУПКИ",
        "  1. | Мощность производства",
        "    1.1 | Объём молока — 150 тонн в сутки.",
        "  2. | Исходные данные по сырью:",
        "    2.1 | Молоко коровье.",
    ]
    assert codes(result) == []


def test_numbers_restart_under_a_new_heading(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("Насос", style="Heading1")
    builder.p("1.1 Подача 10 м3/ч").p("1.2 Напор 30 м")
    builder.p("Мешалка", style="Heading1")
    builder.p("1.1 Мощность 3 кВт").p("1.2 Обороты 60 об/мин")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "# | Насос",
        "  1.1 | Подача 10 м3/ч",
        "  1.2 | Напор 30 м",
        "# | Мешалка",
        "  1.1 | Мощность 3 кВт",
        "  1.2 | Обороты 60 об/мин",
    ]
    assert codes(result) == []


def test_lead_in_text_owns_enumeration_but_not_sections(tmp_path) -> None:
    result = run(
        doc(
            "Поставщик предоставляет:",
            "1) паспорт;",
            "2) сертификат.",
            "Краткое описание:",
            "1. Данные о мощности",
            "1.1 Объём — 150 тонн.",
            "2. Исходные данные",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "· | Поставщик предоставляет:",
        "  1) | паспорт;",
        "  2) | сертификат.",
        "  · | Краткое описание:",
        "1. | Данные о мощности",
        "  1.1 | Объём — 150 тонн.",
        "2. | Исходные данные",
    ]


def test_bare_number_with_subpoints_is_a_point(tmp_path) -> None:
    result = run(
        doc(
            "Изучив документы, направляем предложение.",
            "1 Сведения о себе:",
            "1.1. Полное наименование участника",
            "1.2. Контактное лицо",
            "5 насосов поставляются в первой партии.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "· | Изучив документы, направляем предложение.",
        "1 | Сведения о себе:",
        "  1.1. | Полное наименование участника "
        "5 насосов поставляются в первой партии.",
    ] or shape(result) == [
        "· | Изучив документы, направляем предложение.",
        "1 | Сведения о себе:",
        "  1.1. | Полное наименование участника",
        "  1.2. | Контактное лицо 5 насосов поставляются в первой партии.",
    ]


def test_dash_glued_to_the_word_is_a_list_mark(tmp_path) -> None:
    result = run(
        doc(
            "1. Сроки закупки:",
            "-дата начала: 1 квартал;",
            "-дата завершения: 3 квартал;",
            "2. Температура хранения:",
            "-5 °C и ниже.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Сроки закупки:",
        "  – | дата начала: 1 квартал;",
        "  – | дата завершения: 3 квартал;",
        "2. | Температура хранения:",
        "  · | -5 °C и ниже.",
    ]


def test_caption_survives_an_empty_line_before_the_table(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Параметры предложения.")
    builder.p("Таблица №1. Основные параметры предложения.")
    builder.p("")
    builder.table([["Параметр", "Значение"], ["Валюта", "евро"]])
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Параметры предложения.",
        "  Таблица №1 | Основные параметры предложения.",
        "    [R] | Валюта: евро",
    ]


def test_form_with_empty_cells_stays_a_table(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["", "Общая цена предложения (EUR)", ""],
            ["", "стоимость оборудования", ""],
            ["", "стоимость доставки", ""],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result)[0] == "[T] |"
    assert len(result.nodes[0].children) == 3


def test_number_column_layout_reads_as_text(tmp_path) -> None:
    """A document converted from PDF: numbers in a narrow first column."""
    builder = DocxBuilder(pages=1)
    builder.table(
        [
            ["1", "Настоящее задание устанавливает требования;"],
            [
                "2",
                "Состав оборудования:\n\n1. Сыроизготовитель;\n\n2. Плавитель;",
            ],
            ["J", "Участник обязан предоставить:"],
        ]
    )
    builder.table(
        [
            ["", "- описание оборудования;\n\n- чертежи;"],
            ["4", "Участник предоставляет схемы. Предложение без схем"],
        ]
    )
    builder.table(
        [
            ["", "будет отклонено."],
            ["5", "ТРЕБОВАНИЯ К НАСОСУ"],
            ["5.1", "- подача не менее 10 м3/ч;\n\n- напор не менее 30 м;"],
            ["5.2", "Материал — нержавеющая сталь."],
        ]
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1 | Настоящее задание устанавливает требования;",
        "2 | Состав оборудования:",
        "  1. | Сыроизготовитель;",
        "  2. | Плавитель;",
        "J | Участник обязан предоставить:",
        "  – | описание оборудования;",
        "  – | чертежи;",
        "4 | Участник предоставляет схемы. Предложение без схем "
        "будет отклонено.",
        "5 | ТРЕБОВАНИЯ К НАСОСУ",
        "  5.1 |",
        "    – | подача не менее 10 м3/ч;",
        "    – | напор не менее 30 м;",
        "  5.2 | Материал — нержавеющая сталь.",
    ]
    assert codes(result) == ["unknown_number", "numbering_gap"]


def test_bold_line_in_lower_case_continues_the_point(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие сведения.")
    builder.p("2. Трейсилер — автоматический запайщик лотков с", bold=True)
    builder.p("мультиголовочным весовым дозатором", bold=True)
    builder.p("2.1 Производительность не менее 300 кг/час.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие сведения.",
        "2. | Трейсилер — автоматический запайщик лотков с "
        "мультиголовочным весовым дозатором",
        "  2.1 | Производительность не менее 300 кг/час.",
    ]


def numbers(result) -> list[str]:
    return [
        f"{node.number}{'*' if node.number_origin == 'system' else ''}"
        for node in result.walk()
    ]


def test_unnumbered_entries_get_numbers_inside_their_point(tmp_path) -> None:
    """Every verifiable entry needs a number to compare offers against."""
    result = run(
        doc(
            "19\tОбщие сведения.",
            "20\tТехнологические данные молока - Количество смеси 100 т/сутки;",
            "- Время наполнения 25-30 минут;",
            "- Кислотность 14-16°Т;",
            "Количество рабочих смен в сутки - 2 смены;",
            "21\tСыроизготовители",
            "21.1\tСыроизготовитель:",
            "- рабочий объем не менее 8 тысяч литров;",
        ),
        tmp_path,
    )
    assert numbers(result) == [
        "19",
        "20",
        "20.1*",
        "20.2*",
        "20.3*",
        "20.4*",
        "21",
        "21.1",
        "21.1.1*",
    ]
    point = result.nodes[1]
    assert point.text == "Технологические данные молока"
    assert point.children[0].text == "Количество смеси 100 т/сутки;"


def test_system_numbers_never_repeat_document_subpoints(tmp_path) -> None:
    result = run(
        doc(
            "3. Общие сведения.",
            "4. Комплект включает участки:",
            "- участок приёмки;",
            "- аппаратный участок;",
            "4.1 Нормализация молока в автоматическом режиме.",
            "4.2 Камеры копчения.",
        ),
        tmp_path,
    )
    assert numbers(result) == ["3", "4", "4 (1)*", "4 (2)*", "4.1", "4.2"]
