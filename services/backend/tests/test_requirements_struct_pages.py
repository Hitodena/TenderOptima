"""Tests for requirement refs, page maps, and numbered ref_value helpers."""

from pathlib import Path
from unittest.mock import patch

from backend.services.extraction.docx_to_pdf import convert_docx_to_pdf
from backend.utils.requirements_struct import (
    annotate_flat_with_page,
    build_requirement_page_map,
    fix_offer_ref_page,
    fix_requirement_ref_page,
    format_kp_offer_ref,
    format_letter_requirement_line,
    format_numbered_ref_value,
    format_tz_requirement_ref,
    lookup_page_for_key,
    parse_page_from_ref,
    ref_value_starts_with_key,
)


def test_build_requirement_page_map_from_page_markers() -> None:
    raw = """--- Страница 1 ---
1. Предмет закупки

--- Страница 2 ---
2. Доступное количество: от 1000 шт
2.1. Срок поставки: 30 дней
"""
    page_map = build_requirement_page_map(raw)

    assert page_map["1"] == 1
    assert page_map["2"] == 2
    assert page_map["2.1"] == 2


def test_lookup_page_for_key_falls_back_to_parent() -> None:
    page_map = {"2": 5, "2.1": 5}

    assert lookup_page_for_key("2.1.3", page_map) == 5


def test_format_tz_requirement_ref_includes_page() -> None:
    ref = format_tz_requirement_ref(
        "2",
        3,
        "2. Доступное количество: от 1000 шт",
    )

    assert ref == "Источник ТЗ, стр 3, пункт 2"


def test_format_kp_offer_ref_includes_page() -> None:
    ref = format_kp_offer_ref(
        "2",
        4,
        "Доступное количество: от 1000 шт",
    )

    assert ref == "Источник КП, стр 4, пункт 2"


def test_fix_requirement_ref_page_injects_missing_page() -> None:
    ref = fix_requirement_ref_page("Источник ТЗ, пункт 2", 7)

    assert ref == "Источник ТЗ, стр 7, пункт 2"


def test_fix_offer_ref_page_replaces_existing_page() -> None:
    ref = fix_offer_ref_page("Источник КП, стр 1, пункт 2", 9)

    assert ref == "Источник КП, стр 9, пункт 2"


def test_annotate_flat_with_page_appends_hint() -> None:
    page_map = {"2": 3}
    annotated = annotate_flat_with_page(
        "2. Доступное количество: от 1000 шт",
        page_map,
        doc_label="ТЗ",
    )

    assert annotated.endswith("[ТЗ, стр. 3]")


def test_format_numbered_ref_value_avoids_duplicate_prefix() -> None:
    ref_value = "2. Доступное количество: от 1000 шт"

    assert ref_value_starts_with_key("2", ref_value) is True
    assert format_numbered_ref_value("2", ref_value) == ref_value


def test_format_numbered_ref_value_adds_prefix_when_missing() -> None:
    assert (
        format_numbered_ref_value("2", "Доступное количество: от 1000 шт")
        == "2. Доступное количество: от 1000 шт"
    )


def test_format_letter_requirement_line_uses_numbered_ref_value() -> None:
    line = format_letter_requirement_line(
        "2",
        "2. Доступное количество: от 1000 шт",
        fallback_requirement="2. Доступное количество: от 1000 шт",
    )

    assert line == "2. Доступное количество: от 1000 шт"


def test_parse_page_from_ref() -> None:
    assert parse_page_from_ref("Источник ТЗ, стр 12, пункт 2.1") == 12
    assert parse_page_from_ref("Источник КП, пункт 2") is None


@patch("backend.services.extraction.docx_to_pdf.find_soffice_executable")
def test_convert_docx_to_pdf_returns_none_without_soffice(
    mock_find: object,
) -> None:
    mock_find.return_value = None

    result = convert_docx_to_pdf(Path("sample.docx"))

    assert result is None
