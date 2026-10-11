"""Word specifics: tracked changes, hidden text, frames, pages, failures."""

from __future__ import annotations

import time
import zipfile

import pytest

from backend.services.tz_structure import DocxReadError, extract_structure
from backend.tests.tz_structure.docx_builder import (
    DocxBuilder,
    paragraph_xml,
    text_runs,
)
from backend.tests.tz_structure.test_outline import codes, run, shape

_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006"
_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
_V = "urn:schemas-microsoft-com:vml"


def test_tracked_changes_give_the_final_text(tmp_path) -> None:
    runs = (
        text_runs("1. Мощность не менее ")
        + '<w:del w:id="1" w:author="a"><w:r><w:delText>5</w:delText>'
        "</w:r></w:del>"
        + f'<w:ins w:id="2" w:author="a">{text_runs("7")}</w:ins>'
        + text_runs(" кВт.")
    )
    builder = DocxBuilder(pages=1).p(runs=runs)
    result = run(builder, tmp_path)
    assert shape(result) == ["1. | Мощность не менее 7 кВт."]
    assert "tracked_changes" in codes(result)


def test_deleted_paragraph_mark_joins_paragraphs(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Гарантийный срок ", mark='<w:del w:id="1" w:author="a"/>')
    builder.p("не менее 24 месяцев.")
    builder.p("2. Срок поставки.")
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Гарантийный срок не менее 24 месяцев.",
        "2. | Срок поставки.",
    ]


def test_hidden_text_is_dropped(tmp_path) -> None:
    runs = (
        text_runs("1. Видимый текст.")
        + "<w:r><w:rPr><w:vanish/></w:rPr><w:t> Скрытая пометка.</w:t></w:r>"
    )
    result = run(DocxBuilder(pages=1).p(runs=runs), tmp_path)
    assert shape(result) == ["1. | Видимый текст."]
    assert "hidden_text" in codes(result, "info")


def test_text_frame_is_read_once(tmp_path) -> None:
    box = (
        "<w:txbxContent>"
        + paragraph_xml("Текст в рамке.")
        + "</w:txbxContent>"
    )
    runs = (
        f'<w:r><mc:AlternateContent xmlns:mc="{_MC}">'
        f'<mc:Choice Requires="wps"><w:drawing>{box}</w:drawing></mc:Choice>'
        f"<mc:Fallback><w:pict>{box}</w:pict></mc:Fallback>"
        "</mc:AlternateContent></w:r>" + text_runs("Основной абзац.")
    )
    result = run(DocxBuilder(pages=1).p(runs=runs), tmp_path)
    assert shape(result) == ["· | Основной абзац.", "· | Текст в рамке."]
    assert "textboxes" in codes(result, "info")


def test_images_are_reported(tmp_path) -> None:
    picture = f'<w:r><w:drawing><a:blip xmlns:a="{_A}"/></w:drawing></w:r>'
    old_picture = f'<w:r><w:pict><v:imagedata xmlns:v="{_V}"/></w:pict></w:r>'
    builder = DocxBuilder(pages=1)
    builder.p("1. Схема приведена ниже.")
    builder.p(runs=picture)
    builder.p(runs=old_picture)
    builder.p(runs="<w:r><w:object/></w:r>")
    result = run(builder, tmp_path)
    assert shape(result) == ["1. | Схема приведена ниже."]
    assert codes(result) == ["images", "embedded_objects"]
    assert "изображения: 2" in result.issues[0].message


