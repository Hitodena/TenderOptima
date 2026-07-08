import mimetypes
import uuid
from pathlib import Path
from typing import Annotated
from urllib.parse import unquote

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import (
    get_config_instance,
    get_current_user,
    get_request_or_404,
    get_session,
)
from backend.api.subscriptions.enforcement import (
    ensure_can_search,
    ensure_can_send_emails,
    ensure_module_1_access,
)
from backend.api.user_requests.schemas import (
    Attachment,
    LaunchMailingResponse,
    RequestCloseResponse,
    RequestCreate,
    RequestEmailUpdate,
    RequestResponse,
    RequestUpdate,
    SearchQueuedResponse,
)
from backend.celery_app.tasks.email_tasks import send_emails
from backend.celery_app.tasks.parser_tasks import run_parser_search
from backend.core.config import ALLOWED_CONTENT_TYPES, Config
from backend.db.dao import EmailMessageDAO, RequestDAO, RequestSupplierDAO
from backend.db.models import User
from backend.enums import RequestStatus
from backend.utils.email_utils import build_request_email_body

router = APIRouter(prefix="/requests", tags=["Requests"])


async def _request_responses_with_stats(
    session: AsyncSession,
    requests: list,
) -> list[RequestResponse]:
    """Attach supplier message aggregates to request list rows."""
    if not requests:
        return []
    ids = [r.id for r in requests]
    stats = await EmailMessageDAO.get_message_stats_for_requests(session, ids)
    return [
        RequestResponse.from_model(
            r,
            supplier_messages_total=stats.get(r.id, (0, 0, 0))[0],
            supplier_messages_incoming=stats.get(r.id, (0, 0, 0))[1],
            supplier_messages_unread=stats.get(r.id, (0, 0, 0))[2],
        )
        for r in requests
    ]


def _resolve_and_validate_attachment_path(
    raw_path: str, upload_dir: str
) -> Path | None:
    """Sanitize, handle legacy full paths, return safe Path under upload_dir or None."""
    try:
        decoded = unquote(raw_path)
        p = Path(decoded)
        if "uploads" in p.parts:
            idx = p.parts.index("uploads")
            rel = Path(*p.parts[idx + 1 :])
        else:
            rel = p
        base = Path(upload_dir).resolve()
        candidate = (base / rel).resolve(strict=False)
        if not str(candidate).startswith(str(base)):
            return None
        if candidate.is_file():
            return candidate
        return None
    except Exception:
        return None


