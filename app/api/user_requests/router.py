import uuid
from typing import Annotated
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.api.user_requests.schemas import (
    LaunchMailingResponse,
    ParserResult,
    RequestCreate,
    RequestResponse,
    RequestSupplierResponse,
    RequestUpdate,
    SearchResult,
    SupplierResponse,
    SupplierResponseResponse,
    ToggleSupplierRequest,
)
from app.celery_app.tasks.email_tasks import send_emails
from app.core.config import get_config
from app.db.dao import (
    BlacklistedDomainDAO,
    RequestDAO,
    RequestSupplierDAO,
    SearchHistoryDAO,
    SupplierDAO,
    SupplierResponseDAO,
)
from app.db.models import User

router = APIRouter(prefix="/requests", tags=["Requests"])
config = get_config()


def _extract_domain(raw: str) -> str:
    parsed = urlparse(raw)
    host = parsed.netloc or parsed.path
    return host.removeprefix("www.")


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
        status="draft",
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
) -> SearchResult:
    """Runs an external parser search, filters blacklisted domains, and saves valid suppliers."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    if request.status not in ("draft", "active"):
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
                status="pending",
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

    await RequestDAO.update_status(session, request.id, "active")

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

    if request.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot launch mailing in status '{request.status}'",
        )

    pending_count = await RequestSupplierDAO.count_pending(session, request.id)
    if pending_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending suppliers. Run /search first.",
        )

    send_emails.delay(str(request_id))  # type: ignore
    logger.info("send_emails task queued", request_id=str(request_id))

    return LaunchMailingResponse(
        status="queued",
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
    response_model=list[SupplierResponseResponse],
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
) -> list[SupplierResponseResponse]:
    """Returns all supplier email responses associated with the given request."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    responses = await SupplierResponseDAO.get_by_request(session, request_id)
    return [
        SupplierResponseResponse.from_orm_with_supplier(r) for r in responses
    ]


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
            status=rs.status,
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
        status=rs.status,
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
    """Updates description, currency and/or the additional_params JSON for the email template."""  # noqa: E501
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    additional_params_dict = (
        body.additional_params.model_dump() if body.additional_params else None
    )
    await RequestDAO.update_additional_params(
        session,
        request_id,
        additional_params=additional_params_dict,
        description=body.description,
        delivery_deadline=body.delivery_deadline,
        currency=body.currency,
    )

    updated = await RequestDAO.get_by_id(session, request_id)
    return RequestResponse.model_validate(updated)
