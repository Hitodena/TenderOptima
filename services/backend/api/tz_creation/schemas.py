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

_ALLOWED_DOMAINS = {"equipment", "food", "services", "other"}


class TZCreationContextPayload(BaseModel):
    """Domain context injected into every wizard prompt."""

    domain: Annotated[
        str,
        Field(default="other", description="equipment|food|services|other"),
    ] = "other"
    note: Annotated[
        str,
        Field(default="", max_length=1000, description="Free-text context"),
    ] = ""

    @field_validator("domain", mode="before")
    @classmethod
    def coerce_domain(cls, value: object) -> str:
        text = str(value or "other").strip().lower()
        return text if text in _ALLOWED_DOMAINS else "other"


class TZCreationFieldItem(BaseModel):
    key: str
    label: str
    value: str = ""
    status: str = "pending"


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