@router.post(
    "/",
    response_model=RequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new supplier search request",
)
async def create_request(
    body: RequestCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Create a draft request with query and delivery region."""
    await ensure_module_1_access(session, current_user)
    request = await RequestDAO.create(
        session,
        user_id=current_user.id,
        query=body.query,
        delivery_region=body.delivery_region,
        status=RequestStatus.DRAFT,
    )
    return RequestResponse.model_validate(request)


@router.post(
    "/{request_id}/search",
    response_model=SearchQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue supplier search task",
)
async def search_suppliers(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SearchQueuedResponse:
    """Queue background parser search for an owned request in draft or active status."""
    request = await get_request_or_404(request_id, session, current_user)

    if request.status not in (RequestStatus.DRAFT, RequestStatus.ACTIVE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot search in status '{request.status}'",
        )

    await ensure_can_search(session, current_user)

    await RequestDAO.update_fields(
        session, request_id, status=RequestStatus.SEARCHING.value
    )
    run_parser_search.delay(str(request_id))  # type: ignore
    logger.info("parser.search task queued", request_id=str(request_id))
    return SearchQueuedResponse(
        status="search_queued", request_id=str(request_id)
    )


@router.post(
    "/{request_id}/launch",
    response_model=LaunchMailingResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue email campaign for a request",
)
async def launch_mailing(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LaunchMailingResponse:
    """Queue Celery task to email all pending enabled suppliers for the request."""
    request = await get_request_or_404(request_id, session, current_user)

    pending_count = await RequestSupplierDAO.count_pending(session, request.id)
    if pending_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending suppliers. Run /search first.",
        )

    if request.status == RequestStatus.DRAFT:
        await RequestDAO.update_fields(
            session, request_id, status=RequestStatus.ACTIVE.value
        )
        request = await get_request_or_404(request_id, session, current_user)

    if request.status not in (
        RequestStatus.ACTIVE,
        RequestStatus.COMPLETED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch mailing in status '{request.status}'",
        )

    await ensure_can_send_emails(
        session, current_user, pending_count=pending_count
    )

    send_emails.delay(str(request_id))  # type: ignore
    logger.info("send_emails task queued", request_id=str(request_id))

    await RequestDAO.update_fields(
        session, request.id, status=RequestStatus.QUEUED.value
    )

    return LaunchMailingResponse(
        status=RequestStatus.QUEUED,
        request_id=str(request_id),
        pending=pending_count,
    )


@router.get(
    "/",
    response_model=list[RequestResponse],
    summary="List all requests for the current user",
)
async def get_requests(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RequestResponse]:
    """List all requests owned by the current user, newest first."""
    requests = await RequestDAO.get_all(
        session,
        user_id=current_user.id,
        order_by=RequestDAO.model.created_at.desc(),
    )
    return await _request_responses_with_stats(session, requests)


@router.get(
    "/{request_id}",
    response_model=RequestResponse,
    summary="Retrieve a single request by ID",
)
async def get_request(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Return one request by id if it belongs to the current user."""
    request = await get_request_or_404(request_id, session, current_user)
    rows = await _request_responses_with_stats(session, [request])
    return rows[0]


@router.patch(
    "/{request_id}",
    response_model=RequestResponse,
    summary="Update optional fields and additional parameters for the request email",
)
async def update_request_additional_params(
    request_id: uuid.UUID,
    body: RequestUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Update description and additional_params before mailing."""
    await get_request_or_404(request_id, session, current_user)
    await RequestDAO.update_fields(
        session,
        request_id,
        additional_params=body.additional_params,
        description=body.description,
    )
    updated = await RequestDAO.get_by_id(session, request_id)
    return RequestResponse.model_validate(updated)


@router.post(
    "/{request_id}/attachments",
    response_model=list[Attachment],
    summary="Upload attachments for a request",
)
async def upload_attachments(
    request_id: uuid.UUID,
    files: list[UploadFile],
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
) -> list[Attachment]:
    """Upload one or more files and append their paths to the request."""
    request = await get_request_or_404(request_id, session, current_user)

    if request.status == RequestStatus.QUEUED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload attachments to a queued request",
        )

    if len(files) > config.max_upload_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {config.max_upload_files} files allowed per request",
        )

    upload_dir = Path(config.upload_dir)
    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot create upload directory '{upload_dir}'. Check server configuration.",
        ) from exc

    request_upload_dir = upload_dir / str(request_id)
    try:
        request_upload_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cannot create request upload directory '{request_upload_dir}'. Check server configuration.",
        ) from exc

    results: list[Attachment] = []
    existing_paths = request.attachment_paths or []

    for file in files:
        if file.size and file.size > config.max_upload_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds max upload size",
            )

        if (
            file.content_type
            and file.content_type not in ALLOWED_CONTENT_TYPES
        ):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type {file.content_type} not supported",
            )

        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_417_EXPECTATION_FAILED,
                detail="File name not found",
            )

        safe_filename = Path(file.filename).name.replace("..", "_")
        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
        file_path = request_upload_dir / unique_filename

        content = await file.read()
        file_path.write_bytes(content)

        attachment_info = Attachment(
            filename=safe_filename,
            content_type=file.content_type,
            size=len(content),
            path=str(file_path),
        )
        results.append(attachment_info)
        existing_paths.append(str(file_path))

    await RequestDAO.update_fields(
        session, request_id, attachment_paths=existing_paths
    )

    logger.info(
        "Attachments uploaded",
        request_id=str(request_id),
        count=len(results),
        user_id=str(current_user.id),
    )

    return results


@router.get(
    "/attachments/serve",
    summary="Download a private attachment",
)
async def serve_attachment(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
    attachment_path: str = Query(
        ..., description="Stored attachment path (full or relative)"
    ),
) -> FileResponse:
    """Stream an attachment file after path sanitization and ownership check."""
    candidate = _resolve_and_validate_attachment_path(
        attachment_path, config.upload_dir
    )
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    try:
        rel = Path(unquote(attachment_path))
        if "uploads" in rel.parts:
            idx = rel.parts.index("uploads")
            req_part = rel.parts[idx + 1]
        else:
            req_part = rel.parts[0]
        request_id = uuid.UUID(str(req_part))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attachment path",
        ) from None

    await get_request_or_404(request_id, session, current_user)

    filename = candidate.name
    media_type = (
        mimetypes.guess_type(filename)[0] or "application/octet-stream"
    )
    return FileResponse(
        path=str(candidate),
        filename=filename,
        media_type=media_type,
    )


@router.patch(
    "/{request_id}/email_message",
    response_model=RequestResponse,
    summary="Update email message for a request",
)
async def update_request_email_message(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    email_update: RequestEmailUpdate,
) -> RequestResponse:
    """Persist edited email subject/body or regenerate body from request data."""
    request = await get_request_or_404(request_id, session, current_user)

    if email_update.email_subject:
        await RequestDAO.update_fields(
            session, request_id, email_subject=email_update.email_subject
        )

    email_message = (
        email_update.email_message
        if email_update.email_message is not None
        else build_request_email_body(request, current_user)
    )
    await RequestDAO.update_fields(
        session,
        request_id,
        email_message=email_message,
    )

    updated = await RequestDAO.get_by_id(session, request_id)
    return RequestResponse.model_validate(updated)


@router.post(
    "/{request_id}/close",
    response_model=RequestCloseResponse,
    summary="Close a request",
)
async def close_request(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestCloseResponse:
    """Set request status to closed; rejects already closed requests."""
    request = await get_request_or_404(request_id, session, current_user)
    if request.status == RequestStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request already closed",
        )
    await RequestDAO.update_fields(
        session, request_id, status=RequestStatus.CLOSED.value
    )
    return RequestCloseResponse(id=request_id)
