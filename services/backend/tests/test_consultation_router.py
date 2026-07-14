"""Endpoint tests for POST /api/consultations (honeypot, rate-limit)."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from backend.api.consultations import router as consultation_router
from backend.api.deps import get_session
from backend.enums import (
    ConsultationRequestType,
    ConsultationRole,
    ConsultationStatus,
)
from backend.main import app
from fastapi.testclient import TestClient

VALID_PAYLOAD = {
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "phone": "+375 29 1234567",
    "request_type": ConsultationRequestType.DEMO.value,
    "consent": True,
}


class _FakeConsultationRow:
    def __init__(self, **values):
        self.id = uuid.uuid4()
        self.name = values["name"]
        self.company = values.get("company", "Не указано")
        self.email = values["email"]
        self.phone = values["phone"]
        self.role = values.get("role", ConsultationRole.OTHER.value)
        self.request_type = values.get(
            "request_type", ConsultationRequestType.DEMO.value
        )
        self.comment = values.get("comment")
        self.agree_marketing = values.get("agree_marketing", False)
        self.status = values.get("status", ConsultationStatus.NEW.value)
        self.utm_source = values.get("utm_source")
        self.utm_medium = values.get("utm_medium")
        self.utm_campaign = values.get("utm_campaign")
        self.utm_content = values.get("utm_content")
        self.page_url = values.get("page_url")
        self.created_at = datetime.now(UTC)


@pytest.fixture
def client():
    app.dependency_overrides[get_session] = lambda: None
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_session, None)


def _patched(count_recent: int = 0, existing_email=None, existing_phone=None):
    return (
        patch.object(
            consultation_router.ConsultationDAO,
            "count_recent_by_ip",
            AsyncMock(return_value=count_recent),
        ),
        patch.object(
            consultation_router.ConsultationDAO,
            "get_by_email",
            AsyncMock(return_value=existing_email),
        ),
        patch.object(
            consultation_router.ConsultationDAO,
            "get_by_phone",
            AsyncMock(return_value=existing_phone),
        ),
        patch.object(
            consultation_router.ConsultationDAO,
            "create",
            AsyncMock(
                side_effect=lambda _session, **values: _FakeConsultationRow(
                    **values
                )
            ),
        ),
        patch.object(
            consultation_router,
            "notify_admin_new_consultation",
        ),
        patch.object(
            consultation_router,
            "send_consultation_autoreply",
        ),
    )


def test_create_consultation_success(client: TestClient):
    with (
        _patched()[0],
        _patched()[1],
        _patched()[2],
        _patched()[3],
        _patched()[4],
        _patched()[5],
    ):
        response = client.post("/api/consultations", json=VALID_PAYLOAD)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == VALID_PAYLOAD["email"]
    assert data["status"] == ConsultationStatus.NEW.value


def test_create_consultation_rejects_honeypot(client: TestClient):
    payload = {**VALID_PAYLOAD, "honeypot": "spam"}
    (
        count_patch,
        email_patch,
        phone_patch,
        create_patch,
        notify_patch,
        autoreply_patch,
    ) = _patched()
    with (
        count_patch,
        email_patch,
        phone_patch,
        create_patch as create_mock,
        notify_patch,
        autoreply_patch,
    ):
        response = client.post("/api/consultations", json=payload)
    assert response.status_code == 400
    create_mock.assert_not_called()


def test_create_consultation_rate_limited(client: TestClient):
    (
        count_patch,
        email_patch,
        phone_patch,
        create_patch,
        notify_patch,
        autoreply_patch,
    ) = _patched(count_recent=5)
    with (
        count_patch,
        email_patch,
        phone_patch,
        create_patch as create_mock,
        notify_patch,
        autoreply_patch,
    ):
        response = client.post("/api/consultations", json=VALID_PAYLOAD)
    assert response.status_code == 429
    create_mock.assert_not_called()


def test_create_consultation_rejects_duplicate_email(client: TestClient):
    existing = _FakeConsultationRow(
        name="Existing",
        email=VALID_PAYLOAD["email"],
        phone="+375291111111",
    )
    (
        count_patch,
        email_patch,
        phone_patch,
        create_patch,
        notify_patch,
        autoreply_patch,
    ) = _patched(existing_email=existing)
    with (
        count_patch,
        email_patch,
        phone_patch,
        create_patch as create_mock,
        notify_patch,
        autoreply_patch,
    ):
        response = client.post("/api/consultations", json=VALID_PAYLOAD)
    assert response.status_code == 409
    assert "email" in response.json()["detail"].lower()
    create_mock.assert_not_called()


def test_create_consultation_rejects_duplicate_phone(client: TestClient):
    existing = _FakeConsultationRow(
        name="Existing",
        email="other@example.com",
        phone="+375291234567",
    )
    (
        count_patch,
        email_patch,
        phone_patch,
        create_patch,
        notify_patch,
        autoreply_patch,
    ) = _patched(existing_phone=existing)
    with (
        count_patch,
        email_patch,
        phone_patch,
        create_patch as create_mock,
        notify_patch,
        autoreply_patch,
    ):
        response = client.post("/api/consultations", json=VALID_PAYLOAD)
    assert response.status_code == 409
    assert "телефон" in response.json()["detail"].lower()
    create_mock.assert_not_called()


def test_create_consultation_invalid_payload_returns_422(client: TestClient):
    payload = {**VALID_PAYLOAD, "email": "not-an-email"}
    response = client.post("/api/consultations", json=payload)
    assert response.status_code == 422
