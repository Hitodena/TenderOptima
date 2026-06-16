from io import BytesIO
from pathlib import Path

import fitz
import pdfplumber
from PIL import Image

from backend.services.extraction.base import BaseExtractor, ExtractedDocument
from backend.utils.ocr import recognize


class PdfExtractor(BaseExtractor):
    @classmethod
    def extract(cls, file_path: Path) -> ExtractedDocument:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        text_parts: list[str] = []
        tables: list[str] = []

        fitz_doc = fitz.open(str(file_path))

        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if not text or not text.strip():
                    text = cls._ocr_page(fitz_doc[i])
                if text:
                    page_num = i + 1
                    text_parts.append(
                        f"--- Страница {page_num} ---\n{text.strip()}"
                    )

                for raw_table in page.extract_tables():
                    md = cls._table_to_markdown(raw_table)
                    if md:
                        tables.append(md)

        fitz_doc.close()
        return ExtractedDocument(text="\n\n".join(text_parts), tables=tables)

    @classmethod
    def _ocr_page(cls, page: fitz.Page) -> str:
        pix = page.get_pixmap(dpi=300)
        img = Image.open(BytesIO(pix.tobytes("png")))
        return recognize(img)

    @classmethod
    def _table_to_markdown(cls, table: list) -> str:
        if not table:
            return ""
        rows: list[str] = []
        for i, row in enumerate(table):
            cells = [str(c or "").replace("\n", " ").strip() for c in row]
            rows.append("| " + " | ".join(cells) + " |")
            if i == 0:
                rows.append("| " + " | ".join(["---"] * len(cells)) + " |")
        return "\n".join(rows)
