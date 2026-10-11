"""Documents covering Word automatic numbering, one case per function.

Each case returns a builder plus the labels a reader sees in Word. The
expectations were confirmed against Microsoft Word (see the oracle test).
"""

from __future__ import annotations

from backend.tests.tz_structure.docx_builder import DocxBuilder

LEGAL = [
    {"text": "%1."},
    {"text": "%1.%2."},
    {"text": "%1.%2.%3."},
]


def simple_list():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0)
    for text in ("Первый", "Второй", "Третий"):
        doc.p(text, num=(1, 0))
    return doc, ["1.", "2.", "3."]


def legal_multilevel():
    doc = DocxBuilder().abstract(0, LEGAL).num(1, 0)
    plan = [
        (0, "1."),
        (1, "1.1."),
        (1, "1.2."),
        (2, "1.2.1."),
        (2, "1.2.2."),
        (1, "1.3."),
        (0, "2."),
        (1, "2.1."),
        (2, "2.1.1."),
        (0, "3."),
    ]
    for level, label in plan:
        doc.p(f"Пункт {label}", num=(1, level))
    return doc, [label for _, label in plan]


def outline_mixed_formats():
    levels = [
        {"text": "%1."},
        {"text": "%2)", "fmt": "russianLower"},
        {"text": "%3.", "fmt": "lowerRoman"},
    ]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    plan = [
        (0, "1."),
        (1, "а)"),
        (1, "б)"),
        (2, "i."),
        (2, "ii."),
        (1, "в)"),
        (0, "2."),
        (1, "а)"),
    ]
    for level, label in plan:
        doc.p(f"Текст {label}", num=(1, level))
    return doc, [label for _, label in plan]


def russian_letters_long():
    doc = (
        DocxBuilder()
        .abstract(0, [{"text": "%1)", "fmt": "russianLower"}])
        .num(1, 0)
    )
    for index in range(31):
        doc.p(f"Буква {index + 1}", num=(1, 0))
    alphabet = "абвгдежзиклмнопрстуфхцчшщыэюя"
    expected = [f"{char})" for char in alphabet] + ["аа)", "бб)"]
    return doc, expected


def latin_letters_and_roman():
    doc = (
        DocxBuilder()
        .abstract(0, [{"text": "%1.", "fmt": "upperLetter"}])
        .abstract(1, [{"text": "%1.", "fmt": "upperRoman"}])
        .abstract(2, [{"text": "%1)", "fmt": "lowerLetter"}])
        .num(1, 0)
        .num(2, 1)
        .num(3, 2)
    )
    expected = []
    for label in ("A.", "B.", "C."):
        doc.p("Латинская", num=(1, 0))
        expected.append(label)
    for label in ("I.", "II.", "III.", "IV."):
        doc.p("Римская", num=(2, 0))
        expected.append(label)
    for label in ("a)", "b)"):
        doc.p("Строчная", num=(3, 0))
        expected.append(label)
    return doc, expected


def restart_with_override():
    doc = (
        DocxBuilder()
        .abstract(0, [{"text": "%1."}])
        .num(1, 0)
        .num(2, 0, start_overrides={0: 1})
    )
    expected = []
    for label in ("1.", "2.", "3."):
        doc.p("Первый список", num=(1, 0))
        expected.append(label)
    doc.p("Обычный абзац между списками")
    expected.append("")
    for label in ("1.", "2."):
        doc.p("Список начат заново", num=(2, 0))
        expected.append(label)
    return doc, expected


def shared_counter_continues():
    """Two list instances of one definition keep counting together."""
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0).num(2, 0)
    expected = []
    for label in ("1.", "2."):
        doc.p("Экземпляр один", num=(1, 0))
        expected.append(label)
    for label in ("3.", "4."):
        doc.p("Экземпляр два", num=(2, 0))
        expected.append(label)
    doc.p("Снова первый", num=(1, 0))
    expected.append("5.")
    return doc, expected


def start_from_five():
    doc = DocxBuilder().abstract(0, [{"text": "%1.", "start": 5}]).num(1, 0)
    for _ in range(3):
        doc.p("Пункт", num=(1, 0))
    return doc, ["5.", "6.", "7."]


def numbering_removed_inside_list():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0)
    doc.p("Первый", num=(1, 0))
    doc.p("Без номера", num=(0, 0))
    doc.p("Второй", num=(1, 0))
    return doc, ["1.", "", "2."]


