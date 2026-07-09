"""Validation tests for the consultation lead form schema."""

import pytest
from pydantic import ValidationError

from backend.api.consultations.schemas import ConsultationCreate
from backend.enums import ConsultationRequestType, ConsultationRole

VALID_PAYLOAD = {
    "name": "Иван Иванов",
    "email": "Ivan@Example.com",
    "phone": "+375291234567",
    "request_type": ConsultationRequestType.DEMO.value,
    "consent": True,
}


def test_valid_payload_normalizes_email_and_phone():
    data = ConsultationCreate(**VALID_PAYLOAD)
    assert data.email == "ivan@example.com"
    assert data.phone == "+375291234567"
    assert data.request_type is ConsultationRequestType.DEMO
    assert data.company == "Не указано"
    assert data.role is ConsultationRole.OTHER


def test_trial_request_type_is_accepted():
    payload = {
        **VALID_PAYLOAD,
        "request_type": ConsultationRequestType.TRIAL.value,
    }
    data = ConsultationCreate(**payload)
    assert data.request_type is ConsultationRequestType.TRIAL


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", "A"),
        ("email", "not-an-email"),
        ("phone", "not-a-phone"),
        ("request_type", "unknown_type"),
    ],
)
def test_invalid_field_raises(field, value):
    payload = {**VALID_PAYLOAD, field: value}
    with pytest.raises(ValidationError):
        ConsultationCreate(**payload)


def test_missing_consent_raises():
    payload = {**VALID_PAYLOAD, "consent": False}
    with pytest.raises(ValidationError):
        ConsultationCreate(**payload)


def test_agree_marketing_defaults_to_false():
    data = ConsultationCreate(**VALID_PAYLOAD)
    assert data.agree_marketing is False


def test_agree_marketing_can_be_true():
    payload = {**VALID_PAYLOAD, "agree_marketing": True}
    data = ConsultationCreate(**payload)
    assert data.agree_marketing is True


def test_honeypot_is_passed_through_unvalidated():
    """The schema does not reject a filled honeypot; the router does."""
    payload = {**VALID_PAYLOAD, "honeypot": "spam"}
    data = ConsultationCreate(**payload)
    assert data.honeypot == "spam"


def test_honeypot_empty_is_valid():
    payload = {**VALID_PAYLOAD, "honeypot": ""}
    data = ConsultationCreate(**payload)
    assert data.honeypot == ""


def test_legacy_optional_fields_still_work():
    payload = {
        **VALID_PAYLOAD,
        "company": "ООО Ромашка",
        "role": ConsultationRole.PROCUREMENT_MANAGER.value,
        "comment": "Интересует модуль поиска поставщиков",
    }
    data = ConsultationCreate(**payload)
    assert data.company == "ООО Ромашка"
    assert data.role is ConsultationRole.PROCUREMENT_MANAGER
    assert data.comment == "Интересует модуль поиска поставщиков"
