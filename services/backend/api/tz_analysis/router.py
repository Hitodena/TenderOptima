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
from fastapi.responses import FileResponse, Response
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_session
from backend.api.subscriptions.enforcement import (
    ensure_can_process_pages,
    ensure_module_2_work_allowed,
    tz_kp_upload_limit_for_user,
)
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
    TZItemsOverridesRequest,
    TZPrimaryKpRequest,
    TZRequirementsUpdateRequest,
    TZSupplierPrimaryKpRequest,
    row_to_session,
)
from backend.celery_app.tasks.analysis_tasks import (
    run_supplier_kp_process as queue_supplier_kp_process,
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
from backend.enums import (
    TZAnalysisHistoryGroup,
    TZAnalysisRunStatus,
    TZAnalysisSupplierStatus,
)
from backend.schemas.analysis import (
    TZAnalysisItem,
    apply_items_overrides,
    build_analysis_stats,
)
from backend.services.analysis.docx_export import (
    build_clarification_docx,
    build_clarification_docx_from_paragraphs,
    build_clarification_preview,
)
from backend.utils.page_count import count_pages_in_file, count_pages_in_files
from backend.utils.requirements_struct import (
    count_requirements,
    normalize_tz_requirements,
    requirements_nonempty,
)
from backend.utils.tz_storage import (
    flatten_supplier_kp_entries,
    make_unique_filenames,
    mime_type_for_filename,
    purge_supplier_kp_from_analysis,
    remove_supplier_dir,
    resolve_kp_file_by_display_name,
    resolve_scoped_supplier_kp_file,
    resolve_supplier_kp_file_by_display_name,
    resolve_supplier_kp_files,
    resolve_tz_only_file,
    save_kp_analysis_files,
    save_supplier_kp_files,
    save_tz_only_file,
)
from backend.utils.xlsx_export import (
    build_tz_analysis_workbook,
    workbook_to_bytes,
)

router = APIRouter(prefix="/tz-analysis", tags=["TZ Analysis"])
config = get_config()


def _ensure_supplier_mutations_allowed(row) -> None:
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is closed for supplier changes",
        )


def _suppliers_awaiting_kp_run(suppliers: list) -> list:
    """Suppliers that still need KP extraction and comparison."""
    runnable = {
        TZAnalysisSupplierStatus.PENDING.value,
        TZAnalysisSupplierStatus.FAILED.value,
    }
    return [
        supplier
        for supplier in suppliers
        if supplier.kp_filenames and supplier.status in runnable
    ]


def _validate_supplier_kp_files(
    analysis_id: uuid.UUID,
    suppliers: list,
) -> None:
    for supplier in suppliers:
        paths = resolve_supplier_kp_files(analysis_id, supplier.id)
        if not paths or len(supplier.kp_filenames) != len(paths):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each supplier must have at least one KP file",
            )


async def _queue_supplier_kp_tasks(
    session: AsyncSession,
    analysis_id: uuid.UUID,
    suppliers: list,
) -> None:
    for supplier in suppliers:
        await TZAnalysisSupplierDAO.update_fields(
            session,
            supplier.id,
            status=TZAnalysisSupplierStatus.PROCESSING.value,
        )
        queue_supplier_kp_process.delay(
            str(analysis_id),
            str(supplier.id),
        )
        logger.info(
            "Supplier KP process queued",
            analysis_id=str(analysis_id),
            supplier_id=str(supplier.id),
        )