def headings_numbered_by_style():
    levels = [
        {"text": "%1.", "pstyle": "Heading1"},
        {"text": "%1.%2.", "pstyle": "Heading2"},
        {"text": "%1.%2.%3.", "pstyle": "Heading3"},
    ]
    doc = DocxBuilder()
    doc._styles = [doc._styles[0]]
    doc.style("Heading1", "heading 1", outline=0, num=(1, None))
    doc.style("Heading2", "heading 2", outline=1, num=(1, 1))
    doc.style("Heading3", "heading 3", outline=2, num=(1, 2))
    doc.abstract(0, levels).num(1, 0)
    plan = [
        ("Heading1", "1."),
        ("Heading2", "1.1."),
        ("Heading2", "1.2."),
        ("Heading3", "1.2.1."),
        ("Heading1", "2."),
        ("Heading2", "2.1."),
    ]
    expected = []
    for style, label in plan:
        doc.p(f"Заголовок {label}", style=style)
        expected.append(label)
        doc.p("Текст раздела")
        expected.append("")
    return doc, expected


def word_prefix_labels():
    doc = (
        DocxBuilder()
        .abstract(0, [{"text": "Статья %1."}, {"text": "%1.%2."}])
        .abstract(1, [{"text": "Приложение %1"}])
        .num(1, 0)
        .num(2, 1)
    )
    plan = [
        ((1, 0), "Статья 1."),
        ((1, 1), "1.1."),
        ((1, 1), "1.2."),
        ((1, 0), "Статья 2."),
        ((1, 1), "2.1."),
        ((2, 0), "Приложение 1"),
        ((2, 0), "Приложение 2"),
    ]
    for num, _label in plan:
        doc.p("Содержание", num=num)
    return doc, [label for _, label in plan]


def no_restart_level():
    """lvlRestart=0: the second level never restarts."""
    levels = [{"text": "%1."}, {"text": "%1.%2.", "restart": 0}]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    plan = [(0, "1."), (1, "1.1."), (1, "1.2."), (0, "2."), (1, "2.3.")]
    for level, _label in plan:
        doc.p("Текст", num=(1, level))
    return doc, [label for _, label in plan]


def legal_style_flag():
    """isLgl shows parent levels as digits even if they are Roman."""
    levels = [
        {"text": "%1.", "fmt": "upperRoman"},
        {"text": "%1.%2.", "lgl": True},
    ]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    plan = [(0, "I."), (1, "1.1."), (0, "II."), (1, "2.1."), (1, "2.2.")]
    for level, _label in plan:
        doc.p("Текст", num=(1, level))
    return doc, [label for _, label in plan]


def deeper_level_first():
    """A list that opens on the second level."""
    doc = DocxBuilder().abstract(0, LEGAL).num(1, 0)
    plan = [(1, "1.1."), (1, "1.2."), (0, "2."), (1, "2.1.")]
    for level, _label in plan:
        doc.p("Текст", num=(1, level))
    return doc, [label for _, label in plan]


def bullets_and_numbers():
    doc = (
        DocxBuilder()
        .abstract(0, [{"text": "%1."}])
        .abstract(1, [{"text": "–", "fmt": "bullet"}])
        .num(1, 0)
        .num(2, 1)
    )
    plan = [
        ((1, 0), "1."),
        ((2, 0), "–"),
        ((2, 0), "–"),
        ((1, 0), "2."),
        ((2, 0), "–"),
    ]
    for num, _label in plan:
        doc.p("Текст", num=num)
    return doc, [label for _, label in plan]


def numbers_inside_table():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0)
    doc.p("Перед таблицей", num=(1, 0))
    doc.table(
        [
            ["№", "Параметр"],
            [{"text": "", "num": (1, 0)}, "Мощность"],
            [{"text": "", "num": (1, 0)}, "Напряжение"],
        ]
    )
    doc.p("После таблицы", num=(1, 0))
    return doc, ["1.", "", "", "2.", "", "3.", "", "4."]


def style_level_comes_from_style():
    """The level is taken from the style, never guessed from w:pStyle."""
    levels = [{"text": "%1."}, {"text": "%1.%2.", "pstyle": "S"}]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    doc.style("S", "MyList", num=(1, None))
    doc.p("Прямая нумерация", num=(1, 0))
    doc.p("Нумерация из стиля", style="S")
    return doc, ["1.", "2."]


def style_linked_to_other_style():
    """A level linked to another style gives this style no number."""
    levels = [{"text": "%1.", "pstyle": "Other"}]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    doc.style("Other", "Other", num=(1, None))
    doc.style("S", "MyList", num=(1, None))
    doc.style("Child", "ChildOfOther", based_on="Other")
    doc.p("Связанный стиль", style="Other")
    doc.p("Посторонний стиль", style="S")
    doc.p("Производный стиль", style="Child")
    return doc, ["1.", "", "2."]


