"""Finding quotes and pages in extracted offer text."""

from __future__ import annotations

from backend.services.kp_compare.text import (
    PageIndex,
    find_quote,
    fold,
    fold_plain,
    latin_share,
    shorten,
)

TABLE = "Gearboxes covering: ....... 2 mm\nInsulation : ....................... 50 mm\n"


def test_fold_unifies_case_dashes_quotes_and_spaces() -> None:
    assert fold_plain("«Двойной  НОЛЬ» — ёмкость\n\tAISI–304") == (
        '"двойной ноль" - емкость aisi-304'
    )


def test_fold_keeps_a_map_back_to_the_source() -> None:
    source = "  Mixing   of cultures"
    folded = fold(source)
    start = folded.text.index("of")
    assert source[folded.source_span(start, start + 2)[0] :].startswith("of")


def test_dotted_leaders_count_as_a_space() -> None:
    assert fold_plain(TABLE).endswith("insulation : 50 mm")


def test_quote_copied_from_a_table_row_is_found() -> None:
    match = find_quote("Insulation : ............. 50 mm", fold(TABLE))
    assert match is not None and match.exact
    assert TABLE[match.start : match.end].startswith("Insulation")


def test_quote_without_the_leader_dots_is_found() -> None:
    assert find_quote("Insulation : 50 mm", fold(TABLE)) is not None


def test_ellipsis_joins_fragments_that_follow_each_other() -> None:
    text = "The cheese vat is a double-circle tank, with double cone bottom, triple-walled, closed design."
    haystack = fold(text)
    assert (
        find_quote("double-circle tank … closed design", haystack) is not None
    )
    assert find_quote("closed design … double-circle tank", haystack) is None


def test_line_breaks_and_hyphens_do_not_break_a_quote() -> None:
    text = "The dimple jacket is tested at 6 bar and it can operate up to a pres-\nsure of 3 bar with any heating media."
    match = find_quote(
        "The dimple jacket is tested at 6 bar and it can operate up to a pressure of 3 bar",
        fold(text),
    )
    assert match is not None and not match.exact


def test_an_invented_quote_is_not_found() -> None:
    text = "Each agitator is provided with special cutting blades."
    assert find_quote("Each agitator is made of titanium", fold(text)) is None


def test_quote_is_searched_only_inside_the_given_span() -> None:
    text = "Item 1 AISI 316 tank.\nItem 2 AISI 304 frame."
    haystack = fold(text)
    second = haystack.text.index("item 2")
    assert find_quote("AISI 316 tank", haystack, start=second) is None
    assert find_quote("AISI 304 frame", haystack, start=second) is not None


def test_page_index() -> None:
    text = "--- Страница 1 ---\nfirst\n--- Страница 2 ---\nsecond"
    pages = PageIndex(text)
    assert pages.has_pages
    assert pages.page_at(text.index("first")) == 1
    assert pages.page_at(text.index("second")) == 2
    assert pages.page_range(text.index("first"), len(text)) == (1, 2)
    assert PageIndex("no marks").page_at(3) is None


def test_language_and_shorten() -> None:
    assert latin_share("Cheese vat сыроизготовитель") < 0.5
    assert latin_share("Cheese vat, capacity 10.000 l") == 1.0
    assert shorten("--- Страница 3 ---\n" + "слово " * 50, 20).endswith("…")
