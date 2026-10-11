from pathlib import Path

from fastapi import HTTPException, status


def reject_legacy_doc_upload(filename: str | None) -> None:
    """Reject legacy Word .doc uploads regardless of a client-supplied MIME."""
    if filename and Path(filename).suffix.lower() == ".doc":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Формат .doc не поддерживается. Сохраните документ как "
                ".docx или PDF."
            ),
        )
