"""Which way a TZ file goes: straight from Word, or through the model."""

from __future__ import annotations

from pathlib import Path

import pytest

from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import TZAnalysisItem
from backend.services.analysis import tz
from backend.tests.tz_structure.test_outline import doc

NUMBERED = (
    "1. Общие требования",
    "1.1. Оборудование должно быть новым.",
    "1.2. Гарантия не менее 24 месяцев.",
    "2. Технические требования",
    "2.1 Мощность не более 5,5 кВт.",
)
FROM_MODEL = {"7": {"text": "Ответ модели", "children": {}}}


@pytest.fixture
def model_calls(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Stand in for the text extractor and the model; record the calls."""
    calls: list[str] = []

    def fake_assemble(path: Path) -> str:
        calls.append("text")
        return "текст ТЗ"

    async def fake_extract(text: str, **kwargs) -> dict:
        calls.append("model")
        return FROM_MODEL

    monkeypatch.setattr(tz, "_assemble_document_text", fake_assemble)
    monkeypatch.setattr(tz, "extract_tz_requirements", fake_extract)
    return calls


async def extract(path: Path, **kwargs) -> dict:
    return await tz.extract_tz_from_file(
        path, analysis_id="a1", user_id="u1", **kwargs
    )


@pytest.mark.asyncio
async def test_numbered_docx_is_read_from_word_without_the_model(
    tmp_path, model_calls
) -> None:
    path = doc(*NUMBERED).save(tmp_path / "tz.docx")

    result = await extract(path, prefer_docx_structure=True)

    assert model_calls == []
    assert result["1"]["label"] == "1."
    assert result["1"]["children"]["1.2"]["number"] == "1.2"
    assert tz.count_requirements(result) == 3


@pytest.mark.asyncio
async def test_other_callers_keep_the_model_route(
    tmp_path, model_calls
) -> None:
    path = doc(*NUMBERED).save(tmp_path / "tz.docx")

    result = await extract(path)

    assert model_calls == ["text", "model"]
    assert result == FROM_MODEL


@pytest.mark.asyncio
async def test_switch_in_settings_turns_word_reading_off(
    tmp_path, model_calls, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(tz.config, "tz_docx_structure_enabled", False)
    path = doc(*NUMBERED).save(tmp_path / "tz.docx")

    result = await extract(path, prefer_docx_structure=True)

    assert model_calls == ["text", "model"]
    assert result == FROM_MODEL


@pytest.mark.asyncio
async def test_docx_without_numbering_goes_to_the_model(
    tmp_path, model_calls
) -> None:
    path = doc("Нужен насос", "Мощность не менее 5 кВт").save(
        tmp_path / "free.docx"
    )

    result = await extract(path, prefer_docx_structure=True)

    assert model_calls == ["text", "model"]
    assert result == FROM_MODEL


@pytest.mark.asyncio
async def test_pdf_goes_to_the_model(tmp_path, model_calls) -> None:
    path = tmp_path / "tz.pdf"
    path.write_bytes(b"%PDF-1.4")

    result = await extract(path, prefer_docx_structure=True)

    assert model_calls == ["text", "model"]
    assert result == FROM_MODEL


@pytest.mark.asyncio
async def test_unreadable_docx_goes_to_the_model(
    tmp_path, model_calls
) -> None:
    path = tmp_path / "broken.docx"
    path.write_bytes(b"not a zip")

    result = await extract(path, prefer_docx_structure=True)

    assert model_calls == ["text", "model"]
    assert result == FROM_MODEL


# ---- pages for «Источник ТЗ, стр X» -------------------------------------


def test_pages_of_a_word_hierarchy_come_from_its_points(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def no_text(path: Path) -> str:
        raise AssertionError("text map must not be built for a Word hierarchy")

    monkeypatch.setattr(tz, "_assemble_document_text", no_text)
    hierarchy = tz.normalize_tz_requirements(
        {
            "1": {
                "text": "Общие",
                "label": "1.",
                "number": "1",
                "page": 3,
                "children": {
                    "1.1": {
                        "text": "Пункт",
                        "label": "1.1.",
                        "number": "1.1",
                        "page": 4,
                    }
                },
            }
        }
    )

    assert tz._build_tz_page_map(hierarchy, Path("tz.docx")) == {
        "1": 3,
        "1.1": 4,
    }


def _word_hierarchy(*, with_pages: bool) -> dict:
    """Keys are positions: the clause the document numbers «1.2.» has key 1.1."""
    page = {"page": 3} if with_pages else {}
    return tz.normalize_tz_requirements(
        {
            "1": {
                "text": "Общие",
                "label": "1.",
                "number": "1",
                "children": {
                    "1.1": {
                        "text": "Гарантия не менее 24 месяцев:",
                        "label": "1.2.",
                        "number": "1.2",
                        **page,
                        "children": {
                            "1.1.1": {
                                "text": "на насос;",
                                "label": "1.2.1",
                                "number": "1.2.1",
                                **page,
                            }
                        },
                    }
                },
            }
        }
    )


def _fix_refs(hierarchy: dict, **fields) -> TZAnalysisItem:
    item = TZAnalysisItem(
        requirement="1.1.1. на насос;",
        explanation="x",
        status=TZAnalysisStatus.MET,
        **fields,
    )
    page_map = tz._build_tz_page_map(hierarchy, None)
    [fixed] = tz._ensure_item_refs([item], hierarchy, tz_page_map=page_map)
    return fixed


def test_source_reference_of_a_word_point_names_the_point_and_its_page() -> (
    None
):
    fixed = _fix_refs(_word_hierarchy(with_pages=True))

    # keys stay positions; the number of the document is put on at display
    assert fixed.ref == "1.1.1"
    assert fixed.ref_value == "Гарантия не менее 24 месяцев: на насос;"
    assert fixed.requirement_ref == "Источник ТЗ, стр 3, пункт 1.1.1"


def test_source_reference_has_no_page_when_the_file_has_none() -> None:
    fixed = _fix_refs(_word_hierarchy(with_pages=False))

    assert fixed.requirement_ref == "Источник ТЗ, пункт 1.1.1"


def test_what_the_model_stored_with_the_item_is_replaced_by_the_tz_text() -> (
    None
):
    # as the model really answers: it copies the numbered line it was given,
    # internal key included, into ref_value and joins the line above in its own way
    fixed = _fix_refs(
        _word_hierarchy(with_pages=True),
        ref="1.1.1",
        ref_value="Гарантия не менее 24 месяцев: 1.1.1. на насос;",
        offer_value="Гарантия на насос — 24 месяца",
    )

    assert fixed.ref_value == "Гарантия не менее 24 месяцев: на насос;"
    assert "1.1.1" not in fixed.ref_value


def test_the_offer_reference_does_not_borrow_the_position_from_the_tz() -> (
    None
):
    fixed = _fix_refs(
        _word_hierarchy(with_pages=True),
        offer_value="Гарантия на насос — 24 месяца",
    )
    assert fixed.offer_ref == "Источник КП"

    explicit = _fix_refs(
        _word_hierarchy(with_pages=True),
        offer_value="Гарантия на насос — 24 месяца",
        offer_ref="Источник КП, стр 1, пункт 4",
    )
    assert explicit.offer_ref == "Источник КП, стр 1, пункт 4"


def test_a_tz_found_by_the_model_keeps_its_references() -> None:
    legacy = tz.normalize_tz_requirements(
        {"1": {"text": "Общие", "children": {"1.1": {"text": "Гарантия"}}}}
    )
    item = TZAnalysisItem(
        requirement="1.1. Гарантия",
        explanation="x",
        status=TZAnalysisStatus.MET,
        offer_value="24 месяца",
    )
    [fixed] = tz._ensure_item_refs([item], legacy)

    assert fixed.requirement_ref == "Источник ТЗ, пункт 1"
    assert fixed.offer_ref == "Источник КП, пункт 1.1"


def test_pages_of_a_model_hierarchy_still_come_from_the_text(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "tz.pdf"
    path.write_bytes(b"%PDF-1.4")
    monkeypatch.setattr(
        tz,
        "_assemble_document_text",
        lambda _path: "--- Страница 2 ---\n1. Требование",
    )
    hierarchy = tz.normalize_tz_requirements(
        {"1": {"text": "Требование", "children": {}}}
    )

    assert tz._build_tz_page_map(hierarchy, path) == {"1": 2}
    assert tz._build_tz_page_map(hierarchy, None) is None
