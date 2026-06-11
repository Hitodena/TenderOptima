import csv
import io
import tempfile
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import Response, StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_session
from backend.api.tz_analysis.schemas import (
    STATUS_LABELS,
    TZAnalysisCompleteResponse,
    TZAnalysisConfirmRequest,
    TZAnalysisCreateRequest,
    TZAnalysisDetailResponse,
    TZAnalysisDocxRequest,
    TZAnalysisHistoryPageResponse,
    TZAnalysisListItem,
    TZAnalysisPreviewResponse,
    TZPrimaryKpRequest,
    TZRequirementsUpdateRequest,
    row_to_session,
)
from backend.celery_app.tasks.analysis_tasks import (
    run_tz_compare as queue_tz_compare,
)
from backend.celery_app.tasks.analysis_tasks import (
    run_tz_extract as queue_tz_extract,
)
from backend.celery_app.tasks.analysis_tasks import (
    run_tz_kp_compare as queue_tz_kp_compare,
)
from backend.core.config import get_config
from backend.db.dao import TZAnalysisDAO
from backend.db.models import User
from backend.enums import TZAnalysisHistoryGroup, TZAnalysisRunStatus
from backend.schemas.analysis import TZAnalysisItem
from backend.services.analysis.docx_export import (
    build_clarification_docx,
    build_clarification_preview,
)
from backend.utils.requirements_struct import (
    count_requirements,
    normalize_requirements_kp,
    normalize_tz_requirements,
    requirements_nonempty,
)
from backend.utils.tz_storage import (
    make_unique_filenames,
    save_kp_analysis_files,
    save_tz_only_file,
)

router = APIRouter(prefix="/tz-analysis", tags=["TZ Analysis"])
config = get_config()


async def _save_upload(
    upload: UploadFile,
    dest_dir: Path,
    *,
    dest_name: str | None = None,
) -> Path:
    if not upload.filename and not dest_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is required",
        )
    limit = config.max_tz_upload_size
    if upload.size and upload.size > limit:
        limit_mb = limit // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {limit_mb} MB",
        )
    data = await upload.read()
    if len(data) > limit:
        limit_mb = limit // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {limit_mb} MB",
        )
    safe_name = dest_name or Path(upload.filename or "file").name.replace(
        "..", "_"
    )
    path = dest_dir / safe_name
    path.write_bytes(data)
    return path


@router.post(
    "/",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a draft TZ analysis",
)
async def create_tz_analysis(
    body: TZAnalysisCreateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    """Create a draft analysis session before uploading TZ and KP files."""
    row = await TZAnalysisDAO.create(
        session,
        user_id=current_user.id,
        title=body.title.strip(),
        tz_filename=None,
        kp_filename=None,
        kp_filenames=[],
        confirmed=False,
        requirements_tz={},
        requirements_kp={},
        kp_stats={},
        items=[],
        match_score=0,
        met_count=0,
        partial_count=0,
        missing_count=0,
        not_found_count=0,
        tz_requirements_count=0,
        llm_model="",
        status=TZAnalysisRunStatus.DRAFT.value,
    )
    logger.info(
        "TZ analysis draft created",
        analysis_id=str(row.id),
        user_id=str(current_user.id),
    )
    return row_to_session(row)


@router.post(
    "/{analysis_id}/run",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload TZ and queue requirements extraction",
)
async def run_tz_analysis(
    analysis_id: uuid.UUID,
    tz_file: Annotated[
        UploadFile, File(description="Technical specification")
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    """Save TZ for a draft analysis and enqueue TZ-only extraction."""
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status != TZAnalysisRunStatus.DRAFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run analysis in status '{row.status}'",
        )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        tz_path = await _save_upload(tz_file, tmp_path)
        tz_name = tz_file.filename or tz_path.name

        updated = await TZAnalysisDAO.update_fields(
            session,
            row.id,
            tz_filename=tz_name,
            kp_filename=None,
            kp_filenames=[],
            confirmed=False,
            requirements_tz={},
            requirements_kp={},
            kp_stats={},
            items=[],
            match_score=0,
            met_count=0,
            partial_count=0,
            missing_count=0,
            not_found_count=0,
            tz_requirements_count=0,
            status=TZAnalysisRunStatus.PROCESSING.value,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found",
            )
        save_tz_only_file(row.id, tz_path)

    queue_tz_extract.delay(str(row.id))  # type: ignore[attr-defined]
    logger.info(
        "TZ extract queued",
        analysis_id=str(row.id),
        user_id=str(current_user.id),
    )
    refreshed = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return row_to_session(refreshed)


@router.post(
    "/{analysis_id}/run-kp",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload KP files and queue comparison against TZ requirements",
)
async def run_tz_kp_analysis(
    analysis_id: uuid.UUID,
    kp_files: Annotated[
        list[UploadFile],
        File(description="One or more commercial proposals"),
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    """Save KP files and enqueue extraction plus comparison."""
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for KP upload",
        )
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )
    if not requirements_nonempty(row.requirements_tz):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )
    if not kp_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one KP file is required",
        )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        raw_kp_names = [
            Path(kp_upload.filename or "kp").name.replace("..", "_")
            for kp_upload in kp_files
        ]
        kp_names = make_unique_filenames(raw_kp_names)
        kp_paths: list[Path] = []
        for idx, (kp_upload, display_name) in enumerate(
            zip(kp_files, kp_names, strict=True),
            start=1,
        ):
            suffix = (
                Path(display_name).suffix.lower()
                or Path(kp_upload.filename or "").suffix.lower()
                or ".bin"
            )
            kp_path = await _save_upload(
                kp_upload,
                tmp_path,
                dest_name=f"kp{idx}{suffix}",
            )
            kp_paths.append(kp_path)
        primary_kp = kp_names[0] if kp_names else None

        updated = await TZAnalysisDAO.update_fields(
            session,
            row.id,
            kp_filename=primary_kp,
            kp_filenames=kp_names,
            confirmed=False,
            requirements_kp={},
            kp_stats={},
            items=[],
            match_score=0,
            met_count=0,
            partial_count=0,
            missing_count=0,
            not_found_count=0,
            tz_requirements_count=count_requirements(row.requirements_tz),
            status=TZAnalysisRunStatus.PROCESSING.value,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found",
            )
        save_kp_analysis_files(row.id, kp_paths)

    queue_tz_kp_compare.delay(str(row.id))  # type: ignore[attr-defined]
    logger.info(
        "TZ KP compare queued",
        analysis_id=str(row.id),
        user_id=str(current_user.id),
    )
    refreshed = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return row_to_session(refreshed)


