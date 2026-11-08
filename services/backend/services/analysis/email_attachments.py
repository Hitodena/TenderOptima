"""Text of the files suppliers attach to their letters (module 1 only).

Covers what suppliers really send: PDF / DOCX / XLSX / pictures (the shared
extractors), plus old Office files (.xls, .doc), .rtf, OpenDocument (.odt,
.ods), .csv, .html, multi-page scans (.tif) and .zip archives of those.
A file that cannot be read is reported by name, so the letter can say
«файл не прочитан — проверьте вручную» instead of a silent «не упомянуто».

Module 2 (TZ ↔ KP) keeps using ``ExtractorRouter`` directly and is not
affected by anything here.
"""

from __future__ import annotations

import csv
import io
import os
import shutil
import subprocess
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

from loguru import logger
from PIL import Image, ImageSequence

from backend.services.extraction.assembler import TextAssembler
from backend.services.extraction.docx_to_pdf import find_soffice_executable
from backend.services.extraction.extractors.docx import DocxExtractor
from backend.services.extraction.router import (
    ExtractorRouter,
    UnsupportedFileTypeError,
)
from backend.utils.email_content import html_to_text
from backend.utils.ocr import OcrNotAvailableError, recognize

_router = ExtractorRouter()
_assembler = TextAssembler()

MAX_ZIP_MEMBERS = 20
MAX_ZIP_TOTAL_BYTES = 50 * 1024 * 1024
MAX_ZIP_MEMBER_BYTES = 20 * 1024 * 1024
MAX_SHEET_ROWS = 2000
MAX_TIFF_PAGES = 20


@dataclass(frozen=True)
class AttachmentText:
    name: str  # as the supplier named it (zip members: «архив.zip / файл»)
    text: str | None
    reason: str | None = None  # why there is no text


def display_name(path: Path) -> str:
    """Stored files are «<32 hex>_name»: show the supplier's name."""
    name = path.name
    if "_" in name:
        prefix, rest = name.split("_", 1)
        if len(prefix) == 32 and all(
            c in "0123456789abcdefABCDEF" for c in prefix
        ):
            return rest
    return name


# ------------------------------------------------------------- formats


def _markdown(rows: list[list[str]], title: str | None = None) -> str:
    rows = [r for r in rows if any(c.strip() for c in r)][:MAX_SHEET_ROWS]
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    lines = []
    if title:
        lines.append(f"### {title}")
    for i, r in enumerate(rows):
        cells = [c.replace("|", "/").replace("\n", " ").strip() for c in r]
        cells += [""] * (width - len(cells))
        lines.append("| " + " | ".join(cells) + " |")
        if i == 0:
            lines.append("|" + " --- |" * width)
    return "\n".join(lines)


def _cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _read_xls(path: Path) -> str:
    import xlrd

    book = xlrd.open_workbook(str(path))
    parts = []
    for sheet in book.sheets():
        rows = [
            [_cell_text(sheet.cell_value(r, c)) for c in range(sheet.ncols)]
            for r in range(min(sheet.nrows, MAX_SHEET_ROWS))
        ]
        md = _markdown(rows, sheet.name)
        if md:
            parts.append(md)
    return "\n\n".join(parts)


_ODF_TABLE = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
_ODF_TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def _odf_text(node: ElementTree.Element) -> str:
    return " ".join("".join(node.itertext()).split())


def _read_odf(path: Path) -> str:
    """.odt / .ods: paragraphs and tables from content.xml."""
    with zipfile.ZipFile(path) as zf:
        root = ElementTree.fromstring(zf.read("content.xml"))
    parts: list[str] = []
    body = root.find(
        ".//{urn:oasis:names:tc:opendocument:xmlns:office:1.0}body"
    )
    if body is None:
        return ""

    def walk(node: ElementTree.Element) -> None:
        if node.tag == f"{_ODF_TABLE}table":
            rows = []
            for row in node.iter(f"{_ODF_TABLE}table-row"):
                cells = []
                for cell in row.findall(f"{_ODF_TABLE}table-cell"):
                    repeat = int(
                        cell.get(f"{_ODF_TABLE}number-columns-repeated", "1")
                    )
                    value = _odf_text(cell)
                    cells.extend([value] * min(repeat, 50 if value else 1))
                rows.append(cells)
            md = _markdown(rows, node.get(f"{_ODF_TABLE}name"))
            if md:
                parts.append(md)
            return  # the cells' paragraphs are in the table already
        if node.tag in {f"{_ODF_TEXT}p", f"{_ODF_TEXT}h"}:
            text = _odf_text(node)
            if text:
                parts.append(text)
            return
        for child in node:
            walk(child)

    walk(body)
    return "\n".join(parts)


