from pathlib import Path

from PIL import Image

from backend.services.extraction.base import BaseExtractor, ExtractedDocument
from backend.utils.ocr import recognize


class ImageExtractor(BaseExtractor):
    @classmethod
    def extract(cls, file_path: Path) -> ExtractedDocument:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        image = Image.open(file_path)
        return ExtractedDocument(text=recognize(image))
