"""Structure-first extraction of TZ points from Word documents."""

from __future__ import annotations

from pathlib import Path

from backend.services.tz_structure.docx_reader import DocxReadError, read_docx
from backend.services.tz_structure.model import ExtractionResult
from backend.services.tz_structure.outline import build_outline

__all__ = ["DocxReadError", "ExtractionResult", "extract_structure"]


def extract_structure(path: str | Path) -> ExtractionResult:
    """Read a .docx file and return its points with document numbering."""
    return build_outline(read_docx(path))