def test_hyperlinks_fields_and_content_controls(tmp_path) -> None:
    field = (
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>'
        "<w:r><w:instrText> REF _Ref1 \\h </w:instrText></w:r>"
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        + text_runs("п. 4.2")
        + '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    )
    runs = (
        text_runs("1. Согласно ")
        + field
        + text_runs(" и ")
        + f"<w:hyperlink>{text_runs('ГОСТ 12.2.003')}</w:hyperlink>"
        + f"<w:sdt><w:sdtContent>{text_runs(' оборудование')}</w:sdtContent>"
        "</w:sdt>" + text_runs(" безопасно.")
    )
    builder = DocxBuilder(pages=1).p(runs=runs)
    builder.raw(
        "<w:sdt><w:sdtContent>"
        + paragraph_xml("2. Пункт в элементе управления.")
        + "</w:sdtContent></w:sdt>"
    )
    result = run(builder, tmp_path)
    assert shape(result) == [
        "1. | Согласно п. 4.2 и ГОСТ 12.2.003 оборудование безопасно.",
        "2. | Пункт в элементе управления.",
    ]


def test_table_of_contents_is_skipped(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("1. Общие требования\t3", style="TOC1")
    builder.p("2. Гарантия\t5", style="TOC1")
    builder.p("1. Общие требования")
    builder.p("2. Гарантия")
    result = run(builder, tmp_path)
    assert shape(result) == ["1. | Общие требования", "2. | Гарантия"]
    assert result.stats["toc_paragraphs_skipped"] == 2


def test_line_break_inside_paragraph_is_kept(tmp_path) -> None:
    result = run(
        DocxBuilder(pages=1).p("1. Адрес поставки:\nг. Минск, ул. Примерная"),
        tmp_path,
    )
    assert result.nodes[0].text == "Адрес поставки:\nг. Минск, ул. Примерная"


def test_page_numbers_from_word_layout(tmp_path) -> None:
    page_break = "<w:r><w:lastRenderedPageBreak/></w:r>"
    builder = DocxBuilder()
    builder.p("1. На первой странице.")
    builder.p(runs=page_break + text_runs("2. На второй странице."))
    builder.p(
        runs=text_runs("3. Начало на второй, ")
        + page_break
        + text_runs("конец на третьей.")
    )
    builder.p("4. На третьей странице.")
    result = run(builder, tmp_path)
    assert [node.page for node in result.nodes] == [1, 2, 2, 3]
    assert result.stats["pages"] == 3
    assert "pages_unknown" not in codes(result, "info")


def test_single_page_document_knows_its_page(tmp_path) -> None:
    result = run(DocxBuilder(pages=1).p("1. Единственный пункт."), tmp_path)
    assert result.nodes[0].page == 1


def test_pages_unknown_without_layout_marks(tmp_path) -> None:
    result = run(DocxBuilder().p("1. Пункт."), tmp_path)
    assert result.nodes[0].page is None
    assert "pages_unknown" in codes(result, "info")


def test_broken_list_reference_is_reported(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    builder.p("Абзац со ссылкой на несуществующий список", num=(99, 0))
    result = run(builder, tmp_path)
    assert shape(result) == ["· | Абзац со ссылкой на несуществующий список"]
    assert "broken_numbering" in codes(result)


# ---- files that cannot be read --------------------------------------


def _error(path) -> str:
    with pytest.raises(DocxReadError) as caught:
        extract_structure(path)
    return caught.value.code


def test_missing_file(tmp_path) -> None:
    assert _error(tmp_path / "нет.docx") == "not_found"


def test_not_a_word_file(tmp_path) -> None:
    path = tmp_path / "text.docx"
    path.write_text("просто текст", encoding="utf-8")
    assert _error(path) == "not_word"


def test_zip_without_document(tmp_path) -> None:
    path = tmp_path / "archive.docx"
    with zipfile.ZipFile(path, "w") as package:
        package.writestr("readme.txt", "не документ")
    assert _error(path) == "not_word"


def test_old_doc_format(tmp_path) -> None:
    path = tmp_path / "old.doc"
    path.write_bytes(
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        + b"\x00" * 64
        + "WordDocument".encode("utf-16-le")
    )
    assert _error(path) == "legacy_doc"


def test_password_protected_file(tmp_path) -> None:
    path = tmp_path / "secret.docx"
    path.write_bytes(
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
        + b"\x00" * 64
        + "EncryptedPackage".encode("utf-16-le")
    )
    assert _error(path) == "encrypted"


def test_corrupt_xml(tmp_path) -> None:
    path = DocxBuilder().p("1. Пункт").save(tmp_path / "ok.docx")
    broken = tmp_path / "broken.docx"
    with zipfile.ZipFile(path) as source, zipfile.ZipFile(broken, "w") as out:
        for name in source.namelist():
            data = source.read(name)
            if name == "word/document.xml":
                data = data[: len(data) // 2]
            out.writestr(name, data)
    assert _error(broken) == "corrupt"


def test_large_document_is_fast(tmp_path) -> None:
    builder = DocxBuilder(pages=1)
    for section in range(1, 51):
        builder.p(f"{section}. Раздел {section}")
        for point in range(1, 101):
            builder.p(f"{section}.{point}. Требование номер {point}.")
    path = builder.save(tmp_path / "big.docx")
    started = time.perf_counter()
    result = extract_structure(path)
    elapsed = time.perf_counter() - started
    assert result.stats["numbered_points"] == 50 * 101
    assert codes(result) == []
    assert elapsed < 20