def _decode(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1251"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    import chardet

    guess = chardet.detect(data).get("encoding") or "utf-8"
    return data.decode(guess, errors="replace")


def _read_csv(path: Path) -> str:
    text = _decode(path.read_bytes())
    try:
        delimiter = (
            csv.Sniffer().sniff(text[:4096], delimiters=";,\t").delimiter
        )
    except csv.Error:
        delimiter = ";" if text.count(";") > text.count(",") else ","
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    return _markdown(rows)


def _read_xlsx(path: Path) -> str:
    """XLSX; formulas saved without their computed value are computed here.

    Excel keeps the last result of each formula. Files written by other
    programs often keep only «=D2*E2», and the price column would read as
    empty. Simple arithmetic and SUM/ROUND are computed
    (``utils.xlsx_formula``); anything else stays empty, never guessed.
    """
    import openpyxl

    from backend.services.extraction.extractors.xlsx import XlsxExtractor
    from backend.utils.xlsx_formula import evaluate_sheet

    values_wb = openpyxl.load_workbook(path, data_only=True)
    formulas_wb = openpyxl.load_workbook(path, data_only=False)
    missing = False
    for sheet in formulas_wb.worksheets:
        cached = values_wb[sheet.title]
        for row in sheet.iter_rows():
            for cell in row:
                if (
                    cell.data_type == "f"
                    and cached[cell.coordinate].value is None
                ):
                    missing = True
                    break
            if missing:
                break
        if missing:
            break
    if not missing:  # the usual Excel file: the shared reader as before
        return _assembler.assemble(_router.get(path).extract(path))

    tables: list[str] = []
    for sheet in formulas_wb.worksheets:
        cached = values_wb[sheet.title]
        formulas: dict[tuple[int, int], str] = {}
        plain: dict[tuple[int, int], object] = {}
        for row in sheet.iter_rows():
            for cell in row:
                key = (cell.row, cell.column)
                if cell.data_type == "f" and isinstance(cell.value, str):
                    if cached[cell.coordinate].value is None:
                        formulas[key] = cell.value
                    else:
                        plain[key] = cached[cell.coordinate].value
                else:
                    plain[key] = cell.value
        computed = evaluate_sheet(formulas, plain)
        for (r, c), value in computed.items():
            cached.cell(r, c).value = (
                int(value) if float(value).is_integer() else round(value, 4)
            )
        resolved = XlsxExtractor._resolve_merged_cells(cached)
        rows = list(cached.iter_rows(values_only=False))
        if not rows:
            continue
        md = XlsxExtractor._sheet_to_markdown(
            cached.title, resolved, len(rows[0])
        )
        if md:
            tables.append(md)
    return "\n\n".join(tables)


def _read_txt(path: Path) -> str:
    # utf-8, else the Windows Cyrillic code page: short Russian texts fool
    # charset guessing
    return _decode(path.read_bytes())


def _read_html(path: Path) -> str:
    return html_to_text(_decode(path.read_bytes()))


def _read_rtf(path: Path) -> str:
    converted = _soffice_to_docx(path)
    if converted is not None:
        return converted
    from striprtf.striprtf import rtf_to_text

    raw = path.read_bytes().decode("latin-1")
    return rtf_to_text(raw, encoding="cp1251", errors="replace")


def _read_via_soffice(path: Path) -> str:
    text = _soffice_to_docx(path)
    if text is None:
        raise _UnreadableError("нужен LibreOffice для этого формата")
    return text


def _soffice_to_docx(path: Path) -> str | None:
    """.doc / .rtf / .odt → .docx with LibreOffice, then the DOCX reader."""
    soffice = find_soffice_executable()
    if not soffice:
        return None
    with tempfile.TemporaryDirectory(prefix="att2docx_") as tmp:
        work = Path(tmp).resolve()
        profile = work / "lo_profile"
        profile.mkdir()
        source = work / f"source{path.suffix.lower()}"
        shutil.copy2(path, source)
        command = [
            soffice,
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless",
            "--norestore",
            "--nologo",
            "--convert-to",
            "docx:MS Word 2007 XML",
            "--outdir",
            str(work),
            str(source),
        ]
        env = {**os.environ, "HOME": str(work), "TMPDIR": str(work)}
        try:
            subprocess.run(
                command,
                capture_output=True,
                timeout=120,
                check=False,
                env=env,
                cwd=str(work),
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            logger.warning(
                "Attachment conversion failed", path=str(path), error=str(exc)
            )
            return None
        docx = work / "source.docx"
        if not docx.is_file():
            return None
        return _assembler.assemble(DocxExtractor.extract(docx)).strip()


def _read_image(path: Path) -> str:
    """Pictures and multi-page TIFF scans, page by page."""
    texts = []
    with Image.open(path) as image:
        for i, frame in enumerate(ImageSequence.Iterator(image)):
            if i >= MAX_TIFF_PAGES:
                break
            text = recognize(frame.convert("RGB"))
            if text:
                texts.append(text)
    return "\n\n".join(texts)


class _UnreadableError(Exception):
    """A file of a known type that still gave no text."""


_OWN_READERS = {
    ".xls": _read_xls,
    ".xlsx": _read_xlsx,
    ".ods": _read_odf,
    ".odt": _read_via_soffice,
    ".doc": _read_via_soffice,
    ".rtf": _read_rtf,
    ".csv": _read_csv,
    ".txt": _read_txt,
    ".html": _read_html,
    ".htm": _read_html,
    ".tif": _read_image,
    ".tiff": _read_image,
    ".bmp": _read_image,
    ".gif": _read_image,
}

_NOT_SUPPORTED_REASON = {
    ".rar": "архив RAR не поддерживается — попросите ZIP или файлы отдельно",
    ".7z": "архив 7z не поддерживается — попросите ZIP или файлы отдельно",
    ".eml": "вложенное письмо не читается",
    ".msg": "вложенное письмо Outlook не читается",
}


def _read_one(path: Path, name: str) -> AttachmentText:
    suffix = path.suffix.lower()
    try:
        if suffix in _OWN_READERS:
            text = _OWN_READERS[suffix](path)
        else:
            text = _assembler.assemble(_router.get(path).extract(path))
    except UnsupportedFileTypeError:
        reason = _NOT_SUPPORTED_REASON.get(
            suffix, f"формат {suffix or 'без расширения'} не поддерживается"
        )
        return AttachmentText(name, None, reason)
    except OcrNotAvailableError:
        return AttachmentText(
            name, None, "скан: распознавание текста недоступно"
        )
    except _UnreadableError as exc:
        return AttachmentText(name, None, str(exc))
    except Exception as exc:  # broken or password-protected file
        logger.warning(
            "Email attachment extraction failed",
            path=str(path),
            error=str(exc),
        )
        return AttachmentText(name, None, "файл повреждён или защищён паролем")
    text = (text or "").strip()
    if not text:
        return AttachmentText(name, None, "в файле не найден текст")
    return AttachmentText(name, text)


def _zip_member_name(info: zipfile.ZipInfo) -> str:
    """Windows archivers write Russian names in cp866 without the UTF-8 flag."""
    if info.flag_bits & 0x800:
        return info.filename
    try:
        return info.filename.encode("cp437").decode("cp866")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return info.filename


def _read_zip(path: Path, name: str) -> list[AttachmentText]:
    out: list[AttachmentText] = []
    try:
        zf = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        return [AttachmentText(name, None, "архив повреждён")]
    with zf, tempfile.TemporaryDirectory(prefix="attzip_") as tmp:
        members = [i for i in zf.infolist() if not i.is_dir()]
        total = 0
        for i, info in enumerate(members):
            member = _zip_member_name(info)
            shown = f"{name} / {member}"
            if i >= MAX_ZIP_MEMBERS:
                out.append(
                    AttachmentText(
                        shown, None, "в архиве слишком много файлов"
                    )
                )
                break
            if info.flag_bits & 0x1:
                out.append(
                    AttachmentText(
                        shown, None, "файл в архиве защищён паролем"
                    )
                )
                continue
            total += info.file_size
            if (
                info.file_size > MAX_ZIP_MEMBER_BYTES
                or total > MAX_ZIP_TOTAL_BYTES
            ):
                out.append(
                    AttachmentText(
                        shown, None, "файл в архиве слишком большой"
                    )
                )
                continue
            suffix = Path(member).suffix.lower()
            if suffix == ".zip":
                out.append(
                    AttachmentText(
                        shown, None, "архив внутри архива не читается"
                    )
                )
                continue
            target = Path(tmp) / f"m{i}{suffix}"
            with zf.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst, length=1024 * 1024)
            out.append(_read_one(target, shown))
    return out


def read_attachments(paths: list[Path]) -> list[AttachmentText]:
    """Text of every attached file; unreadable ones come back with a reason."""
    out: list[AttachmentText] = []
    for path in paths:
        name = display_name(path)
        if not path.is_file():
            out.append(
                AttachmentText(name, None, "файл не сохранился на сервере")
            )
            continue
        if path.suffix.lower() == ".zip":
            out.extend(_read_zip(path, name))
        else:
            out.append(_read_one(path, name))
    return out
