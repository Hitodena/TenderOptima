from pathlib import Path

from backend.services.extraction.base import BaseExtractor
from backend.services.extraction.extractors.docx import DocxExtractor
from backend.services.extraction.extractors.image import ImageExtractor
from backend.services.extraction.extractors.pdf import PdfExtractor
from backend.services.extraction.extractors.txt import TxtExtractor
from backend.services.extraction.extractors.xlsx import XlsxExtractor


class UnsupportedFileTypeError(Exception):
    pass


class ExtractorRouter:
    _registry: dict[str, type[BaseExtractor]] = {
        ".txt": TxtExtractor,
        ".docx": DocxExtractor,
        ".pdf": PdfExtractor,
        ".xlsx": XlsxExtractor,
        ".jpg": ImageExtractor,
        ".jpeg": ImageExtractor,
        ".png": ImageExtractor,
    }

    @classmethod
    def get(cls, file_path: Path) -> BaseExtractor:
        ext = file_path.suffix.lower()
        cls = cls._registry.get(ext)
        if not cls:
            raise UnsupportedFileTypeError(f"Unsupported: {ext}")
        return cls()