def style_numbering_switched_off():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0)
    doc.style("S0", "L0", num=(1, None))
    doc.style("Off", "NoNumber", based_on="S0", num=(0, None))
    doc.p("Со стилем списка", style="S0")
    doc.p("Нумерация отключена в производном стиле", style="Off")
    doc.p("Со стилем списка", style="S0")
    return doc, ["1.", "", "2."]


def direct_numbering_beats_style():
    levels = [
        {"text": "%1.", "pstyle": "S0"},
        {"text": "%1.%2.", "pstyle": "S1"},
    ]
    doc = DocxBuilder().abstract(0, levels).num(1, 0)
    doc.style("S0", "L0", num=(1, None))
    doc.style("S1", "L1", num=(1, 1))
    doc.p("Прямая, уровень 1", num=(1, 0))
    doc.p("Прямая, уровень 2", num=(1, 1))
    doc.p("Стиль уровня 2, но прямой уровень 1", style="S1", num=(1, 0))
    doc.p("Стиль уровня 2", style="S1")
    return doc, ["1.", "1.1.", "2.", "2.1."]


def single_level_list_ignores_paragraph_level():
    """Lists made with the toolbar buttons are "singleLevel" in the file."""
    doc = DocxBuilder().abstract(0, [{"text": "%1."}], kind="singleLevel")
    doc.num(1, 0)
    for ilvl in (0, 1, 1, 2, 0, 8):
        doc.p(f"Пункт с уровнем {ilvl}", num=(1, ilvl))
    return doc, ["1.", "2.", "3.", "4.", "5.", "6."]


def undefined_level_shows_no_number():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}, {"text": "%1.%2."}])
    doc.num(1, 0)
    plan = [
        (0, "1."),
        (1, "1.1."),
        (2, ""),
        (3, ""),
        (1, "1.2."),
        (2, ""),
        (0, "2."),
    ]
    for level, _label in plan:
        doc.p("Текст", num=(1, level))
    return doc, [label for _, label in plan]


def undefined_level_still_starts_the_list():
    doc = DocxBuilder().abstract(0, [{"text": "%1."}]).num(1, 0)
    for level in (1, 1, 0, 0):
        doc.p("Текст", num=(1, level))
    return doc, ["", "", "2.", "3."]


def format_override_on_shared_counter():
    """Word writes this itself: bullets, then the same counter as "4."."""
    bullet = {"text": "\uf0b7", "fmt": "bullet"}
    doc = DocxBuilder().abstract(0, [bullet], kind="singleLevel")
    doc.num(1, 0)
    doc.num(2, 0, level_overrides={0: {"text": "%1.", "fmt": "decimal"}})
    doc.num(3, 0, level_overrides={0: {"text": "%1)", "fmt": "russianLower"}})
    plan = [(1, "•"), (1, "•"), (1, "•"), (2, "4."), (3, "д)"), (1, "•")]
    for num_id, _label in plan:
        doc.p("Текст", num=(num_id, 1))
    return doc, [label for _, label in plan]


CASES = {
    "single_level_list_ignores_paragraph_level": (
        single_level_list_ignores_paragraph_level
    ),
    "undefined_level_shows_no_number": undefined_level_shows_no_number,
    "undefined_level_still_starts_the_list": (
        undefined_level_still_starts_the_list
    ),
    "format_override_on_shared_counter": format_override_on_shared_counter,
    "style_level_comes_from_style": style_level_comes_from_style,
    "style_linked_to_other_style": style_linked_to_other_style,
    "style_numbering_switched_off": style_numbering_switched_off,
    "direct_numbering_beats_style": direct_numbering_beats_style,
    "simple_list": simple_list,
    "legal_multilevel": legal_multilevel,
    "outline_mixed_formats": outline_mixed_formats,
    "russian_letters_long": russian_letters_long,
    "latin_letters_and_roman": latin_letters_and_roman,
    "restart_with_override": restart_with_override,
    "shared_counter_continues": shared_counter_continues,
    "start_from_five": start_from_five,
    "numbering_removed_inside_list": numbering_removed_inside_list,
    "headings_numbered_by_style": headings_numbered_by_style,
    "word_prefix_labels": word_prefix_labels,
    "no_restart_level": no_restart_level,
    "legal_style_flag": legal_style_flag,
    "deeper_level_first": deeper_level_first,
    "bullets_and_numbers": bullets_and_numbers,
    "numbers_inside_table": numbers_inside_table,
}
