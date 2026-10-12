"""Hand-over of the Word outline to the product's requirements hierarchy."""

from __future__ import annotations

from pathlib import Path

from backend.services.tz_structure import extract_structure
from backend.services.tz_structure.requirements import (
    MIN_NUMBERED_POINTS,
    load_docx_requirements,
    outline_to_requirements,
    structure_is_usable,
)
from backend.tests.tz_structure.docx_builder import DocxBuilder
from backend.tests.tz_structure.test_outline import doc
from backend.utils.requirements_struct import (
    collect_tz_sections,
    count_requirements,
    enrich_hierarchy_refs,
    flatten_hierarchy_for_matching,
    hierarchy_has_numbering,
    normalize_tz_requirements,
    page_map_from_hierarchy,
    resolve_letter_tz_fields,
)

GUARANTEE_DOC = (
    "1. Общие требования",
    "1.1. Оборудование должно быть новым.",
    "1.2. Гарантийный срок не менее 24 месяцев:",
    "1.2.1 на насос;",
    "1.2.2 на электродвигатель.",
    "2. Технические требования",
    "2.1 Мощность не более 5,5 кВт.",
)


def hierarchy(builder: DocxBuilder, tmp_path: Path) -> dict:
    path = builder.save(tmp_path / "doc.docx")
    return outline_to_requirements(extract_structure(path))


def rows(nodes: dict, depth: int = 0) -> list[tuple]:
    """(key, label, number, auto, text) in document order."""
    out: list[tuple] = []
    for key, node in nodes.items():
        out.append(
            (
                key,
                node.get("label"),
                node.get("number"),
                node.get("auto", False),
                node["text"],
            )
        )
        out.extend(rows(node["children"], depth + 1))
    return out


# ---- keys are positions, numbers travel beside the text ----------------


def test_keys_are_positions_and_document_numbers_stay_beside_the_text(
    tmp_path,
) -> None:
    result = hierarchy(doc(*GUARANTEE_DOC), tmp_path)
    assert rows(result) == [
        ("1", "1.", "1", False, "Общие требования"),
        ("1.1", "1.1.", "1.1", False, "Оборудование должно быть новым."),
        ("1.2", "1.2.", "1.2", False, "Гарантийный срок не менее 24 месяцев:"),
        ("1.2.1", "1.2.1", "1.2.1", False, "на насос;"),
        ("1.2.2", "1.2.2", "1.2.2", False, "на электродвигатель."),
        ("2", "2.", "2", False, "Технические требования"),
        ("2.1", "2.1", "2.1", False, "Мощность не более 5,5 кВт."),
    ]


def test_textless_word_heading_is_collapsed_but_its_children_are_kept(
    tmp_path,
) -> None:
    builder = DocxBuilder()
    builder.abstract(
        1,
        [
            {"fmt": "decimal", "text": "%1."},
            {"fmt": "decimal", "text": "%1.%2"},
            {"fmt": "decimal", "text": "%1.%2.%3"},
        ],
    ).num(1, 1)
    builder.p("Паровой плавитель", num=(1, 0))
    builder.p("", num=(1, 1))
    builder.p(
        "Производительность не менее 1200 кг/час.",
        num=(1, 2),
    )
    builder.p("Нагрев сырного пласта паром.", num=(1, 2))

    hierarchy_ = hierarchy(builder, tmp_path)
    section = hierarchy_["1"]
    children = list(section["children"].values())

    assert section["text"] == "Паровой плавитель"
    assert [(node["label"], node["text"]) for node in children] == [
        ("1.1.1", "Производительность не менее 1200 кг/час."),
        ("1.1.2", "Нагрев сырного пласта паром."),
    ]
    assert all(node["text"].strip() for node in children)


def test_a_skipped_number_is_kept_in_the_label_not_closed_up(tmp_path) -> None:
    result = hierarchy(doc("1. Первый", "2. Второй", "4. Четвёртый"), tmp_path)
    assert [(k, label) for k, label, *_ in rows(result)] == [
        ("1", "1."),
        ("2", "2."),
        ("3", "4."),
    ]


