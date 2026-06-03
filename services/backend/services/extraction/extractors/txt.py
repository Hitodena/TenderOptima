from pathlib import Path

import chardet

from backend.services.extraction.base import BaseExtractor, ExtractedDocument


class TxtExtractor(BaseExtractor):
    @classmethod
    def extract(cls, file_path: Path) -> ExtractedDocument:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        raw = file_path.read_bytes()
        encoding = chardet.detect(raw).get("encoding") or "utf-8"
        text = raw.decode(encoding, errors="replace")
        if not text.strip():
            raise ValueError("File is empty")
        return ExtractedDocument(text=text)
