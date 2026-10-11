"""Tree of points: numbers as in the document, nothing lost or merged."""

from __future__ import annotations

from backend.services.tz_structure import extract_structure
from backend.services.tz_structure.model import ExtractionResult
from backend.services.tz_structure.render import outline_lines
from backend.tests.tz_structure.docx_builder import DocxBuilder


def run(builder: DocxBuilder, tmp_path) -> ExtractionResult:
    return extract_structure(builder.save(tmp_path / "doc.docx"))


def shape(result: ExtractionResult) -> list[str]:
    """Outline without warning lines."""
    return [
        line
        for line in outline_lines(result, width=200)
        if not line.lstrip().startswith("!")
    ]


def codes(result: ExtractionResult, severity: str = "warning") -> list[str]:
    return [i.code for i in result.issues if i.severity == severity]


def doc(*lines: str) -> DocxBuilder:
    builder = DocxBuilder(pages=1)
    for line in lines:
        builder.p(line)
    return builder


# ---- typed numbering ------------------------------------------------


def test_typed_multilevel_numbers(tmp_path) -> None:
    result = run(
        doc(
            "1. Общие требования",
            "1.1. Оборудование новое.",
            "1.2. Поставка на условиях DAP.",
            "1.2.1 Монтаж включён.",
            "2. Технические требования",
            "2.1 Мощность не менее 5 кВт.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Общие требования",
        "  1.1. | Оборудование новое.",
        "  1.2. | Поставка на условиях DAP.",
        "    1.2.1 | Монтаж включён.",
        "2. | Технические требования",
        "  2.1 | Мощность не менее 5 кВт.",
    ]
    assert codes(result) == []


def test_letters_and_dashes_nest_under_the_point(tmp_path) -> None:
    result = run(
        doc(
            "1. Общие сведения.",
            "2. Требования к документации:",
            "а) паспорт;",
            "б) руководство по эксплуатации;",
            "в) сертификат.",
            "3. Упаковка",
            "- деревянный ящик;",
            "– влагозащита.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Общие сведения.",
        "2. | Требования к документации:",
        "  а) | паспорт;",
        "  б) | руководство по эксплуатации;",
        "  в) | сертификат.",
        "3. | Упаковка",
        "  – | деревянный ящик;",
        "  – | влагозащита.",
    ]
    assert codes(result) == []


def test_nested_list_under_a_point_and_return(tmp_path) -> None:
    """The inner list reaches 3 and the outer continues with 4."""
    result = run(
        doc(
            "1\tНастоящее ТЗ устанавливает требования;",
            "2\tОборудование должно быть описано;",
            "3\tСостав оборудования:",
            "1.\tСыроизготовитель;",
            "2.\tЛиния транспортировки;",
            "3.\tПлавитель;",
            "4\tОбщие требования",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1 | Настоящее ТЗ устанавливает требования;",
        "2 | Оборудование должно быть описано;",
        "3 | Состав оборудования:",
        "  1. | Сыроизготовитель;",
        "  2. | Линия транспортировки;",
        "  3. | Плавитель;",
        "4 | Общие требования",
    ]
    assert codes(result) == []


def test_numbers_inside_text_are_not_points(tmp_path) -> None:
    result = run(
        doc(
            "1. Требования к электропитанию.",
            "12.05.2026 состоится приёмка оборудования.",
            "5 штук поставляется в первой партии.",
            "2026 год — срок ввода в эксплуатацию.",
            "5.5 кВт — мощность двигателя.",
            "010/2011 — номер технического регламента.",
            "2. Гарантия.",
        ),
        tmp_path,
    )
    lines = shape(result)
    assert len(lines) == 2
    assert lines[0].startswith("1. | Требования к электропитанию.")
    assert "5.5 кВт — мощность двигателя." in lines[0]
    assert lines[1] == "2. | Гарантия."


def test_gap_duplicate_and_backward_are_kept_and_reported(tmp_path) -> None:
    result = run(
        doc(
            "1. Первый",
            "2. Второй",
            "4. Четвёртый",
            "4. Повтор номера",
            "3. Назад",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Первый",
        "2. | Второй",
        "4. | Четвёртый",
        "4. | Повтор номера",
        "3. | Назад",
    ]
    assert codes(result) == [
        "numbering_gap",
        "numbering_duplicate",
        "numbering_backward",
    ]


def test_subpoint_anomalies(tmp_path) -> None:
    result = run(
        doc(
            "1. Введение",
            "2. Раздел",
            "2.1. Первый",
            "2.2. Второй",
            "2.5. Пятый",
            "2.5. Повтор",
            "2.7.1. Подпункт без родителя",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Введение",
        "2. | Раздел",
        "  2.1. | Первый",
        "  2.2. | Второй",
        "  2.5. | Пятый",
        "  2.5. | Повтор",
        "  2.7.1. | Подпункт без родителя",
    ]
    assert codes(result) == [
        "numbering_gap",
        "numbering_duplicate",
        "missing_parent",
    ]


def test_restart_without_heading_keeps_both_lists(tmp_path) -> None:
    result = run(
        doc(
            "1. Первый",
            "2. Второй",
            "3. Третий.",
            "1. Снова первый",
            "2. Снова второй",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Первый",
        "2. | Второй",
        "3. | Третий.",
        "1. | Снова первый",
        "2. | Снова второй",
    ]
    assert codes(result) == ["numbering_restart"]


def test_document_may_start_in_the_middle(tmp_path) -> None:
    result = run(
        doc(
            "5.3. Гарантийный срок — не менее 24 месяцев.",
            "Гарантия распространяется на все узлы.",
            "5.4. Срок поставки — 90 дней.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "5.3. | Гарантийный срок — не менее 24 месяцев. "
        "Гарантия распространяется на все узлы.",
        "5.4. | Срок поставки — 90 дней.",
    ]
    assert codes(result) == []
    assert "numbering_starts_from" in codes(result, "info")


def test_points_without_parent_nodes(tmp_path) -> None:
    """1.1, 1.2, 2.1 with no standalone "1" and "2" is a normal style."""
    result = run(
        doc("1.1 Первый", "1.2 Второй", "2.1 Третий", "2.2 Четвёртый"),
        tmp_path,
    )
    assert shape(result) == [
        "1.1 | Первый",
        "1.2 | Второй",
        "2.1 | Третий",
        "2.2 | Четвёртый",
    ]
    assert codes(result) == []


def test_capital_letter_list_needs_confirmation(tmp_path) -> None:
    result = run(
        doc(
            "1. Комплект поставки:",
            "А. Насос",
            "Б. Мешалка",
            "2. Автор методики",
            "А. С. Петров разработал методику испытаний.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Комплект поставки:",
        "  А. | Насос",
        "  Б. | Мешалка",
        "2. | Автор методики А. С. Петров разработал методику испытаний.",
    ]


def test_latin_letter_typed_in_russian_list(tmp_path) -> None:
    result = run(
        doc("1. Документы:", "a) паспорт;", "б) сертификат;", "в) акт."),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Документы:",
        "  a) | паспорт;",
        "  б) | сертификат;",
        "  в) | акт.",
    ]
    assert codes(result) == []


# ---- sections, headings, scopes -------------------------------------


def test_lists_restart_under_styled_headings(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("Насос", style="Heading1")
    builder.p("1. Подача 10 м3/ч").p("2. Напор 30 м")
    builder.p("Мешалка", style="Heading1")
    builder.p("1. Мощность 3 кВт").p("2. Обороты 60 об/мин")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "# | Насос",
        "  1. | Подача 10 м3/ч",
        "  2. | Напор 30 м",
        "# | Мешалка",
        "  1. | Мощность 3 кВт",
        "  2. | Обороты 60 об/мин",
    ]
    assert codes(result) == []


def test_numbering_continues_across_headings(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("Насос", style="Heading1")
    builder.p("1. Подача 10 м3/ч").p("2. Напор 30 м")
    builder.p("Мешалка", style="Heading1")
    builder.p("3. Мощность 3 кВт").p("4. Обороты 60 об/мин")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "# | Насос",
        "  1. | Подача 10 м3/ч",
        "  2. | Напор 30 м",
        "# | Мешалка",
        "  3. | Мощность 3 кВт",
        "  4. | Обороты 60 об/мин",
    ]
    assert codes(result) == []


def test_bold_line_inside_numbered_section(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие положения.")
    builder.p("2. Требования к оборудованию")
    builder.p("2.1. Оборудование новое.")
    builder.p("Насос", bold=True)
    builder.p("2.2. Подача не менее 10 м3/ч.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие положения.",
        "2. | Требования к оборудованию",
        "  2.1. | Оборудование новое.",
        "  # | Насос",
        "  2.2. | Подача не менее 10 м3/ч.",
    ]
    assert codes(result) == []


def test_appendices_are_separate_numbering_scopes(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Основной пункт").p("2. Второй пункт")
    builder.p("Приложение 1", jc="right")
    builder.p("1. Пункт приложения").p("2. Ещё пункт")
    builder.p("Приложение 2", jc="right")
    builder.p("1. Пункт второго приложения")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Основной пункт",
        "2. | Второй пункт",
        "Приложение 1 |",
        "  1. | Пункт приложения",
        "  2. | Ещё пункт",
        "Приложение 2 |",
        "  1. | Пункт второго приложения",
    ]
    assert codes(result) == []


def test_lots_with_identical_requirements_lose_nothing(tmp_path) -> None:
    result = run(
        doc(
            "Лот № 1. Стол",
            "1. Гарантия не менее 24 месяцев",
            "2. Цвет: белый",
            "Лот № 2. Шкаф",
            "1. Гарантия не менее 24 месяцев",
            "2. Цвет: белый",
            "3. Высота не менее 2000 мм",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "Лот № 1 | Стол",
        "  1. | Гарантия не менее 24 месяцев",
        "  2. | Цвет: белый",
        "Лот № 2 | Шкаф",
        "  1. | Гарантия не менее 24 месяцев",
        "  2. | Цвет: белый",
        "  3. | Высота не менее 2000 мм",
    ]
    assert codes(result) == []


def test_section_word_is_parent_of_its_points(tmp_path) -> None:
    result = run(
        doc(
            "Раздел 1. Общие положения",
            "1.1. Первый",
            "1.2. Второй",
            "Раздел 2. Требования",
            "2.1. Третий",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "Раздел 1 | Общие положения",
        "  1.1. | Первый",
        "  1.2. | Второй",
        "Раздел 2 | Требования",
        "  2.1. | Третий",
    ]
    assert codes(result) == []


def test_sentence_starting_with_section_word_is_text(tmp_path) -> None:
    result = run(
        doc(
            "1. Комплект документов.",
            "Приложение 1 является неотъемлемой частью настоящего "
            "технического задания и содержит перечень оборудования, "
            "подлежащего поставке в рамках договора.",
        ),
        tmp_path,
    )
    lines = shape(result)
    assert len(lines) == 1
    assert "Приложение 1 является" in lines[0]


def test_document_without_numbering(tmp_path) -> None:
    builder = DocxBuilder()
    builder.p("ТЕХНИЧЕСКОЕ ЗАДАНИЕ", bold=True, jc="center")
    builder.p("на поставку насоса", jc="center")
    builder.p("Поставщик обязан поставить насос.")
    builder.p("Насос должен быть центробежным.")
    builder.p("Требования к документации", bold=True)
    builder.p("Паспорт на русском языке.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "# | ТЕХНИЧЕСКОЕ ЗАДАНИЕ на поставку насоса",
        "· | Поставщик обязан поставить насос.",
        "· | Насос должен быть центробежным.",
        "# | Требования к документации",
        "  · | Паспорт на русском языке.",
    ]
    assert codes(result) == ["no_numbering"]
    assert "pages_unknown" in codes(result, "info")


def test_empty_document(tmp_path) -> None:
    result = run(DocxBuilder().p("").p("   "), tmp_path)
    assert result.nodes == []
    assert codes(result) == ["empty_document"]


# ---- text that belongs to a point -----------------------------------


def test_bullets_paragraph_between_them_and_broken_line(tmp_path) -> None:
    result = run(
        doc(
            "1. Общие сведения.",
            "2. Сыроизготовитель:",
            "- рубашка подогрева;",
            "- теплоизоляция не менее 50 мм.",
            "Автоматическое регулирование скорости мешалки.",
            "- количество моющих головок и их тип должны",
            "гарантировать мойку;",
            "- патрубок подачи.",
        ),
        tmp_path,
    )
    assert shape(result) == [
        "1. | Общие сведения.",
        "2. | Сыроизготовитель:",
        "  – | рубашка подогрева;",
        "  – | теплоизоляция не менее 50 мм.",
        "  · | Автоматическое регулирование скорости мешалки.",
        "  – | количество моющих головок и их тип должны гарантировать мойку;",
        "  – | патрубок подачи.",
    ]


def test_text_after_heading_point_becomes_its_content(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. ОБЩИЕ ПОЛОЖЕНИЯ", bold=True)
    builder.p("Настоящее задание определяет требования.")
    builder.p("Срок действия — один год.")
    builder.p("2. ТРЕБОВАНИЯ", bold=True)
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | ОБЩИЕ ПОЛОЖЕНИЯ",
        "  · | Настоящее задание определяет требования.",
        "  · | Срок действия — один год.",
        "2. | ТРЕБОВАНИЯ",
    ]


def test_automatic_and_typed_numbers_together(tmp_path) -> None:
    """Sections numbered by Word, sub-points typed by hand."""
    builder = DocxBuilder(pages=1).abstract(0, [{"text": "%1."}]).num(1, 0)
    builder.p("Общие требования", num=(1, 0))
    builder.p("1.1. Оборудование новое.")
    builder.p("1.2. Гарантия 24 месяца.")
    builder.p("Технические требования", num=(1, 0))
    builder.p("2.1. Мощность 5 кВт.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие требования",
        "  1.1. | Оборудование новое.",
        "  1.2. | Гарантия 24 месяца.",
        "2. | Технические требования",
        "  2.1. | Мощность 5 кВт.",
    ]
    assert codes(result) == []


def test_automatic_outline_levels(tmp_path) -> None:
    levels = [
        {"text": "%1."},
        {"text": "%2)", "fmt": "russianLower"},
        {"text": "–", "fmt": "bullet"},
    ]
    builder = DocxBuilder(pages=1).abstract(0, levels).num(1, 0)
    for level, text in [
        (0, "Документы"),
        (1, "паспорт"),
        (1, "сертификаты:"),
        (2, "соответствия"),
        (2, "происхождения"),
        (0, "Упаковка"),
        (1, "ящик"),
    ]:
        builder.p(text, num=(1, level))
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Документы",
        "  а) | паспорт",
        "  б) | сертификаты:",
        "    – | соответствия",
        "    – | происхождения",
        "2. | Упаковка",
        "  а) | ящик",
    ]
    assert codes(result) == []


def test_empty_numbered_line_is_skipped_and_reported(tmp_path) -> None:
    builder = DocxBuilder(pages=1).abstract(0, [{"text": "%1."}]).num(1, 0)
    builder.p("Первый", num=(1, 0)).p("", num=(1, 0)).p("Третий", num=(1, 0))
    result = run(builder, tmp_path)
    assert shape(result) == ["1. | Первый", "3. | Третий"]
    assert codes(result) == []
    assert "empty_items_skipped" in codes(result, "info")


def test_empty_numbered_line_keeps_its_table(tmp_path) -> None:
    builder = DocxBuilder(pages=1).abstract(0, [{"text": "%1."}]).num(1, 0)
    builder.p("Общие требования", num=(1, 0)).p("", num=(1, 0))
    builder.table([["Параметр", "Значение"], ["Напряжение", "380 В"]])
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие требования",
        "2. |",
        "  [T] |",
        "    [R] | Напряжение: 380 В",
    ]


def test_all_bold_document_has_no_false_headings(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие положения", bold=True)
    builder.p("Оборудование должно быть новым", bold=True)
    builder.p("2. Гарантия", bold=True)
    builder.p("Гарантийный срок не менее 24 месяцев", bold=True)
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие положения Оборудование должно быть новым",
        "2. | Гарантия Гарантийный срок не менее 24 месяцев",
    ]


def test_two_bold_lines_are_two_headings(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие сведения.")
    builder.p("Насос", bold=True)
    builder.p("Технические характеристики", bold=True)
    builder.p("Подача не менее 10 м3/ч.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Общие сведения.",
        "# | Насос",
        "# | Технические характеристики",
        "  · | Подача не менее 10 м3/ч.",
    ]
