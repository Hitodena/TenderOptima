"""Count document pages for subscription quota enforcement."""

import shutil
from pathlib import Path

import fitz
from loguru import logger

from backend.services.extraction.docx_to_pdf import convert_docx_to_pdf
from backend.services.extraction.router import ExtractorRouter

_IMAGE_EXT = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
}
_TEXT_EXT = {".txt", ".csv", ".md"}
_XLSX_EXT = {".xlsx", ".xls"}


def _count_pdf_pages(path: Path) -> int:
    doc = fitz.open(str(path))
    try:
        return max(doc.page_count, 1)
    finally:
        doc.close()


def count_pages_in_file(file_path: Path) -> int:
    """Return page count for a file; non-paginated formats count as 1 page."""
    if not file_path.is_file():
        return 0
    suffix = file_path.suffix.lower()
    try:
        if suffix == ".pdf":
            return _count_pdf_pages(file_path)
        if suffix == ".docx":
            pdf_path = convert_docx_to_pdf(file_path)
            if pdf_path is not None:
                try:
                    return _count_pdf_pages(pdf_path)
                finally:
                    shutil.rmtree(pdf_path.parent, ignore_errors=True)
            extracted = ExtractorRouter.extract(file_path)
            marker_count = extracted.text.count("--- Страница ")
            return marker_count if marker_count > 0 else 1
        if suffix in _IMAGE_EXT or suffix in _TEXT_EXT or suffix in _XLSX_EXT:
            return 1
        ExtractorRouter.extract(file_path)
        return 1
    except Exception as exc:
        logger.warning(
            "Page count fallback to 1",
            path=str(file_path),
            error=str(exc),
        )
        return 1


def count_pages_in_files(paths: list[Path]) -> int:
    """Sum page counts across multiple files."""
    return sum(count_pages_in_file(path) for path in paths)