@router.get(
    "/",
    response_model=list[TZAnalysisListItem],
    summary="List TZ analyses for current user",
)
async def list_tz_analyses(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[TZAnalysisListItem]:
    rows = await TZAnalysisDAO.get_by_user(session, current_user.id)
    return [TZAnalysisListItem.model_validate(r) for r in rows]


@router.get(
    "/history",
    response_model=TZAnalysisHistoryPageResponse,
    summary="Paginated TZ analysis history by lifecycle group",
)
async def get_tz_analysis_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    group: Annotated[
        TZAnalysisHistoryGroup,
        Query(description="History tab: active, processing, completed"),
    ],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 10,
    q: Annotated[
        str | None,
        Query(
            max_length=200,
            description="Search in title, TZ/KP filenames and kp_filenames list",
        ),
    ] = None,
) -> TZAnalysisHistoryPageResponse:
    rows, has_more = await TZAnalysisDAO.get_history_page_by_user(
        session,
        current_user.id,
        group,
        page=page,
        size=size,
        search=q,
    )
    return TZAnalysisHistoryPageResponse(
        items=[TZAnalysisListItem.model_validate(r) for r in rows],
        page=page,
        size=size,
        has_more=has_more,
        group=group,
    )


@router.post(
    "/{analysis_id}/complete",
    response_model=TZAnalysisCompleteResponse,
    summary="Mark TZ analysis as completed (archived)",
)
async def complete_tz_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisCompleteResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status == TZAnalysisRunStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already completed",
        )
    if row.status == TZAnalysisRunStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is still processing",
        )
    updated = await TZAnalysisDAO.update_fields(
        session,
        row.id,
        status=TZAnalysisRunStatus.COMPLETED.value,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return TZAnalysisCompleteResponse(
        id=updated.id,
        status=TZAnalysisRunStatus(updated.status),
    )


def _is_export_ready(status: str, confirmed: bool) -> bool:
    return (
        status
        in (
            TZAnalysisRunStatus.ACTIVE.value,
            TZAnalysisRunStatus.COMPLETED.value,
        )
        and confirmed
    )


@router.patch(
    "/{analysis_id}/requirements",
    response_model=TZAnalysisDetailResponse,
    summary="Update extracted TZ/KP requirements before confirmation",
)
async def update_tz_requirements(
    analysis_id: uuid.UUID,
    body: TZRequirementsUpdateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for requirements editing",
        )
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )
    update_payload: dict = {
        "requirements_tz": body.requirements_tz,
        "tz_requirements_count": count_requirements(body.requirements_tz),
    }
    if body.requirements_kp is not None:
        update_payload["requirements_kp"] = body.requirements_kp
    updated = await TZAnalysisDAO.update_fields(
        session,
        row.id,
        **update_payload,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    logger.info(
        "TZ requirements updated",
        analysis_id=str(analysis_id),
        user_id=str(current_user.id),
    )
    return row_to_session(updated)


@router.patch(
    "/{analysis_id}/primary-kp",
    response_model=TZAnalysisDetailResponse,
    summary="Set primary KP and sync displayed match stats",
)
async def set_primary_kp(
    analysis_id: uuid.UUID,
    body: TZPrimaryKpRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status not in (
        TZAnalysisRunStatus.ACTIVE.value,
        TZAnalysisRunStatus.COMPLETED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for primary KP selection",
        )
    updated = await TZAnalysisDAO.set_primary_kp(
        session,
        analysis_id,
        current_user.id,
        body.kp_filename.strip(),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid primary KP",
        )
    logger.info(
        "TZ primary KP updated",
        analysis_id=str(analysis_id),
        user_id=str(current_user.id),
    )
    return row_to_session(updated)


@router.post(
    "/{analysis_id}/confirm",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Confirm requirements and queue TZ vs KP comparison",
)
async def confirm_tz_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    body: TZAnalysisConfirmRequest | None = None,
) -> TZAnalysisDetailResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for confirmation",
        )
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )

    requirements_tz = (
        body.requirements_tz
        if body and body.requirements_tz is not None
        else normalize_tz_requirements(row.requirements_tz)
    )
    requirements_kp = (
        body.requirements_kp
        if body and body.requirements_kp is not None
        else normalize_requirements_kp(row.requirements_kp)
    )
    if not requirements_nonempty(requirements_tz):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )
    if not requirements_kp or not any(
        requirements_nonempty(items) for items in requirements_kp.values()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one KP offering list is required",
        )

    updated = await TZAnalysisDAO.update_fields(
        session,
        row.id,
        requirements_tz=requirements_tz,
        requirements_kp=requirements_kp,
        tz_requirements_count=count_requirements(requirements_tz),
        status=TZAnalysisRunStatus.PROCESSING.value,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    queue_tz_compare.delay(str(row.id))  # type: ignore[attr-defined]
    logger.info(
        "TZ compare queued after confirmation",
        analysis_id=str(analysis_id),
        user_id=str(current_user.id),
    )
    refreshed = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return row_to_session(refreshed)


@router.get(
    "/{analysis_id}",
    response_model=TZAnalysisDetailResponse,
    summary="Get TZ analysis by id",
)
async def get_tz_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return row_to_session(row)


@router.get(
    "/{analysis_id}/export.csv",
    summary="Export TZ analysis as CSV",
)
async def export_tz_analysis_csv(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> StreamingResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if not _is_export_ready(row.status, bool(row.confirmed)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for export",
        )

    items = [TZAnalysisItem(**item) for item in (row.items or [])]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "№",
            "КП",
            "Требование",
            "Ссылка ТЗ",
            "Предложение",
            "Ссылка КП",
            "Статус",
            "Объяснение",
        ]
    )
    for idx, item in enumerate(items, start=1):
        writer.writerow(
            [
                idx,
                item.kp_name or "",
                item.requirement,
                item.requirement_ref or "",
                item.offer_value or "",
                item.offer_ref or "",
                STATUS_LABELS.get(item.status, item.status.value),
                item.explanation,
            ]
        )

    buffer.seek(0)
    filename = f"tz_analysis_{analysis_id}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{analysis_id}/preview",
    response_model=TZAnalysisPreviewResponse,
    summary="Preview clarification letter for selected items",
)
async def preview_tz_analysis_letter(
    analysis_id: uuid.UUID,
    body: TZAnalysisDocxRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisPreviewResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if not _is_export_ready(row.status, bool(row.confirmed)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for preview",
        )

    items = [TZAnalysisItem(**item) for item in (row.items or [])]
    if not body.selected_indices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one item",
        )

    title, paragraphs, has_issues = build_clarification_preview(
        items=items,
        selected_indices=body.selected_indices,
        organization=body.organization,
        deadline_date=body.deadline_date,
    )
    return TZAnalysisPreviewResponse(
        title=title,
        paragraphs=paragraphs,
        has_issues=has_issues,
    )


@router.post(
    "/{analysis_id}/docx",
    summary="Generate clarification DOCX for selected items",
)
async def export_tz_analysis_docx(
    analysis_id: uuid.UUID,
    body: TZAnalysisDocxRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if not _is_export_ready(row.status, bool(row.confirmed)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for export",
        )

    items = [TZAnalysisItem(**item) for item in (row.items or [])]
    if not body.selected_indices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one item",
        )

    docx_bytes = build_clarification_docx(
        items=items,
        selected_indices=body.selected_indices,
        organization=body.organization,
        deadline_date=body.deadline_date,
    )
    filename = f"clarification_{analysis_id}.docx"
    return Response(
        content=docx_bytes,
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
