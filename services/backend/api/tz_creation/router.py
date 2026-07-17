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
from fastapi.responses import Response
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_session
from backend.api.subscriptions.enforcement import (
    ensure_can_process_pages,
    ensure_module_2_work_allowed,
    tz_kp_upload_limit_for_user,
)
from backend.api.tz_creation.schemas import (
    TZCreationContextPayload,
    TZCreationExportRequest,
    TZCreationFieldsUpdateRequest,
    TZCreationFinalizeResponse,
    TZCreationHierarchyUpdateRequest,
    TZCreationHistoryPageResponse,
    TZCreationMessageItem,
    TZCreationMessageRequest,
    TZCreationSessionCreateRequest,
    TZCreationSessionDetailResponse,
    TZCreationSessionListItem,
)
from backend.celery_app.tasks.tz_creation_tasks import (
    run_tz_creation_extract as queue_tz_creation_extract,
)
from backend.core.config import get_config
from backend.db.dao import (
    TZAnalysisDAO,
    TZCreationMessageDAO,
    TZCreationSessionDAO,
)
from backend.db.models import User
from backend.enums import (
    TZAnalysisRunStatus,
    TZCreationMessageRole,
    TZCreationMode,
    TZCreationStatus,
)
from backend.services.analysis.tz_creation import (
    apply_turn_result,
    run_chat_turn,
    run_kickoff_turn,
)
from backend.services.analysis.tz_creation_docx import (
    DEFAULT_TITLE,
    build_tz_creation_docx,
)
from backend.utils.page_count import count_pages_in_file
from backend.utils.requirements_struct import (
    count_requirements,
    normalize_tz_requirements,
    requirements_nonempty,
)
from backend.utils.tz_storage import save_tz_creation_file

router = APIRouter(prefix="/tz-creation", tags=["TZ Creation"])
config = get_config()

_DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)


async def _get_owned_session(
    session: AsyncSession,
    session_id: uuid.UUID,
    user_id: uuid.UUID,
):
    row = await TZCreationSessionDAO.get_by_id_and_user(
        session, session_id, user_id
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ creation session not found",
        )
    return row


def _ensure_message_quota(row) -> None:
    limit = config.tz_creation_max_messages_per_session
    if row.messages_used >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "tz_creation_message_limit",
                "limit": limit,
                "used": row.messages_used,
                "message": "Достигнут лимит сообщений в конструкторе ТЗ",
            },
        )


async def _session_response(
    session: AsyncSession,
    row,
) -> TZCreationSessionDetailResponse:
    messages = await TZCreationMessageDAO.list_by_session(session, row.id)
    return TZCreationSessionDetailResponse(
        id=row.id,
        mode=TZCreationMode(row.mode),
        title=row.title or "",
        context=TZCreationContextPayload(**(row.context or {})),
        source_tz_filename=row.source_tz_filename,
        draft_hierarchy=normalize_tz_requirements(row.draft_hierarchy),
        fields=list(row.fields or []),
        status=TZCreationStatus(row.status),
        llm_model=row.llm_model or "",
        messages_used=row.messages_used,
        messages_limit=config.tz_creation_max_messages_per_session,
        resulting_tz_analysis_id=row.resulting_tz_analysis_id,
        created_at=row.created_at,
        messages=[
            TZCreationMessageItem.model_validate(message)
            for message in messages
        ],
    )


