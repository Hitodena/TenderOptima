import pytest
from fastapi import HTTPException

from backend.utils.upload_validation import reject_legacy_doc_upload


def test_reject_legacy_doc_extension_case_insensitively():
    for filename in ("offer.doc", "offer.DOC"):
        with pytest.raises(HTTPException) as caught:
            reject_legacy_doc_upload(filename)
        assert caught.value.status_code == 415


def test_allow_docx_and_other_non_doc_extensions():
    for filename in ("offer.docx", "offer.pdf", "offer.txt", "offer"):
        reject_legacy_doc_upload(filename)


def test_allow_missing_filename_for_caller_validation():
    reject_legacy_doc_upload(None)
