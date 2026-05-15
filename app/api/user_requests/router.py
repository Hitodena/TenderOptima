import uuid
from typing import Annotated
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.api.user_requests.schemas import (
    ParserResult,
    RequestCreate,
    RequestRead,
    SearchResult,
    SupplierResponseRead,
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
    "/", response_model=RequestRead, status_code=status.HTTP_201_CREATED
)
async def create_request(
    body: RequestCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestRead:
    request = await RequestDAO.create(
        session,
        user_id=current_user.id,
        query=body.query,
        delivery_region=body.delivery_region,
        description=body.description,
        quantity=body.quantity,
        unit=body.unit,
        quality_requirements=body.quality_requirements,
        delivery_deadline=body.delivery_deadline,
        max_price_per_unit=body.max_price_per_unit,
        currency=body.currency,
        status="draft",
    )
    return RequestRead.model_validate(request)


@router.post("/{request_id}/search", response_model=SearchResult)
async def search_suppliers(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SearchResult:
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
        raise HTTPException(  # noqa: B904
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Parser service unavailable",
        )

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


@router.post("/{request_id}/launch", status_code=status.HTTP_202_ACCEPTED)
async def launch_mailing(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
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

    return {
        "status": "queued",
        "request_id": str(request_id),
        "pending": pending_count,
    }


@router.get("/", response_model=list[RequestRead])
async def get_requests(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RequestRead]:
    requests = await RequestDAO.get_all_by_user(session, current_user.id)
    return [RequestRead.model_validate(r) for r in requests]


@router.get("/{request_id}", response_model=RequestRead)
async def get_request(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RequestRead:
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )
    return RequestRead.model_validate(request)


@router.get(
    "/{request_id}/responses", response_model=list[SupplierResponseRead]
)
async def get_responses(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SupplierResponseRead]:
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Request not found"
        )

    responses = await SupplierResponseDAO.get_by_request(session, request_id)
    return [SupplierResponseRead.from_orm_with_supplier(r) for r in responses]
