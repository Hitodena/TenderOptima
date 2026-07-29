import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.enums import (
    TZCreationMessageRole,
    TZCreationMode,
    TZCreationStatus,
)
from backend.utils.requirements_struct import normalize_tz_requirements


class TZCreationContextPayload(BaseModel):
    """Domain context injected into every wizard prompt."""

    industry: Annotated[
        str,
        Field(
            default="",
            max_length=200,
            description="Free-text industry / direction of procurement",
        ),
    ] = ""
    note: Annotated[
        str,
        Field(default="", max_length=1000, description="Free-text context"),
    ] = ""


class TZCreationContextUpdateRequest(BaseModel):
    """Partial update for session context (industry field in workspace)."""

    industry: Annotated[
        str,
        Field(default="", max_length=200, description="Industry / direction"),
    ] = ""


class TZCreationFieldItem(BaseModel):
    key: str
    label: str
    value: str = ""
    status: str = "pending"
    requirement_key: str | None = None
    confirmed: bool = False


class TZCreationRequirementHint(BaseModel):
    text: str
    requirement_text: str = ""
    text_hash: str = ""
    model: str = ""
    generated_at: datetime | None = None
    cached: bool = False


class TZCreationMessageItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    role: TZCreationMessageRole
    content: str
    created_at: datetime


class TZCreationSessionCreateRequest(BaseModel):
    title: Annotated[
        str,
        Field(default="", max_length=500, description="Optional TZ title"),
    ] = ""
    mode: TZCreationMode
    context: TZCreationContextPayload = TZCreationContextPayload()


class TZCreationSessionDetailResponse(BaseModel):
    id: uuid.UUID
    mode: TZCreationMode
    title: str
    context: TZCreationContextPayload
    source_tz_filename: str | None = None
    draft_hierarchy: dict = {}
    fields: list[TZCreationFieldItem] = []
    open_questions: list[str] = []
    requirement_hints: dict[str, TZCreationRequirementHint] = {}
    status: TZCreationStatus
    llm_model: str = ""
    messages_used: int = 0
    messages_limit: int
    resulting_tz_analysis_id: uuid.UUID | None = None
    created_at: datetime
    messages: list[TZCreationMessageItem] = []

    @field_validator("draft_hierarchy", mode="before")
    @classmethod
    def coerce_hierarchy(cls, value: object) -> dict:
        return normalize_tz_requirements(value)

    @field_validator("requirement_hints", mode="before")
    @classmethod
    def coerce_hints(cls, value: object) -> dict:
        return value if isinstance(value, dict) else {}

    @field_validator("open_questions", mode="before")
    @classmethod
    def coerce_open_questions(cls, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item).strip() for item in value if str(item).strip()]


class TZCreationSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    mode: TZCreationMode
    title: str
    status: TZCreationStatus
    resulting_tz_analysis_id: uuid.UUID | None = None
    created_at: datetime


class TZCreationHistoryPageResponse(BaseModel):
    items: list[TZCreationSessionListItem]
    page: int = Field(ge=1)
    size: int = Field(ge=1, le=100)
    has_more: bool


class TZCreationMessageRequest(BaseModel):
    message: Annotated[
        str,
        Field(min_length=1, max_length=4000, description="User chat message"),
    ]


class TZCreationHierarchyUpdateRequest(BaseModel):
    draft_hierarchy: Annotated[
        dict,
        Field(description="Manually edited TZ outline as a hierarchical dict"),
    ]

    @field_validator("draft_hierarchy", mode="before")
    @classmethod
    def coerce_hierarchy(cls, value: object) -> dict:
        return normalize_tz_requirements(value)


class TZCreationFieldsUpdateRequest(BaseModel):
    fields: list[TZCreationFieldItem]


class TZCreationFinalizeResponse(BaseModel):
    tz_analysis_id: uuid.UUID


class TZCreationCompleteResponse(BaseModel):
    id: uuid.UUID
    status: TZCreationStatus


class TZCreationExportRequest(BaseModel):
    """Stateless export payload — no session required."""

    title: Annotated[str, Field(default="", max_length=500)] = ""
    requirements_tz: Annotated[
        dict,
        Field(description="TZ outline as a hierarchical dict"),
    ]

    @field_validator("requirements_tz", mode="before")
    @classmethod
    def coerce_hierarchy(cls, value: object) -> dict:
        return normalize_tz_requirements(value)
