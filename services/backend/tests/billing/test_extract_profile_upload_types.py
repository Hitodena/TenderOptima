from backend.services.billing.extract_profile import (
    SUPPORTED_BILLING_PROFILE_EXTENSIONS,
    is_supported_billing_profile_file,
)


def test_billing_profile_upload_allows_only_frontend_supported_extensions():
    assert SUPPORTED_BILLING_PROFILE_EXTENSIONS == {
        ".pdf",
        ".docx",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".txt",
    }


def test_billing_profile_upload_rejects_legacy_doc_case_insensitively():
    assert not is_supported_billing_profile_file("organization.doc")
    assert not is_supported_billing_profile_file("organization.DOC")
    assert is_supported_billing_profile_file("organization.docx")


def test_billing_profile_upload_rejects_unknown_extensions():
    assert not is_supported_billing_profile_file("organization.rtf")
    assert not is_supported_billing_profile_file("organization")
