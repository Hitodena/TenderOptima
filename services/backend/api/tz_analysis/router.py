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
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, Response, StreamingResponse
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
    TZAnalysisSupplierItem,
    TZAnalysisSupplierRenameRequest,
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
from backend.db.dao import TZAnalysisDAO, TZAnalysisSupplierDAO
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
    flatten_supplier_kp_entries,
    make_unique_filenames,
    mime_type_for_filename,
    remove_supplier_dir,
    resolve_kp_file_by_display_name,
    resolve_supplier_kp_file_by_display_name,
    resolve_supplier_kp_files,
    resolve_tz_only_file,
    save_kp_analysis_files,
    save_supplier_kp_files,
    save_tz_only_file,
)

router = APIRouter(prefix="/tz-analysis", tags=["TZ Analysis"])
config = get_config()


def _ensure_supplier_mutations_allowed(row) -> None:
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is closed for supplier changes",
        )


async def _session_response(
    session: AsyncSession,
    row,
) -> TZAnalysisDetailResponse:
    suppliers = await TZAnalysisSupplierDAO.list_by_analysis(session, row.id)
    return row_to_session(row, suppliers=suppliers)


async def _get_owned_analysis(
    session: AsyncSession,
    analysis_id: uuid.UUID,
    user_id: uuid.UUID,
):
    row = await TZAnalysisDAO.get_by_id_and_user(session, analysis_id, user_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return row


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
    return await _session_response(session, row)


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
    return await _session_response(session, refreshed)


@router.post(
    "/{analysis_id}/run-kp",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload KP files and queue comparison against TZ requirements",
)
async def run_tz_kp_analysis(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    kp_files: Annotated[
        list[UploadFile] | None,
        File(description="One or more commercial proposals"),
    ] = None,
) -> TZAnalysisDetailResponse:
    """Save KP files and enqueue extraction plus comparison."""
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
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

    suppliers = await TZAnalysisSupplierDAO.list_by_analysis(session, row.id)
    if suppliers:
        if not all(supplier.kp_filenames for supplier in suppliers):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each supplier must have at least one KP file",
            )
        supplier_entries: list[tuple[list[str], list[Path]]] = []
        for supplier in suppliers:
            paths = resolve_supplier_kp_files(row.id, supplier.id)
            if not paths or len(supplier.kp_filenames) != len(paths):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Each supplier must have at least one KP file",
                )
            supplier_entries.append((list(supplier.kp_filenames), paths))
        kp_payload = flatten_supplier_kp_entries(supplier_entries)
        kp_names = [name for name, _ in kp_payload]
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
    else:
        uploads = kp_files or []
        if not uploads:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one KP file or supplier is required",
            )
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            raw_kp_names = [
                Path(kp_upload.filename or "kp").name.replace("..", "_")
                for kp_upload in uploads
            ]
            kp_names = make_unique_filenames(raw_kp_names)
            kp_paths: list[Path] = []
            for idx, (kp_upload, display_name) in enumerate(
                zip(uploads, kp_names, strict=True),
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
    return await _session_response(session, refreshed)


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
    return await _session_response(session, updated)


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
    return await _session_response(session, updated)


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
    return await _session_response(session, refreshed)


@router.get(
    "/{analysis_id}/suppliers",
    response_model=list[TZAnalysisSupplierItem],
    summary="List suppliers for a TZ analysis",
)
async def list_tz_analysis_suppliers(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[TZAnalysisSupplierItem]:
    await _get_owned_analysis(session, analysis_id, current_user.id)
    suppliers = await TZAnalysisSupplierDAO.list_by_analysis(
        session, analysis_id
    )
    return [TZAnalysisSupplierItem.model_validate(s) for s in suppliers]


@router.post(
    "/{analysis_id}/suppliers",
    response_model=TZAnalysisSupplierItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create supplier with KP files",
)
async def create_tz_analysis_supplier(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    name: Annotated[str, Form(min_length=1, max_length=255)],
    kp_files: Annotated[
        list[UploadFile],
        File(description="One or more KP files for this supplier"),
    ],
) -> TZAnalysisSupplierItem:
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for supplier upload",
        )
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )
    if not kp_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one KP file is required",
        )
    clean_name = name.strip()
    if await TZAnalysisSupplierDAO.name_exists(
        session, analysis_id, clean_name
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier name already exists",
        )

    order_index = await TZAnalysisSupplierDAO.next_order_index(
        session, analysis_id
    )
    supplier = await TZAnalysisSupplierDAO.create(
        session,
        analysis_id=analysis_id,
        name=clean_name,
        kp_filenames=[],
        order_index=order_index,
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        raw_names = [
            Path(upload.filename or "kp").name.replace("..", "_")
            for upload in kp_files
        ]
        display_names = make_unique_filenames(raw_names)
        kp_paths: list[Path] = []
        for idx, (upload, display_name) in enumerate(
            zip(kp_files, display_names, strict=True),
            start=1,
        ):
            suffix = (
                Path(display_name).suffix.lower()
                or Path(upload.filename or "").suffix.lower()
                or ".bin"
            )
            kp_paths.append(
                await _save_upload(
                    upload,
                    tmp_path,
                    dest_name=f"kp{idx}{suffix}",
                )
            )
        save_supplier_kp_files(analysis_id, supplier.id, kp_paths)

    updated = await TZAnalysisSupplierDAO.update_fields(
        session,
        supplier.id,
        kp_filenames=display_names,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    logger.info(
        "TZ analysis supplier created",
        analysis_id=str(analysis_id),
        supplier_id=str(supplier.id),
        user_id=str(current_user.id),
    )
    return TZAnalysisSupplierItem.model_validate(updated)


@router.patch(
    "/{analysis_id}/suppliers/{supplier_id}/name",
    response_model=TZAnalysisSupplierItem,
    summary="Rename supplier",
)
async def rename_tz_analysis_supplier(
    analysis_id: uuid.UUID,
    supplier_id: uuid.UUID,
    body: TZAnalysisSupplierRenameRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisSupplierItem:
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    _ensure_supplier_mutations_allowed(row)
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )
    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    clean_name = body.name.strip()
    if clean_name != supplier.name and await TZAnalysisSupplierDAO.name_exists(
        session,
        analysis_id,
        clean_name,
        exclude_id=supplier_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier name already exists",
        )
    updated = await TZAnalysisSupplierDAO.update_fields(
        session,
        supplier_id,
        name=clean_name,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    return TZAnalysisSupplierItem.model_validate(updated)


@router.delete(
    "/{analysis_id}/suppliers/{supplier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete supplier",
)
async def delete_tz_analysis_supplier(
    analysis_id: uuid.UUID,
    supplier_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    _ensure_supplier_mutations_allowed(row)
    if row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis already confirmed",
        )
    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    remove_supplier_dir(analysis_id, supplier_id)
    await TZAnalysisSupplierDAO.delete(session, supplier_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{analysis_id}/suppliers/{supplier_id}/files/kp",
    summary="Download supplier KP file by display name",
)
async def download_supplier_kp_file(
    analysis_id: uuid.UUID,
    supplier_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    filename: Annotated[
        str,
        Query(min_length=1, max_length=512, description="KP display filename"),
    ],
) -> FileResponse:
    await _get_owned_analysis(session, analysis_id, current_user.id)
    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    kp_path = resolve_supplier_kp_file_by_display_name(
        analysis_id,
        supplier_id,
        filename.strip(),
        supplier.kp_filenames,
    )
    if not kp_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KP file not found",
        )
    safe_filename = filename.strip()
    return FileResponse(
        path=str(kp_path),
        filename=safe_filename,
        media_type=mime_type_for_filename(safe_filename),
    )


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
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    return await _session_response(session, row)


@router.get(
    "/{analysis_id}/files/tz",
    summary="Download uploaded TZ file",
)
async def download_tz_analysis_file(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> FileResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if not row.tz_filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ file not found",
        )

    tz_path = resolve_tz_only_file(analysis_id)
    if not tz_path or not tz_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ file not found",
        )

    return FileResponse(
        path=str(tz_path),
        filename=row.tz_filename,
        media_type=mime_type_for_filename(row.tz_filename),
    )


@router.get(
    "/{analysis_id}/files/kp",
    summary="Download uploaded KP file by display name",
)
async def download_kp_analysis_file(
    analysis_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    filename: Annotated[
        str,
        Query(min_length=1, max_length=512, description="KP display filename"),
    ],
) -> FileResponse:
    row = await TZAnalysisDAO.get_by_id_and_user(
        session, analysis_id, current_user.id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    kp_path = resolve_kp_file_by_display_name(
        analysis_id,
        filename.strip(),
        row.kp_filenames,
        row.kp_filename,
    )
    if not kp_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="KP file not found",
        )

    safe_filename = filename.strip()
    return FileResponse(
        path=str(kp_path),
        filename=safe_filename,
        media_type=mime_type_for_filename(safe_filename),
    )


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
