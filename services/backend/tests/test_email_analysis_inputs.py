"""What the email analysis of module 1 reads: body, quote, attachments, order.

Covers: HTML-only letters, the quote of earlier letters, every attachment
format suppliers send (and the «not read» notice), the order description
given to the model.
"""

import asyncio
import json
import zipfile
from email.message import EmailMessage
from pathlib import Path

import pytest
from PIL import Image

from backend.services.analysis import email as email_analysis
from backend.services.analysis import email_attachments as att
from backend.services.llm.prompts.email import build_email_prompt
from backend.utils.email_content import extract_letter_body, html_to_text

FIXTURES = Path(__file__).parent / "fixtures"

# ------------------------------------------------------------- letter body


def _mime(plain: str | None, html: str | None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = "Re: КП"
    if plain is not None:
        msg.set_content(plain)
        if html is not None:
            msg.add_alternative(html, subtype="html")
    elif html is not None:
        msg.set_content(html, subtype="html")
    return msg


def test_body_plain_preferred():
    msg = _mime("Цена 82 руб./м", "<p>Цена <b>82</b> руб./м</p>")
    assert extract_letter_body(msg) == "Цена 82 руб./м\n"


def test_body_html_only_multipart():
    msg = _mime(
        None,
        "<html><body><p>Цена 82 руб./м</p><p>Срок 10 дней</p></body></html>",
    )
    msg.add_attachment(
        b"%PDF", maintype="application", subtype="pdf", filename="kp.pdf"
    )
    body = extract_letter_body(msg)
    assert "Цена 82 руб./м" in body
    assert "Срок 10 дней" in body
    assert "<" not in body


def test_body_html_only_single_part():
    msg = _mime(None, "<div>Цена 82 руб./м</div>")
    assert extract_letter_body(msg) == "Цена 82 руб./м"


def test_attached_txt_is_not_the_body():
    msg = _mime(None, "<p>КП во вложении</p>")
    msg.add_attachment("Прайс 2024 года", filename="old.txt")
    assert extract_letter_body(msg) == "КП во вложении"


def test_body_unknown_charset_still_read():
    msg = EmailMessage()
    msg.set_payload("Цена 82".encode())
    msg["Content-Type"] = 'text/plain; charset="x-unknown-8"'
    msg["Content-Transfer-Encoding"] = "8bit"
    assert "Цена 82" in extract_letter_body(msg)


def test_body_empty_letter():
    msg = EmailMessage()
    msg.add_attachment(
        b"%PDF", maintype="application", subtype="pdf", filename="kp.pdf"
    )
    assert extract_letter_body(msg) == ""


def test_html_table_becomes_markdown():
    html = (
        "<table><tr><th>Наименование</th><th>Кол-во</th><th>Цена, руб.</th></tr>"
        "<tr><td>Кабель 3х2,5</td><td>12000</td><td>82,36</td></tr></table>"
    )
    text = html_to_text(html)
    assert "| Наименование | Кол-во | Цена, руб. |" in text
    assert "| Кабель 3х2,5 | 12000 | 82,36 |" in text
    assert "| --- |" in text


def test_html_layout_table_stays_text():
    html = "<table><tr><td><p>Добрый день!</p><p>Цена 82 руб.</p></td></tr></table>"
    text = html_to_text(html)
    assert "|" not in text
    assert "Добрый день!" in text and "Цена 82 руб." in text


def test_html_scripts_and_styles_dropped():
    html = "<style>p{color:red}</style><script>alert(1)</script><p>Цена 82</p>"
    assert html_to_text(html) == "Цена 82"


def test_html_br_lines():
    assert html_to_text("Цена 82<br>Срок 10 дней") == "Цена 82\nСрок 10 дней"


# ------------------------------------------------------------ attachments


@pytest.fixture
def tmp(tmp_path):
    return tmp_path


def _read(path: Path) -> att.AttachmentText:
    items = att.read_attachments([path])
    assert len(items) == 1
    return items[0]


def test_xls_old_excel():
    item = _read(FIXTURES / "kp_sample.xls")
    assert item.text is not None
    assert "| Кабель ВВГнг 3х2,5 | м | 12000 | 82.36 | 988320 |" in item.text


def test_csv_semicolon_cp1251(tmp):
    path = tmp / "price.csv"
    path.write_bytes(
        "Наименование;Цена\nКабель 3х2,5;82,36\n".encode("cp1251")
    )
    item = _read(path)
    assert "| Кабель 3х2,5 | 82,36 |" in item.text


def test_csv_comma_utf8(tmp):
    path = tmp / "price.csv"
    path.write_text("name,price\ncable,82.36\n", encoding="utf-8")
    assert "| cable | 82.36 |" in _read(path).text


def _odf(path: Path, body: str) -> None:
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<office:document-content "
        'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
        'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
        'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">'
        f"<office:body>{body}</office:body></office:document-content>"
    )
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("content.xml", content)