@router.post(
    "/",
    response_model=TZCreationSessionDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a TZ creation wizard session",
)
async def create_tz_creation_session(
    body: TZCreationSessionCreateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    """Start a wizard session in either mode.

    ``from_scratch`` sessions are immediately active and wait for the
    user's first chat message (the idea seed). ``refine_existing``
    sessions stay in ``draft`` until a TZ file is uploaded.
    """
    await ensure_module_2_work_allowed(session, current_user)

    initial_status = (
        TZCreationStatus.ACTIVE.value
        if body.mode == TZCreationMode.FROM_SCRATCH
        else TZCreationStatus.DRAFT.value
    )
    row = await TZCreationSessionDAO.create(
        session,
        user_id=current_user.id,
        mode=body.mode.value,
        title=body.title.strip(),
        context=body.context.model_dump(),
        source_tz_filename=None,
        draft_hierarchy={},
        fields=[],
        status=initial_status,
        llm_model="",
        messages_used=0,
        resulting_tz_analysis_id=None,
    )
    logger.info(
        "TZ creation session created",
        session_id=str(row.id),
        user_id=str(current_user.id),
        mode=body.mode.value,
    )
    return await _session_response(session, row)


@router.post(
    "/{session_id}/upload",
    response_model=TZCreationSessionDetailResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload an existing TZ and queue extraction + gap analysis",
)
async def upload_tz_creation_source(
    session_id: uuid.UUID,
    tz_file: Annotated[
        UploadFile, File(description="Existing technical specification")
    ],
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    row = await _get_owned_session(session, session_id, current_user.id)
    if row.mode != TZCreationMode.REFINE_EXISTING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload is only available for the 'refine_existing' mode",
        )
    if row.status not in (
        TZCreationStatus.DRAFT.value,
        TZCreationStatus.FAILED.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload for session in status '{row.status}'",
        )

    await ensure_module_2_work_allowed(session, current_user)
    upload_limit = await tz_kp_upload_limit_for_user(
        session, current_user, config
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        if not tz_file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File name is required",
            )
        data = await tz_file.read()
        if len(data) > upload_limit:
            limit_mb = upload_limit // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum size of {limit_mb} MB",
            )
        safe_name = Path(tz_file.filename).name.replace("..", "_")
        tz_path = tmp_path / safe_name
        tz_path.write_bytes(data)

        page_count = count_pages_in_file(tz_path)
        await ensure_can_process_pages(
            session, current_user, page_count=max(page_count, 1)
        )

        updated = await TZCreationSessionDAO.update_fields(
            session,
            row.id,
            source_tz_filename=safe_name,
            status=TZCreationStatus.PROCESSING.value,
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TZ creation session not found",
            )
        save_tz_creation_file(row.id, tz_path)

    queue_tz_creation_extract.delay(str(row.id))  # type: ignore[attr-defined]
    logger.info(
        "TZ creation extract queued",
        session_id=str(row.id),
        user_id=str(current_user.id),
    )
    refreshed = await _get_owned_session(session, session_id, current_user.id)
    return await _session_response(session, refreshed)


@router.post(
    "/{session_id}/messages",
    response_model=TZCreationSessionDetailResponse,
    summary="Send a chat message and run a wizard turn",
)
async def send_tz_creation_message(
    session_id: uuid.UUID,
    body: TZCreationMessageRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    row = await _get_owned_session(session, session_id, current_user.id)
    if row.status != TZCreationStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not ready for chat in status '{row.status}'",
        )
    _ensure_message_quota(row)

    prior_messages = await TZCreationMessageDAO.list_by_session(
        session, row.id
    )
    is_first_from_scratch = (
        row.messages_used == 0
        and row.mode == TZCreationMode.FROM_SCRATCH.value
    )

    message_text = body.message.strip()
    if is_first_from_scratch:
        result = await run_kickoff_turn(message_text, row.context)
    else:
        history = [
            {"role": message.role, "content": message.content}
            for message in prior_messages
        ]
        result = await run_chat_turn(
            row.draft_hierarchy,
            list(row.fields or []),
            message_text,
            row.context,
            history=history,
        )

    hierarchy, fields = apply_turn_result(
        draft_hierarchy=row.draft_hierarchy,
        fields=list(row.fields or []),
        result=result,
    )

    await TZCreationMessageDAO.create(
        session,
        session_id=row.id,
        role=TZCreationMessageRole.USER.value,
        content=message_text,
    )
    await TZCreationMessageDAO.create(
        session,
        session_id=row.id,
        role=TZCreationMessageRole.ASSISTANT.value,
        content=result["assistant_message"],
    )
    updated = await TZCreationSessionDAO.update_fields(
        session,
        row.id,
        draft_hierarchy=hierarchy,
        fields=fields,
        messages_used=row.messages_used + 1,
        llm_model=config.openai_model_for_tz_create(),
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ creation session not found",
        )
    logger.info(
        "TZ creation turn completed",
        session_id=str(row.id),
        user_id=str(current_user.id),
        messages_used=updated.messages_used,
    )
    return await _session_response(session, updated)


