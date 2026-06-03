from collections.abc import Generator
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from PIL import Image

from backend.services.extraction.base import BaseExtractor, ExtractedDocument
from backend.utils.ocr import recognize


class DocxExtractor(BaseExtractor):
    @classmethod
    def extract(cls, file_path: Path) -> ExtractedDocument:
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        doc = Document(str(file_path))
        text_parts: list[str] = []
        tables: list[str] = []

        for block in cls._iter_body_blocks(doc):
            if block["type"] == "paragraph":
                if block["text"].strip():
                    text_parts.append(block["text"])
            elif block["type"] == "table":
                tables.append(block["markdown"])

        for img_text in cls._extract_images(doc):
            text_parts.append(img_text)

        return ExtractedDocument(text="\n".join(text_parts), tables=tables)

    @classmethod
    def _iter_body_blocks(
        cls, doc: DocxDocument
    ) -> Generator[dict[str, str], None, None]:
        parent = doc.element.body
        for child in parent:
            if isinstance(child, CT_P):
                yield {
                    "type": "paragraph",
                    "text": Paragraph(child, parent).text,
                }
            elif isinstance(child, CT_Tbl):
                tbl = Table(child, parent)
                yield {
                    "type": "table",
                    "markdown": cls._table_to_markdown(tbl),
                }

    @classmethod
    def _table_to_markdown(cls, table: Table) -> str:
        rows: list[str] = []
        for i, row in enumerate(table.rows):
            cells = [c.text.replace("\n", " ").strip() for c in row.cells]
            rows.append("| " + " | ".join(cells) + " |")
            if i == 0:
                rows.append("| " + " | ".join(["---"] * len(cells)) + " |")
        return "\n".join(rows)

    @classmethod
    def _extract_images(cls, doc: DocxDocument) -> list[str]:
        results: list[str] = []
        for rel in doc.part.rels.values():
            if "image" not in rel.reltype:
                continue
            try:
                img = Image.open(BytesIO(rel.target_part.blob))
                text = recognize(img)
                if text:
                    results.append(f"[Изображение]:\n{text}")
            except Exception:
                pass
        return results