def test_ods_table(tmp):
    path = tmp / "kp.ods"
    _odf(
        path,
        '<office:spreadsheet><table:table table:name="КП">'
        "<table:table-row><table:table-cell><text:p>Товар</text:p></table:table-cell>"
        "<table:table-cell><text:p>Цена</text:p></table:table-cell></table:table-row>"
        "<table:table-row><table:table-cell><text:p>Кабель</text:p></table:table-cell>"
        "<table:table-cell><text:p>82,36</text:p></table:table-cell></table:table-row>"
        "</table:table></office:spreadsheet>",
    )
    text = _read(path).text
    assert "| Кабель | 82,36 |" in text
    assert text.count("Кабель") == 1  # the cell paragraph is not repeated


def test_html_attachment(tmp):
    path = tmp / "kp.html"
    path.write_text("<p>Цена 82 руб./м</p>", encoding="utf-8")
    assert _read(path).text == "Цена 82 руб./м"


def test_rtf_without_libreoffice(tmp, monkeypatch):
    monkeypatch.setattr(att, "find_soffice_executable", lambda: None)
    path = tmp / "kp.rtf"
    # «Цена 82» in cp1251 escapes, as Word writes Russian RTF
    path.write_bytes(rb"{\rtf1\ansi\ansicpg1251 \'d6\'e5\'ed\'e0 82\par}")
    assert _read(path).text == "Цена 82"


def test_doc_without_libreoffice_reported(tmp, monkeypatch):
    monkeypatch.setattr(att, "find_soffice_executable", lambda: None)
    path = tmp / "kp.doc"
    path.write_bytes(b"\xd0\xcf\x11\xe0")
    item = _read(path)
    assert item.text is None
    assert "LibreOffice" in item.reason


def test_multipage_tiff_ocr(tmp, monkeypatch):
    pages = iter(["Страница 1: цена 82", "Страница 2: срок 10 дней"])
    monkeypatch.setattr(att, "recognize", lambda image: next(pages))
    path = tmp / "scan.tif"
    first = Image.new("RGB", (20, 20), "white")
    first.save(
        path,
        save_all=True,
        append_images=[Image.new("RGB", (20, 20), "white")],
    )
    text = _read(path).text
    assert "цена 82" in text and "срок 10 дней" in text


def test_scan_without_ocr_reported(tmp, monkeypatch):
    def no_ocr(image):
        raise att.OcrNotAvailableError("no tesseract")

    monkeypatch.setattr(att, "recognize", no_ocr)
    path = tmp / "scan.bmp"
    Image.new("RGB", (10, 10), "white").save(path)
    item = _read(path)
    assert item.text is None and "распознавание" in item.reason


def test_unsupported_formats_reported(tmp):
    for name, words in [
        ("kp.rar", "RAR"),
        ("kp.7z", "7z"),
        ("kp.xyz", ".xyz"),
    ]:
        path = tmp / name
        path.write_bytes(b"data")
        item = _read(path)
        assert item.text is None
        assert words in item.reason


def test_broken_file_reported(tmp):
    path = tmp / "kp.xlsx"
    path.write_bytes(b"not a zip")
    item = _read(path)
    assert item.text is None and "повреждён" in item.reason


def test_empty_text_reported(tmp):
    path = tmp / "empty.txt"
    path.write_text("   ", encoding="utf-8")
    item = _read(path)
    assert item.text is None and "не найден текст" in item.reason


def test_missing_file_reported(tmp):
    item = _read(tmp / ("a" * 32 + "_КП.pdf"))
    assert item.text is None
    assert item.name == "КП.pdf"  # the stored prefix is not shown


class _Cp866Info(zipfile.ZipInfo):
    """What Windows archivers write: cp866 names without the UTF-8 flag."""

    def _encodeFilenameFlags(self):  # noqa: N802
        return self.filename.encode("cp866"), self.flag_bits & ~0x800


def _zip(
    path: Path, members: dict[str, bytes], *, cp866: bool = False
) -> None:
    with zipfile.ZipFile(path, "w") as zf:
        for name, data in members.items():
            info = _Cp866Info(name) if cp866 else zipfile.ZipInfo(name)
            zf.writestr(info, data)


