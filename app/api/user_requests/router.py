import uuid
from pathlib import Path
from typing import Annotated
from urllib.parse import unquote, urlparse

import httpx
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

from app.api.deps import get_config_instance, get_current_user, get_session
from app.api.user_requests.schemas import (
    Attachment,
    EmailMessageResponse,
    LaunchMailingResponse,
    Message,
    ParserResult,
    ReplyPayload,
    RequestCloseResponse,
    RequestCreate,
    RequestEmailUpdate,
    RequestResponse,
    RequestSupplierResponse,
    RequestUpdate,
    SearchResult,
    SupplierRemoveResponse,
    SupplierResponse,
    ThreadSummary,
    ToggleSupplierRequest,
)
from app.celery_app.tasks.email_tasks import send_emails, send_reply
from app.core.config import ALLOWED_CONTENT_TYPES, Config
from app.db.dao import (
    BlacklistedDomainDAO,
    EmailMessageDAO,
    RequestDAO,
    RequestSupplierDAO,
    SearchHistoryDAO,
    SupplierDAO,
)
from app.db.models import User
from app.enums import (
    RequestStatus,
    RequestSupplierStatus,
)
from app.utils.email_utils import build_request_email_body

router = APIRouter(prefix="/requests", tags=["Requests"])


def _extract_domain(raw: str) -> str:
    parsed = urlparse(raw)
    host = parsed.netloc or parsed.path
    return host.removeprefix("www.")


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
    responses={
        201: {"description": "Request successfully created in draft status"},
        401: {"description": "Missing or invalid authentication credentials"},
        422: {"description": "Validation error in request payload"},
    },
)
async def create_request(
    body: RequestCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Creates a new request in 'draft' status. The request can later be searched and mailed."""  # noqa: E501
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
    response_model=SearchResult,
    summary="Search for suppliers and save results",
    responses={
        200: {"description": "Search completed and suppliers saved"},
        400: {"description": "Request is not in a searchable state"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
        502: {"description": "External parser service unavailable"},
    },
)
async def search_suppliers(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
) -> SearchResult:
    """Runs an external parser search, filters blacklisted domains, and saves valid suppliers."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    if request.status not in (RequestStatus.DRAFT, RequestStatus.ACTIVE):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot search in status '{request.status}'",
        )

    parser_query = request.query
    if request.delivery_region:
        parser_query = f"{parser_query} {request.delivery_region}"

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                config.parser_url,
                json={
                    "query": parser_query,
                    "elements": 5,
                    "user_id": str(current_user.id),
                    "region": request.delivery_region,
                },
            )
            resp.raise_for_status()
            raw_results: list[dict] = resp.json().get("results", [])
    except httpx.HTTPError as exc:
        logger.exception("Parser service error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Parser service unavailable",
        ) from exc

    results = [ParserResult(**r) for r in raw_results]
    logger.info(
        "Parser returned results",
        count=len(results),
        request_id=str(request_id),
    )

    blacklisted = await BlacklistedDomainDAO.get_domains_set(
        session, current_user.id
    )

    saved = 0
    skipped_blacklisted = 0
    skipped_no_email = 0

    for result in results:
        domain = _extract_domain(result.domain)

        if domain in blacklisted:
            logger.debug("Domain blacklisted, skipping", domain=domain)
            skipped_blacklisted += 1
            continue

        if not result.emails:
            logger.debug("No emails found, skipping", domain=domain)
            skipped_no_email += 1
            continue

        supplier = await SupplierDAO.get_or_create_by_domain(
            session,
            domain=domain,
            defaults={
                "company_name": result.page_title or domain,
                "email": result.emails[0],
                "from_source": result.engine,
            },
        )

        existing = await RequestSupplierDAO.get_by_request_and_supplier(
            session, request_id=request.id, supplier_id=supplier.id
        )
        if not existing:
            await RequestSupplierDAO.create(
                session,
                request_id=request.id,
                supplier_id=supplier.id,
                sent_to_email=result.emails[0],
                status=RequestSupplierStatus.PENDING,
                smtp_message_id=None,
            )
            saved += 1

    await SearchHistoryDAO.create(
        session,
        user_id=current_user.id,
        query=parser_query,
        raw_search_body={"results": raw_results},
        results_count=len(results),
        request_id=request.id,
    )

    await RequestDAO.update_status(session, request.id, RequestStatus.ACTIVE)

    logger.info(
        "Search done",
        request_id=str(request_id),
        saved=saved,
        skipped_blacklisted=skipped_blacklisted,
        skipped_no_email=skipped_no_email,
    )
    return SearchResult(
        saved_suppliers=saved,
        skipped_blacklisted=skipped_blacklisted,
        skipped_no_email=skipped_no_email,
        request_id=request.id,
    )