def test_numbering_that_restarts_in_each_section_keeps_keys_unique(
    tmp_path,
) -> None:
    result = hierarchy(
        doc(
            "РАЗДЕЛ I. Общие положения",
            "1. Заказчик",
            "2. Предмет",
            "РАЗДЕЛ II. Требования",
            "1. Мощность",
            "2. Материал",
        ),
        tmp_path,
    )
    listed = rows(result)
    keys = [row[0] for row in listed]
    assert len(keys) == len(set(keys))
    assert [row[1] for row in listed] == ["", "1.", "2.", "", "1.", "2."]
    # the section word is part of the title, not a number to quote
    assert listed[0][4].startswith("РАЗДЕЛ I")
    assert listed[0][2] == ""


def test_list_entries_without_a_number_get_a_marked_system_number(
    tmp_path,
) -> None:
    result = hierarchy(
        doc(
            "3. Комплектация:",
            "- рубашка подогрева;",
            "- теплоизоляция не менее 50 мм.",
        ),
        tmp_path,
    )
    assert rows(result) == [
        ("1", "3.", "3", False, "Комплектация:"),
        ("1.1", "3.1", "3.1", True, "рубашка подогрева;"),
        ("1.2", "3.2", "3.2", True, "теплоизоляция не менее 50 мм."),
    ]
    assert result["1"]["children"]["1.1"]["auto"] is True


def test_unnumbered_text_has_an_empty_label_not_a_made_up_one(
    tmp_path,
) -> None:
    result = hierarchy(
        doc("ТЕХНИЧЕСКОЕ ЗАДАНИЕ", "1. Один", "2. Два", "3. Три"), tmp_path
    )
    title = result["1"]
    assert title["text"] == "ТЕХНИЧЕСКОЕ ЗАДАНИЕ"
    assert title["label"] == ""
    assert title["number"] == ""
    assert "auto" not in title


