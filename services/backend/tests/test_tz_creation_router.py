"""Endpoint tests for the TZ creation wizard router (/api/tz-creation)."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from backend.api.deps import get_current_user, get_session
from backend.api.tz_creation import router as tz_creation_router
from backend.enums import (
    TZCreationMessageRole,
    TZCreationMode,
    TZCreationStatus,
)
from backend.main import app
from fastapi.testclient import TestClient


class _FakeUser:
    def __init__(self) -> None:
        self.id = uuid.uuid4()
        self.is_admin = True


class _FakeMessage:
    def __init__(self, role: str, content: str) -> None:
        self.role = role
        self.content = content
        self.created_at = datetime.now(UTC)


class _FakeSession:
    def __init__(self, **values) -> None:
        self.id = values.get("id", uuid.uuid4())
        self.user_id = values["user_id"]
        self.mode = values.get("mode", TZCreationMode.FROM_SCRATCH.value)
        self.title = values.get("title", "")
        self.context = values.get("context", {"domain": "other", "note": ""})
        self.source_tz_filename = values.get("source_tz_filename")
        self.draft_hierarchy = values.get("draft_hierarchy", {})
        self.fields = values.get("fields", [])
        self.status = values.get("status", TZCreationStatus.ACTIVE.value)
        self.llm_model = values.get("llm_model", "")
        self.messages_used = values.get("messages_used", 0)
        self.resulting_tz_analysis_id = values.get("resulting_tz_analysis_id")
        self.created_at = datetime.now(UTC)


@pytest.fixture
def fake_user():
    return _FakeUser()


@pytest.fixture
def client(fake_user):
    app.dependency_overrides[get_session] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: fake_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_session, None)
    app.dependency_overrides.pop(get_current_user, None)


def test_create_session_from_scratch(client, fake_user):
    created = _FakeSession(user_id=fake_user.id, mode="from_scratch")
    with (
        patch.object(
            tz_creation_router,
            "ensure_module_2_work_allowed",
            new=AsyncMock(return_value=None),
        ),
        patch.object(
            tz_creation_router.TZCreationSessionDAO,
            "create",
            new=AsyncMock(return_value=created),
        ),
        patch.object(
            tz_creation_router.TZCreationMessageDAO,
            "list_by_session",
            new=AsyncMock(return_value=[]),
        ),
    ):
        response = client.post(
            "/api/tz-creation/",
            json={"mode": "from_scratch", "title": "Тендер на закупку"},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["mode"] == "from_scratch"
    assert body["status"] == "active"
    assert body["messages_used"] == 0
    assert body["messages_limit"] > 0


def test_non_admin_cannot_access_tz_creation(fake_user):
    fake_user.is_admin = False
    app.dependency_overrides[get_session] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: fake_user
    try:
        with TestClient(app) as test_client:
            response = test_client.get("/api/tz-creation/")
    finally:
        app.dependency_overrides.pop(get_session, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403
    assert response.json()["detail"] == "Required admin status"


def test_send_message_runs_kickoff_turn_for_first_from_scratch_message(
    client, fake_user
):
    row = _FakeSession(
        user_id=fake_user.id,
        mode="from_scratch",
        status="active",
        messages_used=0,
    )
    updated = _FakeSession(
        id=row.id,
        user_id=fake_user.id,
        mode="from_scratch",
        status="active",
        messages_used=1,
        draft_hierarchy={"1": {"text": "Общие требования", "children": {}}},
        fields=[
            {
                "key": "capacity",
                "label": "Производительность",
                "value": "",
                "status": "pending",
            }
        ],
        llm_model="deepseek-v4-flash",
    )
    kickoff_result = {
        "assistant_message": "Уточните, пожалуйста, объём закупки.",
        "hierarchy_patch": {"1": {"text": "Общие требования", "children": {}}},
        "fields_update": [
            {
                "key": "capacity",
                "label": "Производительность",
                "value": "",
                "status": "pending",
            }
        ],
        "suggested_done": False,
    }

    with (
        patch.object(
            tz_creation_router.TZCreationSessionDAO,
            "get_by_id_and_user",
            new=AsyncMock(return_value=row),
        ),
        patch.object(
            tz_creation_router.TZCreationMessageDAO,
            "list_by_session",
            new=AsyncMock(return_value=[]),
        ),
        patch.object(
            tz_creation_router,
            "run_kickoff_turn",
            new=AsyncMock(return_value=kickoff_result),
        ) as kickoff_mock,
        patch.object(
            tz_creation_router.TZCreationMessageDAO,
            "create",
            new=AsyncMock(return_value=_FakeMessage("user", "x")),
        ),
        patch.object(
            tz_creation_router.TZCreationSessionDAO,
            "update_fields",
            new=AsyncMock(return_value=updated),
        ) as update_mock,
    ):
        response = client.post(
            f"/api/tz-creation/{row.id}/messages",
            json={"message": "Нужен упаковочный автомат для сыра"},
        )

    assert response.status_code == 200
    kickoff_mock.assert_awaited_once()
    body = response.json()
    assert body["draft_hierarchy"]["1"]["text"] == "Общие требования"
    assert body["fields"][0]["key"] == "capacity"
    assert body["messages_used"] == 1

    _, update_kwargs = update_mock.call_args
    assert update_kwargs["messages_used"] == 1


def test_send_message_blocked_when_quota_exhausted(client, fake_user):
    row = _FakeSession(
        user_id=fake_user.id,
        mode="from_scratch",
        status="active",
        messages_used=tz_creation_router.config.tz_creation_max_messages_per_session,
    )
    with patch.object(
        tz_creation_router.TZCreationSessionDAO,
        "get_by_id_and_user",
        new=AsyncMock(return_value=row),
    ):
        response = client.post(
            f"/api/tz-creation/{row.id}/messages",
            json={"message": "Ещё один вопрос"},
        )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "tz_creation_message_limit"


def test_finalize_creates_tz_analysis_and_returns_its_id(client, fake_user):
    row = _FakeSession(
        user_id=fake_user.id,
        mode="from_scratch",
        status="active",
        draft_hierarchy={"1": {"text": "Общие требования", "children": {}}},
        llm_model="deepseek-v4-flash",
    )

    class _FakeTZAnalysis:
        def __init__(self) -> None:
            self.id = uuid.uuid4()

    fake_analysis = _FakeTZAnalysis()

    with (
        patch.object(
            tz_creation_router.TZCreationSessionDAO,
            "get_by_id_and_user",
            new=AsyncMock(return_value=row),
        ),
        patch.object(
            tz_creation_router.TZAnalysisDAO,
            "create",
            new=AsyncMock(return_value=fake_analysis),
        ) as create_mock,
        patch.object(
            tz_creation_router.TZCreationSessionDAO,
            "update_fields",
            new=AsyncMock(return_value=row),
        ) as update_mock,
    ):
        response = client.post(f"/api/tz-creation/{row.id}/finalize")

    assert response.status_code == 200
    assert response.json()["tz_analysis_id"] == str(fake_analysis.id)

    _, create_kwargs = create_mock.call_args
    assert create_kwargs["confirmed"] is True
    assert create_kwargs["requirements_tz"]["1"]["text"] == "Общие требования"

    _, update_kwargs = update_mock.call_args
    assert update_kwargs["status"] == TZCreationStatus.COMPLETED.value
    assert update_kwargs["resulting_tz_analysis_id"] == fake_analysis.id


def test_finalize_rejects_empty_draft(client, fake_user):
    row = _FakeSession(
        user_id=fake_user.id,
        mode="from_scratch",
        status="active",
        draft_hierarchy={},
    )
    with patch.object(
        tz_creation_router.TZCreationSessionDAO,
        "get_by_id_and_user",
        new=AsyncMock(return_value=row),
    ):
        response = client.post(f"/api/tz-creation/{row.id}/finalize")

    assert response.status_code == 400


def test_export_preview_docx_returns_docx_bytes(client):
    response = client.post(
        "/api/tz-creation/export-preview.docx",
        json={
            "title": "",
            "requirements_tz": {
                "1": {"text": "Общие требования", "children": {}}
            },
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert len(response.content) > 0


def test_message_role_enum_values_match_message_dao_usage():
    """Guards the {user, assistant} contract shared by router and prompts."""
    assert {role.value for role in TZCreationMessageRole} == {
        "user",
        "assistant",
    }