def test_zip_reads_members(tmp):
    path = tmp / "docs.zip"
    _zip(
        path,
        {
            "price.csv": "Товар;Цена\nКабель;82\n".encode("cp1251"),
            "readme.rar": b"x",
        },
    )
    items = att.read_attachments([path])
    assert items[0].name == "docs.zip / price.csv"
    assert "| Кабель | 82 |" in items[0].text
    assert items[1].text is None and "RAR" in items[1].reason


def test_zip_cp866_names(tmp):
    path = tmp / "docs.zip"
    _zip(path, {"КП.csv": b"a;b\n1;2\n"}, cp866=True)
    assert att.read_attachments([path])[0].name == "docs.zip / КП.csv"


def test_zip_limits(tmp, monkeypatch):
    monkeypatch.setattr(att, "MAX_ZIP_MEMBERS", 2)
    path = tmp / "many.zip"
    _zip(
        path,
        {f"f{i}.csv": b"a;b\n1;2\n" for i in range(4)} | {"inner.zip": b"PK"},
    )
    items = att.read_attachments([path])
    assert len(items) == 3
    assert "слишком много" in items[-1].reason


def test_zip_nested_not_read(tmp):
    path = tmp / "outer.zip"
    _zip(path, {"inner.zip": b"PK"})
    item = att.read_attachments([path])[0]
    assert item.text is None and "внутри архива" in item.reason


def test_zip_broken(tmp):
    path = tmp / "bad.zip"
    path.write_bytes(b"not a zip")
    item = att.read_attachments([path])[0]
    assert item.text is None and "повреждён" in item.reason


# ------------------------------------------------------------ the analysis


class _FakeLLM:
    def __init__(self, matches):
        self.matches = matches
        self.system = ""
        self.user = ""

    async def complete(self, system, user, model=None):
        self.system, self.user = system, user
        return {"parameters": {}, "matches": self.matches}


def _run(monkeypatch, body, paths=None, context=None, matches=None):
    fake = _FakeLLM(
        matches
        or [
            {
                "requirement": "Цена за единицу без НДС",
                "offer_value": "82,36 руб./м",
                "numeric_value": 82.36,
                "status": "met",
            }
        ]
    )
    monkeypatch.setattr(email_analysis, "llm_client", fake)
    result = asyncio.run(
        email_analysis.analyze_email(
            user_requirements="- Цена за единицу без НДС",
            email_body=body,
            attachment_paths=paths,
            request_context=context,
        )
    )
    return fake, result


def test_order_context_in_prompt(monkeypatch):
    fake, _ = _run(
        monkeypatch,
        "Цена 82,36 руб./м",
        context="Кабель ВВГнг(А)-LS 3×2,5 — 12 000 м",
    )
    assert "Кабель ВВГнг(А)-LS 3×2,5 — 12 000 м" in fake.system
    assert "НЕ ответ поставщика" in fake.system


def test_no_order_block_without_context():
    system, _ = build_email_prompt("- Цена", "текст")
    assert "Что заказчик запросил" not in system


def test_quote_marked_as_context(monkeypatch):
    body = (
        "Добрый день! Цена 82,36 руб./м.\n\n"
        "От: Отдел закупок <buy@example.com>\n"
        "Отправлено: 3 ноября 2026 г. 10:05\n"
        "Кому: sales@example.com\n"
        "Тема: Запрос КП\n\n"
        "Просим КП на 12 000 м. Прошлая цена была 70 руб."
    )
    fake, _ = _run(monkeypatch, body)
    new_part, quote = fake.user.split(email_analysis.QUOTE_MARKER)
    assert "82,36" in new_part and "70 руб." not in new_part
    assert "70 руб." in quote


def test_quote_table_not_used_by_price_check(monkeypatch):
    # an old offer quoted below has its own table: it must not fix the price
    body = (
        "Новая цена 82,36 руб./м.\n\n"
        "-----Original Message-----\n"
        "| Наименование | Кол-во | Цена, руб. | Сумма, руб. |\n"
        "|---|---|---|---|\n"
        "| Кабель | 12000 | 70,00 | 840000,00 |\n"
    )
    _, result = _run(monkeypatch, body)
    assert result.matches[0].numeric_value == 82.36


def test_unread_files_reported(monkeypatch, tmp):
    bad = tmp / "kp.rar"
    bad.write_bytes(b"x")
    good = tmp / "kp.csv"
    good.write_text("Товар;Цена\nКабель;82,36\n", encoding="utf-8")
    fake, result = _run(monkeypatch, "КП во вложении", paths=[bad, good])
    assert result.unread_files == [
        "kp.rar — архив RAR не поддерживается — попросите ZIP или файлы отдельно"
    ]
    assert "[Вложение: kp.csv]" in fake.user
    assert json.loads(result.model_dump_json())["unread_files"]