def test_table_rows_carry_their_own_numbers(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("2. Технические характеристики")
    builder.table(
        [
            ["№ п/п", "Наименование параметра", "Требуемое значение"],
            ["1", "Производительность", "не менее 1000 л/ч"],
            ["2", "Материал корпуса", "AISI 304"],
        ]
    )
    result = hierarchy(builder, tmp_path)
    table = result["1"]["children"]["1.1"]
    assert table["text"] == ""
    # the marks stay as in the table; row «2» repeats point «2» of the
    # document, so the number to quote says which table it is
    assert [(c["label"], c["number"]) for c in table["children"].values()] == [
        ("1", "1"),
        ("2", "2 (таблица к п. 2)"),
    ]
    assert list(table["children"].values())[0]["text"] == (
        "Производительность: не менее 1000 л/ч"
    )


def test_a_number_the_document_repeats_says_where_it_belongs(tmp_path) -> None:
    builder = doc("1. Один", "2. Два", "3. Три")
    builder.p("Приложение №1", jc="right")
    for line in ("1. Торцевое уплотнение", "2. Подшипники", "3. Колесо"):
        builder.p(line)
    result = hierarchy(builder, tmp_path)
    by_text = {row[4]: row for row in rows(result)}

    # the document's own points keep their numbers ...
    assert by_text["Один"][2] == "1"
    assert by_text["Три"][2] == "3"
    # ... the appendix list starts over, and says so; its marks stay as written
    assert by_text["Торцевое уплотнение"][1:3] == ("1.", "1 (Приложение №1)")
    assert by_text["Колесо"][1:3] == ("3.", "3 (Приложение №1)")


def test_a_number_that_stays_unique_is_not_qualified(tmp_path) -> None:
    builder = doc("1. Один", "2. Два", "3. Три")
    builder.p("Приложение №1", jc="right")
    builder.p("4. Четыре")
    result = hierarchy(builder, tmp_path)
    by_text = {row[4]: row for row in rows(result)}

    assert by_text["Четыре"][2] == "4"


def test_pages_recorded_in_the_file_travel_with_the_points(tmp_path) -> None:
    result = hierarchy(doc(*GUARANTEE_DOC), tmp_path)
    pages = page_map_from_hierarchy(result)
    assert pages["1"] == 1
    assert set(pages) == {key for key, *_ in rows(result)}


def test_nothing_with_text_is_lost(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    for line in GUARANTEE_DOC:
        builder.p(line)
    builder.p("")
    builder.p("- пример;")
    path = builder.save(tmp_path / "doc.docx")
    outline = extract_structure(path)
    texts_in = sorted(
        node.text.strip() for node in outline.walk() if node.text.strip()
    )
    texts_out = sorted(
        row[4] for row in rows(outline_to_requirements(outline))
    )
    assert [t for t in texts_out if t] == texts_in


# ---- the product's own normalisation must keep and not disturb it -------


def test_normalisation_keeps_numbering_and_is_stable(tmp_path) -> None:
    raw = hierarchy(doc(*GUARANTEE_DOC, "- пример;"), tmp_path)
    once = normalize_tz_requirements(raw)
    twice = normalize_tz_requirements(once)
    thrice = normalize_tz_requirements(twice)
    assert hierarchy_has_numbering(once)
    assert rows(once) == rows(raw)
    assert twice == once
    assert thrice == once
    # leaves: 1.1, 1.2.1, 1.2.2 and the list entry under 2.1
    assert count_requirements(once) == 4


def test_a_leaf_quotes_the_nearest_ancestor_with_text(tmp_path) -> None:
    normalized = normalize_tz_requirements(
        hierarchy(doc(*GUARANTEE_DOC), tmp_path)
    )
    assert resolve_letter_tz_fields(normalized, "1.2.1") == (
        "1.2",
        "Гарантийный срок не менее 24 месяцев:",
    )
    assert resolve_letter_tz_fields(normalized, "1.1") == (
        "1",
        "Общие требования",
    )
    lines = flatten_hierarchy_for_matching(normalized)
    assert (
        "1.2.1. на насос;\n  (исходный пункт: Гарантийный срок не менее "
        "24 месяцев:)" in lines
    )


def test_context_does_not_drift_up_with_repeated_normalisation(
    tmp_path,
) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("4. Требования к насосу")
    builder.p("4.1. Требования к документации:")
    builder.p("4.1.1 паспорт на русском языке;")
    builder.p("4.1.2 сертификат соответствия.")
    builder.p("5. Поставка")
    once = normalize_tz_requirements(hierarchy(builder, tmp_path))
    for _ in range(4):
        once = normalize_tz_requirements(once)
    leaf = once["1"]["children"]["1.1"]["children"]["1.1.1"]
    assert leaf["ref"] == "1.1"
    assert leaf["ref_value"] == "Требования к документации:"


def test_hierarchies_from_the_model_are_enriched_as_before() -> None:
    legacy = {
        "1": {
            "text": "Общие",
            "children": {"1.1": {"text": "Мощность не менее 5 кВт"}},
        }
    }
    result = enrich_hierarchy_refs(normalize_tz_requirements(legacy))
    leaf = result["1"]["children"]["1.1"]
    assert leaf["ref"] == "1"
    assert leaf["ref_value"] == "Общие"
    assert not hierarchy_has_numbering(result)
    assert "label" not in leaf


# ---- when to trust the structure ----------------------------------------


def test_structure_needs_a_few_numbered_points(tmp_path) -> None:
    few = extract_structure(
        doc(*[f"{n}. Пункт {n}" for n in range(1, MIN_NUMBERED_POINTS)]).save(
            tmp_path / "few.docx"
        )
    )
    enough = extract_structure(
        doc(
            *[f"{n}. Пункт {n}" for n in range(1, MIN_NUMBERED_POINTS + 1)]
        ).save(tmp_path / "enough.docx")
    )
    assert not structure_is_usable(few)
    assert structure_is_usable(enough)


def test_load_returns_none_for_free_text_and_for_other_files(tmp_path) -> None:
    free = doc(
        "Нужен насос", "Мощность не менее 5 кВт", "Поставка в мае"
    ).save(tmp_path / "free.docx")
    assert load_docx_requirements(free) is None
    assert load_docx_requirements(tmp_path / "tz.pdf") is None


def test_load_never_raises_on_a_broken_file(tmp_path) -> None:
    broken = tmp_path / "broken.docx"
    broken.write_bytes(b"this is not a zip archive")
    assert load_docx_requirements(broken) is None
    assert load_docx_requirements(tmp_path / "missing.docx") is None


def test_load_returns_the_hierarchy_for_a_numbered_docx(tmp_path) -> None:
    path = doc(*GUARANTEE_DOC).save(tmp_path / "tz.docx")
    result = load_docx_requirements(path)
    assert result is not None
    assert result["1"]["label"] == "1."


# ---- lines that only name or open the document are not compared ---------


def titled(*lines: str, opening: tuple[str, ...] = ()) -> DocxBuilder:
    """Title of the document, optional unnumbered opening lines, then points."""
    builder = DocxBuilder(pages=1)
    builder.p("ТЕХНИЧЕСКОЕ ЗАДАНИЕ", bold=True, jc="center")
    for line in opening:
        builder.p(line)
    for line in lines:
        builder.p(line)
    return builder


def flags(nodes: dict) -> dict[str, bool]:
    """key -> marked as not compared, for every point."""
    out: dict[str, bool] = {}

    def walk(level: dict) -> None:
        for key, node in level.items():
            out[key] = bool(node.get("excluded"))
            walk(node["children"])

    walk(nodes)
    return out


def test_title_and_subtitle_are_kept_but_not_compared(tmp_path) -> None:
    result = hierarchy(
        titled(
            "1. Общие требования",
            "1.1. Оборудование новое.",
            "1.2. Гарантия не менее 24 месяцев.",
            opening=("на поставку насосного оборудования",),
        ),
        tmp_path,
    )
    by_text = {row[4]: row[0] for row in rows(result)}
    marked = flags(result)

    assert marked[by_text["ТЕХНИЧЕСКОЕ ЗАДАНИЕ"]] is True
    assert marked[by_text["на поставку насосного оборудования"]] is True
    # everything else is compared, numbered points and their section too
    assert [text for text, key in by_text.items() if marked[key]] == [
        "ТЕХНИЧЕСКОЕ ЗАДАНИЕ",
        "на поставку насосного оборудования",
    ]


def test_an_opening_line_that_reads_as_a_requirement_is_compared(
    tmp_path,
) -> None:
    result = hierarchy(
        titled(
            "1. Общие требования",
            "1.1. Оборудование новое.",
            "1.2. Гарантия не менее 24 месяцев.",
            opening=("Поставщик должен иметь опыт работы не менее трёх лет.",),
        ),
        tmp_path,
    )
    by_text = {row[4]: row[0] for row in rows(result)}
    marked = flags(result)

    assert (
        marked[
            by_text["Поставщик должен иметь опыт работы не менее трёх лет."]
        ]
        is False
    )
    assert marked[by_text["ТЕХНИЧЕСКОЕ ЗАДАНИЕ"]] is True


def test_a_long_unnumbered_opening_is_content_not_a_heading_block(
    tmp_path,
) -> None:
    opening = tuple(f"Сведение об объекте номер {n}" for n in range(1, 8))
    result = hierarchy(
        titled(
            "1. Общие требования",
            "1.1. Оборудование новое.",
            "1.2. Гарантия не менее 24 месяцев.",
            opening=opening,
        ),
        tmp_path,
    )
    marked = flags(result)
    by_text = {row[4]: row[0] for row in rows(result)}

    assert marked[by_text["ТЕХНИЧЕСКОЕ ЗАДАНИЕ"]] is True
    assert not any(marked[by_text[line]] for line in opening)


def test_a_numbered_point_is_never_taken_out_by_its_formatting(
    tmp_path,
) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие требования", bold=True)
    builder.p("2. ГАРАНТИЯ НА ОБОРУДОВАНИЕ 24 МЕСЯЦА", bold=True)
    builder.p("3. Поставка в мае")
    builder.p("4. Монтаж включён в стоимость")
    result = hierarchy(builder, tmp_path)

    assert not any(flags(result).values())


def test_an_empty_appendix_title_is_not_compared(tmp_path) -> None:
    result = hierarchy(
        titled(
            "1. Один",
            "2. Два",
            "3. Три",
        ).p("Приложение №1", jc="right"),
        tmp_path,
    )
    by_text = {row[4]: row[0] for row in rows(result)}

    assert flags(result)[by_text["Приложение №1"]] is True


def test_a_heading_with_content_and_its_content_are_compared(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("РАЗДЕЛ I. Требования", bold=True)
    builder.p("1. Мощность не менее 5 кВт")
    builder.p("2. Материал AISI 304")
    builder.p("3. Гарантия 24 месяца")
    result = hierarchy(builder, tmp_path)

    assert not any(flags(result).values())


def test_not_compared_points_stay_in_the_list_but_leave_the_comparison(
    tmp_path,
) -> None:
    raw = hierarchy(
        titled(
            "1. Общие требования",
            "1.1. Оборудование новое.",
            "1.2. Гарантия не менее 24 месяцев.",
            opening=("на поставку насосного оборудования",),
        ),
        tmp_path,
    )
    normalized = normalize_tz_requirements(normalize_tz_requirements(raw))

    # still there, with the flag, after the product's own normalisation
    assert flags(normalized) == flags(raw)
    assert sum(flags(normalized).values()) == 2
    texts = [row[4] for row in rows(normalized)]
    assert "ТЕХНИЧЕСКОЕ ЗАДАНИЕ" in texts
    # ... but not among what is compared with offers
    assert count_requirements(normalized) == 2
    lines = flatten_hierarchy_for_matching(normalized)
    assert not any("ТЕХНИЧЕСКОЕ ЗАДАНИЕ" in line for line in lines)
    assert not any("на поставку" in line for line in lines)
    assert all(
        title not in section_title
        for _, section_title, _ in collect_tz_sections(normalized)
        for title in ("ТЕХНИЧЕСКОЕ ЗАДАНИЕ", "на поставку")
    )


def test_a_section_marked_not_compared_takes_everything_under_it() -> None:
    hierarchy_ = normalize_tz_requirements(
        {
            "1": {
                "text": "Коммерческие условия",
                "excluded": True,
                "children": {
                    "1.1": {"text": "Оплата 30 дней"},
                    "1.2": {"text": "Доставка за счёт поставщика"},
                },
            },
            "2": {
                "text": "Технические требования",
                "children": {"2.1": {"text": "Мощность не менее 5 кВт"}},
            },
        }
    )

    assert count_requirements(hierarchy_) == 1
    assert flatten_hierarchy_for_matching(hierarchy_) == [
        "2.1. Мощность не менее 5 кВт\n  (исходный пункт: Технические требования)"
    ]
    assert [key for key, _, _ in collect_tz_sections(hierarchy_)] == ["2"]
    assert hierarchy_["1"]["excluded"] is True
    assert "excluded" not in hierarchy_["2"]


def test_a_tz_with_nothing_left_to_compare_counts_as_empty() -> None:
    hierarchy_ = normalize_tz_requirements(
        {"1": {"text": "Название документа", "excluded": True, "children": {}}}
    )

    assert count_requirements(hierarchy_) == 0