async def _run_kp_for_suppliers(
    session: AsyncSession,
    row,
    suppliers_to_run: list,
    current_user: User,
) -> None:
    page_total = 0
    if not row.tz_pages_count:
        tz_path = resolve_tz_only_file(row.id)
        if tz_path:
            page_total += count_pages_in_file(tz_path)
    for supplier in suppliers_to_run:
        paths = resolve_supplier_kp_files(row.id, supplier.id)
        page_total += count_pages_in_files(paths)
    await ensure_can_process_pages(
        session,
        current_user,
        page_count=max(page_total, 1),
    )
    _validate_supplier_kp_files(row.id, suppliers_to_run)
    supplier_entries: list[tuple[str, list[str], list[Path]]] = []
    for supplier in suppliers_to_run:
        paths = resolve_supplier_kp_files(row.id, supplier.id)
        supplier_entries.append(
            (supplier.name, list(supplier.kp_filenames), paths)
        )
    kp_payload = flatten_supplier_kp_entries(supplier_entries)
    new_kp_names = [name for name, _ in kp_payload]
    merged_filenames = list(row.kp_filenames or [])
    for name in new_kp_names:
        if name not in merged_filenames:
            merged_filenames.append(name)
    updated = await TZAnalysisDAO.update_fields(
        session,
        row.id,
        kp_filenames=merged_filenames,
        kp_filename=row.kp_filename
        or (new_kp_names[0] if new_kp_names else None),
        status=TZAnalysisRunStatus.ACTIVE.value,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    await _queue_supplier_kp_tasks(session, row.id, suppliers_to_run)


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
    limit: int,
    dest_name: str | None = None,
) -> Path:
    if not upload.filename and not dest_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is required",
        )
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
    await ensure_module_2_work_allowed(session, current_user)
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
        items_overrides={},
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
    if row.status not in (
        TZAnalysisRunStatus.DRAFT.value,
        TZAnalysisRunStatus.FAILED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run analysis in status '{row.status}'",
        )

    await ensure_module_2_work_allowed(session, current_user)

    upload_limit = await tz_kp_upload_limit_for_user(
        session, current_user, config
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        tz_path = await _save_upload(
            tz_file,
            tmp_path,
            limit=upload_limit,
        )
        tz_name = tz_file.filename or tz_path.name
        page_count = count_pages_in_file(tz_path)
        await ensure_can_process_pages(
            session,
            current_user,
            page_count=max(page_count, 1),
        )

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
    if not requirements_nonempty(row.requirements_tz):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )
    if not row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm TZ requirements before KP analysis",
        )

    suppliers = await TZAnalysisSupplierDAO.list_by_analysis(session, row.id)
    use_supplier_tasks = bool(suppliers)
    if suppliers:
        suppliers_to_run = _suppliers_awaiting_kp_run(suppliers)
        if not suppliers_to_run:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No new suppliers to analyze",
            )
        await _run_kp_for_suppliers(
            session, row, suppliers_to_run, current_user
        )
    else:
        uploads = kp_files or []
        if not uploads:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one KP file or supplier is required",
            )
        upload_limit = await tz_kp_upload_limit_for_user(
            session, current_user, config
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
                    limit=upload_limit,
                    dest_name=f"kp{idx}{suffix}",
                )
                kp_paths.append(kp_path)
            page_total = count_pages_in_files(kp_paths)
            if not row.tz_pages_count:
                tz_path = resolve_tz_only_file(row.id)
                if tz_path:
                    page_total += count_pages_in_file(tz_path)
            await ensure_can_process_pages(
                session,
                current_user,
                page_count=max(page_total, 1),
            )
            primary_kp = kp_names[0] if kp_names else None

            updated = await TZAnalysisDAO.update_fields(
                session,
                row.id,
                kp_filename=primary_kp,
                kp_filenames=kp_names,
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
        supplier_tasks=use_supplier_tasks,
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


def _is_export_ready(status: str, confirmed: bool, *, has_items: bool) -> bool:
    return (
        status
        in (
            TZAnalysisRunStatus.ACTIVE.value,
            TZAnalysisRunStatus.COMPLETED.value,
        )
        and confirmed
        and has_items
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


@router.patch(
    "/{analysis_id}/items-overrides",
    response_model=TZAnalysisDetailResponse,
    summary="Update manual status overrides for comparison items",
)
async def update_items_overrides(
    analysis_id: uuid.UUID,
    body: TZItemsOverridesRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    if row.status not in (
        TZAnalysisRunStatus.ACTIVE.value,
        TZAnalysisRunStatus.COMPLETED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for item overrides",
        )
    merged = dict(getattr(row, "items_overrides", None) or {})
    merged.update(body.overrides)
    items = apply_items_overrides(
        [TZAnalysisItem(**item) for item in (row.items or [])],
        merged,
    )
    kp_filenames = list(row.kp_filenames or [])
    if not kp_filenames and row.kp_filename:
        kp_filenames = [row.kp_filename]
    kp_stats, primary_kp, top_stats = build_analysis_stats(
        items,
        kp_filenames,
        row.kp_filename,
    )
    updated = await TZAnalysisDAO.update_fields(
        session,
        analysis_id,
        items_overrides=merged,
        kp_stats=kp_stats,
        kp_filename=primary_kp or row.kp_filename,
        match_score=top_stats["match_score"],
        met_count=top_stats["met_count"],
        partial_count=top_stats["partial_count"],
        missing_count=top_stats["missing_count"],
        not_found_count=top_stats["not_found_count"],
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    logger.info(
        "TZ items overrides updated",
        analysis_id=str(analysis_id),
        user_id=str(current_user.id),
        count=len(body.overrides),
    )
    return await _session_response(session, updated)


@router.post(
    "/{analysis_id}/confirm",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm TZ requirements and unlock KP upload",
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
    if not requirements_nonempty(requirements_tz):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )

    updated = await TZAnalysisDAO.update_fields(
        session,
        row.id,
        requirements_tz=requirements_tz,
        tz_requirements_count=count_requirements(requirements_tz),
        confirmed=True,
        status=TZAnalysisRunStatus.ACTIVE.value,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )

    logger.info(
        "TZ requirements confirmed",
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
    _ensure_supplier_mutations_allowed(row)
    if not row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm TZ requirements before uploading KP",
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
        status=TZAnalysisSupplierStatus.PENDING.value,
    )

    upload_limit = await tz_kp_upload_limit_for_user(
        session, current_user, config
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
                    limit=upload_limit,
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


@router.post(
    "/{analysis_id}/suppliers/{supplier_id}/run-kp",
    response_model=TZAnalysisDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue KP analysis for a single supplier",
)
async def run_tz_supplier_kp_analysis(
    analysis_id: uuid.UUID,
    supplier_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    """Run KP extraction and comparison for one supplier only."""
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for KP upload",
        )
    if not requirements_nonempty(row.requirements_tz):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )
    if not row.confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirm TZ requirements before KP analysis",
        )

    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    runnable = {
        TZAnalysisSupplierStatus.PENDING.value,
        TZAnalysisSupplierStatus.FAILED.value,
    }
    if not supplier.kp_filenames or supplier.status not in runnable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier is not ready for KP analysis",
        )

    await _run_kp_for_suppliers(session, row, [supplier], current_user)

    logger.info(
        "TZ supplier KP compare queued",
        analysis_id=str(analysis_id),
        supplier_id=str(supplier_id),
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


@router.patch(
    "/{analysis_id}/suppliers/{supplier_id}/primary-kp",
    response_model=TZAnalysisDetailResponse,
    summary="Set primary KP for a supplier",
)
async def set_supplier_primary_kp(
    analysis_id: uuid.UUID,
    supplier_id: uuid.UUID,
    body: TZSupplierPrimaryKpRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZAnalysisDetailResponse:
    row = await _get_owned_analysis(session, analysis_id, current_user.id)
    if row.status not in (
        TZAnalysisRunStatus.ACTIVE.value,
        TZAnalysisRunStatus.COMPLETED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for primary KP selection",
        )
    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    kp_filename = body.kp_filename.strip()
    if kp_filename not in (supplier.kp_filenames or []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid primary KP",
        )
    updated = await TZAnalysisSupplierDAO.update_fields(
        session,
        supplier_id,
        primary_kp_filename=kp_filename,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    logger.info(
        "Supplier primary KP updated",
        analysis_id=str(analysis_id),
        supplier_id=str(supplier_id),
        kp_filename=kp_filename,
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
    supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
        session, supplier_id, analysis_id
    )
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )
    if supplier.status == TZAnalysisSupplierStatus.PROCESSING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supplier KP is processing",
        )

    purged = purge_supplier_kp_from_analysis(
        supplier_name=supplier.name,
        kp_filenames=list(row.kp_filenames or []),
        requirements_kp=dict(row.requirements_kp or {}),
        kp_stats=dict(row.kp_stats or {}),
        items=list(row.items or []),
        kp_filename=row.kp_filename,
    )
    items_models = [TZAnalysisItem(**item) for item in purged["items"]]
    kp_stats, primary_kp, top_stats = build_analysis_stats(
        items_models,
        purged["kp_filenames"],
        purged["kp_filename"],
    )
    remove_supplier_dir(analysis_id, supplier_id)
    await TZAnalysisSupplierDAO.delete(session, supplier_id)
    await TZAnalysisDAO.update_fields(
        session,
        analysis_id,
        kp_filename=primary_kp or purged["kp_filename"],
        kp_filenames=purged["kp_filenames"],
        requirements_kp=purged["requirements_kp"],
        kp_stats=kp_stats,
        items=purged["items"],
        match_score=top_stats["match_score"],
        met_count=top_stats["met_count"],
        partial_count=top_stats["partial_count"],
        missing_count=top_stats["missing_count"],
        not_found_count=top_stats["not_found_count"],
    )
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
        suppliers = await TZAnalysisSupplierDAO.list_by_analysis(
            session, analysis_id
        )
        supplier_entries = [
            (supplier.id, supplier.name, supplier.kp_filenames)
            for supplier in suppliers
        ]
        kp_path = resolve_scoped_supplier_kp_file(
            analysis_id,
            filename.strip(),
            supplier_entries,
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
    "/{analysis_id}/export.xlsx",
    summary="Export TZ analysis as XLSX",
)
async def export_tz_analysis_xlsx(
    analysis_id: uuid.UUID,
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
    if not _is_export_ready(
        row.status,
        bool(row.confirmed),
        has_items=bool(row.items),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for export",
        )

    items = apply_items_overrides(
        [TZAnalysisItem(**item) for item in (row.items or [])],
        getattr(row, "items_overrides", None),
    )
    wb = build_tz_analysis_workbook(items, STATUS_LABELS)

    filename = f"tz_analysis_{analysis_id}.xlsx"
    return Response(
        content=workbook_to_bytes(wb),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
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
    if not _is_export_ready(
        row.status,
        bool(row.confirmed),
        has_items=bool(row.items),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for preview",
        )

    items = apply_items_overrides(
        [TZAnalysisItem(**item) for item in (row.items or [])],
        getattr(row, "items_overrides", None),
    )
    if not body.selected_indices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one item",
        )

    title, paragraphs, has_issues = build_clarification_preview(
        items=items,
        selected_indices=body.selected_indices,
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
    if not _is_export_ready(
        row.status,
        bool(row.confirmed),
        has_items=bool(row.items),
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for export",
        )

    items = apply_items_overrides(
        [TZAnalysisItem(**item) for item in (row.items or [])],
        getattr(row, "items_overrides", None),
    )
    if not body.selected_indices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select at least one item",
        )

    if body.paragraphs:
        docx_bytes = build_clarification_docx_from_paragraphs(body.paragraphs)
    else:
        docx_bytes = build_clarification_docx(
            items=items,
            selected_indices=body.selected_indices,
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
