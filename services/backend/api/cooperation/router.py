"""Public API for supplier cooperation invitations."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.cooperation.schemas import (
    CooperationLeadCreate,
    CooperationLeadResponse,
)
from backend.api.deps import get_session
from backend.db.dao import CooperationLeadDAO
from backend.db.models import CooperationLead
from backend.enums import CooperationLeadStatus

router = APIRouter(prefix="/cooperation", tags=["Cooperation"])

RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW = timedelta(minutes=1)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _lead_response(row: CooperationLead) -> CooperationLeadResponse:
    return CooperationLeadResponse(
        id=row.id,
        name=row.name,
        email=row.email,
        phone=row.phone,
        company=row.company,
        industry=row.industry,
        comment=row.comment,
        agree_marketing=row.agree_marketing,
        status=CooperationLeadStatus(row.status),
        utm_source=row.utm_source,
        utm_medium=row.utm_medium,
        utm_campaign=row.utm_campaign,
        utm_content=row.utm_content,
        page_url=row.page_url,
        approved_at=row.approved_at,
        cancelled_at=row.cancelled_at,
        deleted_at=row.deleted_at,
        created_at=row.created_at,
    )


@router.post(
    "/leads",
    status_code=status.HTTP_201_CREATED,
    response_model=CooperationLeadResponse,
    summary="Submit a supplier cooperation invitation (public, rate-limited)",
)
async def create_cooperation_lead(
    body: CooperationLeadCreate,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CooperationLeadResponse:
    if body.honeypot:
        logger.warning("Cooperation honeypot triggered", email=body.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid submission",
        )

    ip_address = _client_ip(request)
    recent_count = await CooperationLeadDAO.count_recent_by_ip(
        session, ip_address, datetime.now(UTC) - RATE_LIMIT_WINDOW
    )
    if recent_count >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(
            "Cooperation rate limit exceeded", ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много заявок. Повторите попытку позже.",
        )

    existing = await CooperationLeadDAO.get_by_email_active(
        session, body.email
    )
    if existing and existing.status == CooperationLeadStatus.NEW.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заявка с этим email уже отправлена и ожидает рассмотрения",
        )

    row = await CooperationLeadDAO.create(
        session,
        name=body.name,
        email=body.email,
        phone=body.phone,
        company=body.company,
        industry=body.industry,
        comment=body.comment,
        agree_marketing=body.agree_marketing,
        status=CooperationLeadStatus.NEW.value,
        utm_source=body.utm_source,
        utm_medium=body.utm_medium,
        utm_campaign=body.utm_campaign,
        utm_content=body.utm_content,
        page_url=body.page_url,
        ip_address=ip_address,
    )
    return _lead_response(row)