@router.post(
    "/{request_id}/launch",
    response_model=LaunchMailingResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue email campaign for a request",
    responses={
        202: {"description": "Mailing task successfully queued"},
        400: {
            "description": "Request not in active state or no pending suppliers"  # noqa: E501
        },
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def launch_mailing(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> LaunchMailingResponse:
    """Queues a background task to send emails to all pending suppliers for this request."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    pending_count = await RequestSupplierDAO.count_pending(session, request.id)
    if pending_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending suppliers. Run /search first.",
        )

    if request.status == RequestStatus.DRAFT:
        await RequestDAO.update_status(
            session, request_id, status=RequestStatus.ACTIVE
        )

    if request.status != RequestStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch mailing in status '{request.status}'",
        )

    send_emails.delay(str(request_id))  # type: ignore
    logger.info("send_emails task queued", request_id=str(request_id))

    await RequestDAO.update_status(session, request.id, RequestStatus.QUEUED)

    return LaunchMailingResponse(
        status=RequestStatus.QUEUED,
        request_id=str(request_id),
        pending=pending_count,
    )


@router.get(
    "/",
    response_model=list[RequestResponse],
    summary="List all requests for the current user",
    responses={
        200: {"description": "List of all requests belonging to the user"},
        401: {"description": "Missing or invalid authentication credentials"},
    },
)
async def get_requests(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RequestResponse]:
    """Returns all requests created by the authenticated user."""
    requests = await RequestDAO.get_all_by_user(session, current_user.id)
    return [RequestResponse.model_validate(r) for r in requests]


@router.get(
    "/{request_id}",
    response_model=RequestResponse,
    summary="Retrieve a single request by ID",
    responses={
        200: {"description": "Request details returned"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def get_request(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Fetches a specific request if it belongs to the current user."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    return RequestResponse.model_validate(request)


@router.get(
    "/{request_id}/responses",
    response_model=list[EmailMessageResponse],
    summary="List supplier responses for a request",
    responses={
        200: {
            "description": "List of email responses received from suppliers"
        },
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def get_responses(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EmailMessageResponse]:
    """Returns all supplier email responses associated with the given request."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    responses = await EmailMessageDAO.get_by_request(session, request_id)
    return [EmailMessageResponse.from_orm_with_supplier(r) for r in responses]


@router.get(
    "/{request_id}/threads",
    response_model=list[ThreadSummary],
    summary="List email threads (suppliers that have replied) for a request",
    responses={
        200: {"description": "Threads with last message preview"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def get_threads(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ThreadSummary]:
    """Returns only RequestSuppliers that have >=1 EmailMessage."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    raw = await EmailMessageDAO.get_threads_summary(session, request_id)
    return [ThreadSummary.model_validate(item) for item in raw]


@router.get(
    "/{request_id}/suppliers/{rs_id}/messages",
    response_model=list[Message],
    summary="Full chronological thread (all EmailMessages) for one supplier",
    responses={
        200: {"description": "Ordered list of messages in the conversation"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {
            "description": "RequestSupplier not found, no access, or no messages"
        },
    },
)
async def get_thread_messages(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Message]:
    """Ownership check + load via EmailMessageDAO.get_thread (already ordered asc)."""
    rs = await RequestSupplierDAO.get_supplier_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    req = await RequestDAO.get_by_id(session, request_id)
    if not req or req.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    messages = await EmailMessageDAO.get_thread(session, rs_id)

    return [Message.model_validate(message) for message in messages]


@router.post(
    "/{request_id}/suppliers/{rs_id}/reply",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue an outgoing reply in the thread (creates EmailMessage after sending)",
    responses={
        202: {"description": "Reply queued for sending"},
        400: {"description": "Empty body or validation error"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "RS not found or not owned"},
    },
)
async def post_reply(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: ReplyPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Validates ownership, queues send_reply Celery task. Returns 202 immediately."""
    rs = await RequestSupplierDAO.get_supplier_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )
    req = await RequestDAO.get_by_id(session, request_id)
    if not req or req.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    if not payload.body or not payload.body.strip():
        raise HTTPException(
            status_code=400, detail="Reply body cannot be empty"
        )

    send_reply.delay(str(rs_id), payload.body, None)  # type: ignore

    return {"status": "queued", "rs_id": str(rs_id)}


@router.get(
    "/{request_id}/suppliers",
    response_model=list[RequestSupplierResponse],
    summary="List suppliers for a request",
    responses={
        200: {"description": "List of suppliers associated with the request"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def get_suppliers(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RequestSupplierResponse]:
    """Returns all suppliers associated with the given request."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    suppliers = await RequestSupplierDAO.get_by_request(session, request_id)
    return [
        RequestSupplierResponse(
            id=rs.id,
            supplier=SupplierResponse.model_validate(rs.supplier),
            status=RequestSupplierStatus(rs.status),
            is_enabled=rs.is_enabled,
            sent_at=rs.sent_at,
        )
        for rs in suppliers
    ]


@router.patch(
    "/{request_id}/suppliers/{request_supplier_id}",
    response_model=RequestSupplierResponse,
    summary="Toggle supplier enabled status for a request",
    responses={
        200: {"description": "Supplier enabled status updated"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request or supplier not found"},
    },
)
async def toggle_supplier(
    request_id: uuid.UUID,
    request_supplier_id: uuid.UUID,
    body: ToggleSupplierRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestSupplierResponse:
    """Updates the enabled status of a supplier for a specific request."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    rs = await RequestSupplierDAO.set_enabled(
        session, request_supplier_id, body.is_enabled
    )
    if not rs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )

    await session.refresh(rs, ["supplier"])
    return RequestSupplierResponse(
        id=rs.id,
        supplier=SupplierResponse.model_validate(rs.supplier),
        status=RequestSupplierStatus(rs.status),
        is_enabled=rs.is_enabled,
        sent_at=rs.sent_at,
    )


@router.patch(
    "/{request_id}",
    response_model=RequestResponse,
    summary="Update optional fields and additional parameters for the request email",  # noqa: E501
    responses={
        200: {"description": "Request parameters updated"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
        422: {"description": "Validation Error"},
    },
)
async def update_request_additional_params(
    request_id: uuid.UUID,
    body: RequestUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestResponse:
    """Updates description, additional_params JSON"""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    additional_params_data = body.additional_params
    await RequestDAO.update_additional_params(
        session,
        request_id,
        additional_params=additional_params_data,
        description=body.description,
    )

    updated = await RequestDAO.get_by_id(session, request_id)
    return RequestResponse.model_validate(updated)


@router.post(
    "/{request_id}/attachments",
    response_model=list[Attachment],
    summary="Upload attachments for a request",
    responses={
        200: {"description": "Attachments uploaded successfully"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
        413: {"description": "File too large"},
        415: {"description": "Unsupported file type"},
    },
)
async def upload_attachments(
    request_id: uuid.UUID,
    files: list[UploadFile],
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
) -> list[Attachment]:
    """Upload files to be attached to emails for this request."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

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

    await RequestDAO.update_attachment_paths(
        session, request_id, existing_paths
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
    summary="Download a private attachment (user-uploaded or reply)",
    responses={
        200: {"content": {"application/octet-stream": {}}},
        400: {"detail": "Invalid attachment path"},
        403: {"detail": "Not authorized for this attachment"},
        404: {"detail": "Attachment not found"},
    },
)
async def serve_attachment(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
    attachment_path: str = Query(
        ..., description="Stored attachment path (full or relative)"
    ),
) -> FileResponse:
    """Authenticated download. Validates ownership via request_id in path."""
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

    req = await RequestDAO.get_by_id(session, request_id)
    if not req or req.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized for this attachment",
        )

    filename = candidate.name
    return FileResponse(
        path=str(candidate),
        filename=filename,
        media_type="application/octet-stream",
    )


@router.patch(
    "/{request_id}/email_message",
    response_model=RequestResponse,
    summary="Update email message for a request",
    responses={
        200: {"description": "Email message updated"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
        422: {"description": "Validation Error"},
    },
)
async def update_request_email_message(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    email_update: RequestEmailUpdate,
) -> RequestResponse:
    """Updates the generated email message for the request (and optionally persists email_subject from user edit)."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    if email_update.email_subject:
        await RequestDAO.update_email_subject(
            session, request_id, email_update.email_subject
        )

    email_message = (
        email_update.email_message
        if email_update.email_message is not None
        else build_request_email_body(request, current_user)
    )
    await RequestDAO.update_email_message(
        session,
        request_id,
        email_message=email_message,
    )

    updated = await RequestDAO.get_by_id(session, request_id)
    return RequestResponse.model_validate(updated)


@router.delete(
    "/{request_id}/suppliers/{request_supplier_id}",
    response_model=SupplierRemoveResponse,
    summary="Remove a supplier from a request",
    responses={
        200: {"description": "Supplier successfully removed from the request"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {
            "description": "Request not found, does not belong to user, or supplier link not found"
        },
    },
)
async def remove_supplier_from_request(
    request_id: uuid.UUID,
    request_supplier_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierRemoveResponse:
    """Removes the association between a supplier and the request (does not delete the supplier itself)."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    deleted = await RequestSupplierDAO.delete(session, request_supplier_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier link not found",
        )

    return SupplierRemoveResponse(id=request_supplier_id)


@router.post(
    "/{request_id}/close",
    response_model=RequestCloseResponse,
    summary="Close a request by setting status to closed",
    responses={
        200: {"description": "Request successfully closed"},
        400: {
            "description": "Request already closed or in invalid state for closing"
        },
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Request not found or does not belong to user"},
    },
)
async def close_request(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestCloseResponse:
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    if request.status == RequestStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request already closed",
        )
    await RequestDAO.update_status(session, request_id, RequestStatus.CLOSED)
    return RequestCloseResponse(id=request_id)
