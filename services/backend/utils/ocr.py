from pathlib import Path

import pytesseract
from PIL import Image
from pytesseract import TesseractNotFoundError


class OcrNotAvailableError(RuntimeError):
    """Raised when the tesseract binary is missing from PATH."""


def recognize(image: Image.Image) -> str:
    try:
        return pytesseract.image_to_string(image, lang="rus+eng").strip()
    except TesseractNotFoundError as exc:
        raise OcrNotAvailableError(
            "Tesseract OCR is not installed (required for scanned PDFs and images)"
        ) from exc


def recognize_file(path: Path) -> str:
    return recognize(Image.open(path))