@router.patch(
    "/{session_id}/hierarchy",
    response_model=TZCreationSessionDetailResponse,
    summary="Manually edit the draft TZ outline",
)
async def update_tz_creation_hierarchy(
    session_id: uuid.UUID,
    body: TZCreationHierarchyUpdateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    row = await _get_owned_session(session, session_id, current_user.id)
    updated = await TZCreationSessionDAO.update_fields(
        session,
        row.id,
        draft_hierarchy=body.draft_hierarchy,
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ creation session not found",
        )
    return await _session_response(session, updated)


@router.patch(
    "/{session_id}/fields",
    response_model=TZCreationSessionDetailResponse,
    summary="Manually edit the side panel parameters",
)
async def update_tz_creation_fields(
    session_id: uuid.UUID,
    body: TZCreationFieldsUpdateRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    row = await _get_owned_session(session, session_id, current_user.id)
    updated = await TZCreationSessionDAO.update_fields(
        session,
        row.id,
        fields=[field.model_dump() for field in body.fields],
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TZ creation session not found",
        )
    return await _session_response(session, updated)


@router.get(
    "/",
    response_model=list[TZCreationSessionListItem],
    summary="List TZ creation sessions for current user",
)
async def list_tz_creation_sessions(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[TZCreationSessionListItem]:
    rows = await TZCreationSessionDAO.get_by_user(session, current_user.id)
    return [TZCreationSessionListItem.model_validate(row) for row in rows]


@router.get(
    "/history",
    response_model=TZCreationHistoryPageResponse,
    summary="Paginated TZ creation session history",
)
async def get_tz_creation_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> TZCreationHistoryPageResponse:
    rows, has_more = await TZCreationSessionDAO.get_history_page_by_user(
        session, current_user.id, page=page, size=size
    )
    return TZCreationHistoryPageResponse(
        items=[TZCreationSessionListItem.model_validate(row) for row in rows],
        page=page,
        size=size,
        has_more=has_more,
    )


@router.post(
    "/export-preview.docx",
    summary="Export an arbitrary title + outline as a numbered .docx table",
)
async def export_tz_creation_preview_docx(
    body: TZCreationExportRequest,
) -> Response:
    """Stateless export, usable even before a wizard session exists."""
    docx_bytes = build_tz_creation_docx(body.title, body.requirements_tz)
    filename = "tz.docx"
    return Response(
        content=docx_bytes,
        media_type=_DOCX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/{session_id}",
    response_model=TZCreationSessionDetailResponse,
    summary="Get TZ creation session by id",
)
async def get_tz_creation_session(
    session_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationSessionDetailResponse:
    row = await _get_owned_session(session, session_id, current_user.id)
    return await _session_response(session, row)


@router.get(
    "/{session_id}/export.docx",
    summary="Export the current draft outline as a numbered .docx table",
)
async def export_tz_creation_docx(
    session_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    row = await _get_owned_session(session, session_id, current_user.id)
    docx_bytes = build_tz_creation_docx(
        row.title or DEFAULT_TITLE,
        normalize_tz_requirements(row.draft_hierarchy),
    )
    filename = f"tz_creation_{session_id}.docx"
    return Response(
        content=docx_bytes,
        media_type=_DOCX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{session_id}/finalize",
    response_model=TZCreationFinalizeResponse,
    summary="Finalize the wizard into a TZAnalysis usable for KP comparison",
)
async def finalize_tz_creation_session(
    session_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TZCreationFinalizeResponse:
    """Create a normal confirmed ``TZAnalysis`` row from the draft outline.

    The result appears in the regular ``/tz-analysis`` list/history like
    any uploaded TZ, so the user can pick it there to compare against
    supplier КП without any extra "selection" UI.
    """
    row = await _get_owned_session(session, session_id, current_user.id)
    if row.status != TZCreationStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot finalize session in status '{row.status}'",
        )
    hierarchy = normalize_tz_requirements(row.draft_hierarchy)
    if not requirements_nonempty(hierarchy):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one TZ requirement is required",
        )

    title = row.title.strip() or DEFAULT_TITLE
    llm_model = row.llm_model or config.openai_model_for_tz_create()
    tz_analysis = await TZAnalysisDAO.create(
        session,
        user_id=current_user.id,
        title=title,
        tz_filename=None,
        kp_filename=None,
        kp_filenames=[],
        confirmed=True,
        requirements_tz=hierarchy,
        requirements_kp={},
        kp_stats={},
        items=[],
        items_overrides={},
        match_score=0,
        met_count=0,
        partial_count=0,
        missing_count=0,
        not_found_count=0,
        tz_requirements_count=count_requirements(hierarchy),
        llm_model=llm_model,
        status=TZAnalysisRunStatus.ACTIVE.value,
    )
    await TZCreationSessionDAO.update_fields(
        session,
        row.id,
        status=TZCreationStatus.COMPLETED.value,
        resulting_tz_analysis_id=tz_analysis.id,
    )
    logger.info(
        "TZ creation session finalized",
        session_id=str(row.id),
        tz_analysis_id=str(tz_analysis.id),
        user_id=str(current_user.id),
    )
    return TZCreationFinalizeResponse(tz_analysis_id=tz_analysis.id)
