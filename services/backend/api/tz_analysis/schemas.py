import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from backend.enums import (
    TZAnalysisHistoryGroup,
    TZAnalysisRunStatus,
    TZAnalysisStatus,
)
from backend.schemas.analysis import TZAnalysisItem, TZAnalysisSessionResult


class TZAnalysisListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    tz_filename: str | None = None
    kp_filename: str | None = None
    kp_filenames: list[str] = []
    confirmed: bool = False
    status: TZAnalysisRunStatus
    match_score: int
    met_count: int
    partial_count: int
    missing_count: int
    not_found_count: int
    created_at: datetime


class TZAnalysisHistoryPageResponse(BaseModel):
    """Paginated TZ analysis list for history tabs."""

    items: list[TZAnalysisListItem]
    page: int = Field(ge=1)
    size: int = Field(ge=1, le=100)
    has_more: bool
    group: TZAnalysisHistoryGroup


class TZAnalysisCompleteResponse(BaseModel):
    id: uuid.UUID
    status: TZAnalysisRunStatus


class TZAnalysisDocxRequest(BaseModel):
    selected_indices: Annotated[
        list[int],
        Field(description="Indices of items to include in the letter"),
    ]
    organization: Annotated[
        str,
        Field(min_length=1, max_length=500),
    ]
    deadline_date: Annotated[
        str | None,
        Field(
            default=None,
            description="Deadline text, e.g. '7 июня 2026 г.'",
            max_length=100,
        ),
    ] = None


class TZAnalysisCreateRequest(BaseModel):
    title: Annotated[
        str,
        Field(min_length=3, max_length=500, description="Analysis name"),
    ]


class TZAnalysisPreviewResponse(BaseModel):
    title: str
    paragraphs: list[str]
    has_issues: bool


class TZRequirementsUpdateRequest(BaseModel):
    requirements_tz: Annotated[
        list[str],
        Field(description="Extracted TZ requirements list"),
    ]
    requirements_kp: Annotated[
        dict[str, list[str]],
        Field(description="Extracted KP offerings per KP name"),
    ]


class TZAnalysisConfirmRequest(BaseModel):
    requirements_tz: Annotated[
        list[str] | None,
        Field(default=None, description="Optional TZ requirements override"),
    ] = None
    requirements_kp: Annotated[
        dict[str, list[str]] | None,
        Field(default=None, description="Optional KP offerings override"),
    ] = None


class TZPrimaryKpRequest(BaseModel):
    kp_filename: Annotated[
        str,
        Field(min_length=1, max_length=512, description="Primary KP display name"),
    ]


class TZAnalysisDetailResponse(TZAnalysisSessionResult):
    pass


def row_to_session(row) -> TZAnalysisDetailResponse:
    items = [TZAnalysisItem(**item) for item in (row.items or [])]
    kp_filenames = row.kp_filenames or []
    if not kp_filenames and row.kp_filename:
        kp_filenames = [row.kp_filename]
    return TZAnalysisDetailResponse(
        id=str(row.id),
        title=row.title or None,
        status=TZAnalysisRunStatus(row.status),
        tz_filename=row.tz_filename,
        kp_filename=row.kp_filename,
        kp_filenames=kp_filenames,
        confirmed=bool(getattr(row, "confirmed", False)),
        requirements_tz=list(getattr(row, "requirements_tz", None) or []),
        requirements_kp=dict(getattr(row, "requirements_kp", None) or {}),
        kp_stats=dict(getattr(row, "kp_stats", None) or {}),
        items=items,
        match_score=row.match_score,
        met_count=row.met_count,
        partial_count=row.partial_count,
        missing_count=row.missing_count,
        not_found_count=row.not_found_count,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


STATUS_LABELS = {
    TZAnalysisStatus.MET: "Соответствует",
    TZAnalysisStatus.PARTIAL: "Частично",
    TZAnalysisStatus.MISSING: "Не соответствует",
    TZAnalysisStatus.NOT_FOUND: "Не найдено",
}
