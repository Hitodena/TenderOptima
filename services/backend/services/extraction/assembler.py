from backend.schemas.extracted_document import ExtractedDocument


class TextAssembler:
    @classmethod
    def assemble(cls, doc: ExtractedDocument) -> str:
        parts = []
        if doc.text.strip():
            parts.append(doc.text.strip())
        for table in doc.tables:
            if table.strip():
                parts.append(table.strip())
        return "\n\n".join(parts)
