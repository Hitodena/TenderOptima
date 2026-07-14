from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.consultations.schemas import (
    ConsultationCreate,
    ConsultationPageResponse,
    ConsultationResponse,
)
from backend.api.deps import get_admin, get_session
from backend.celery_app.tasks.consultation_tasks import (
    notify_admin_new_consultation,
    send_consultation_autoreply,
)
from backend.db.dao import ConsultationDAO
from backend.db.models import Consultation, User
from backend.enums import (
    ConsultationRequestType,
    ConsultationRole,
    ConsultationStatus,
)

router = APIRouter(prefix="/consultations", tags=["Consultations"])

RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW = timedelta(minutes=1)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _consultation_response(row: Consultation) -> ConsultationResponse:
    return ConsultationResponse(
        id=row.id,
        name=row.name,
        company=row.company,
        email=row.email,
        phone=row.phone,
        role=ConsultationRole(row.role),
        request_type=ConsultationRequestType(row.request_type),
        comment=row.comment,
        agree_marketing=row.agree_marketing,
        status=ConsultationStatus(row.status),
        utm_source=row.utm_source,
        utm_medium=row.utm_medium,
        utm_campaign=row.utm_campaign,
        utm_content=row.utm_content,
        page_url=row.page_url,
        created_at=row.created_at,
    )


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ConsultationResponse,
    summary="Submit a consultation request (public, rate-limited)",
)
async def create_consultation(
    body: ConsultationCreate,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ConsultationResponse:
    if body.honeypot:
        logger.warning("Consultation honeypot triggered", email=body.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid submission",
        )

    ip_address = _client_ip(request)
    recent_count = await ConsultationDAO.count_recent_by_ip(
        session, ip_address, datetime.now(UTC) - RATE_LIMIT_WINDOW
    )
    if recent_count >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(
            "Consultation rate limit exceeded", ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много заявок. Повторите попытку позже.",
        )

    existing_by_email = await ConsultationDAO.get_by_email(session, body.email)
    if existing_by_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заявка с этим email уже отправлена",
        )

    existing_by_phone = await ConsultationDAO.get_by_phone(session, body.phone)
    if existing_by_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заявка с этим номером телефона уже отправлена",
        )

    row = await ConsultationDAO.create(
        session,
        name=body.name,
        company=body.company,
        email=body.email,
        phone=body.phone,
        role=body.role.value,
        request_type=body.request_type.value,
        comment=body.comment,
        agree_marketing=body.agree_marketing,
        status=ConsultationStatus.NEW.value,
        utm_source=body.utm_source,
        utm_medium=body.utm_medium,
        utm_campaign=body.utm_campaign,
        utm_content=body.utm_content,
        page_url=body.page_url,
        ip_address=ip_address,
    )

    notify_admin_new_consultation.delay(  # type: ignore[attr-defined]
        str(row.id),
        row.name,
        row.company,
        row.email,
        row.phone,
        row.role,
        row.request_type,
        row.comment,
        row.agree_marketing,
    )
    send_consultation_autoreply.delay(  # type: ignore[attr-defined]
        str(row.id), row.name, row.email, row.request_type
    )

    return _consultation_response(row)


@router.get(
    "",
    response_model=ConsultationPageResponse,
    summary="List consultation requests (admin)",
)
async def list_consultations(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Annotated[
        ConsultationStatus | None, Query(alias="status")
    ] = None,
    role: Annotated[ConsultationRole | None, Query()] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
) -> ConsultationPageResponse:
    rows, total = await ConsultationDAO.list_page(
        session,
        page=page,
        size=size,
        status=status_filter,
        role=role,
        created_from=created_from,
        created_to=created_to,
    )
    return ConsultationPageResponse(
        items=[_consultation_response(r) for r in rows],
        page=page,
        size=size,
        total=total,
    )
