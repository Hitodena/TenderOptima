"""Public API for supplier RFQ subscribe / unsubscribe."""

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_session
from backend.api.supplier_preferences.schemas import (
    SupplierPreferenceActionResponse,
    SupplierPreferenceResponse,
    SupplierPreferenceSubscribeRequest,
    SupplierPreferenceTokenRequest,
)
from backend.db.dao import RequestDAO, SupplierEmailPreferenceDAO
from backend.db.models.supplier_email_preference import SupplierEmailPreference
from backend.enums import (
    SupplierEmailPreferenceStatus,
    SupplierPreferenceTokenPurpose,
)
from backend.utils.supplier_preference_tokens import decode_preference_token

router = APIRouter(
    prefix="/supplier-preferences", tags=["Supplier Preferences"]
)

RATE_LIMIT_MAX_REQUESTS = 10
RATE_LIMIT_WINDOW = timedelta(minutes=1)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _email_from_payload(payload: dict) -> str:
    return str(payload["sub"]).lower().strip()


def _request_id_from_payload(payload: dict) -> UUID | None:
    raw = payload.get("rid")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except ValueError:
        return None


def _to_response(
    email: str,
    pref: SupplierEmailPreference | None,
    *,
    suggested_region: str | None = None,
) -> SupplierPreferenceResponse:
    if pref is None:
        return SupplierPreferenceResponse(
            email=email,
            status=None,
            categories=[],
            region=None,
            suggested_region=suggested_region,
            consent_accepted_at=None,
        )
    return SupplierPreferenceResponse(
        email=email,
        status=pref.status,
        categories=list(pref.categories or []),
        region=pref.region,
        suggested_region=suggested_region,
        consent_accepted_at=pref.consent_accepted_at,
    )


async def _rate_limit(session: AsyncSession, ip_address: str) -> None:
    since = datetime.now(UTC) - RATE_LIMIT_WINDOW
    stmt = select(func.count()).where(
        SupplierEmailPreference.updated_at >= since,
        SupplierEmailPreference.consent_ip == ip_address,
    )
    result = await session.execute(stmt)
    if (result.scalar_one() or 0) >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(
            "Supplier preference rate limit exceeded", ip_address=ip_address
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов. Повторите попытку позже.",
        )


@router.get(
    "/",
    response_model=SupplierPreferenceResponse,
    summary="Resolve a preference token for the public subscribe/unsubscribe pages",
)
async def get_preference(
    token: Annotated[str, Query(min_length=10)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SupplierPreferenceResponse:
    payload = decode_preference_token(token)
    email = _email_from_payload(payload)
    pref = await SupplierEmailPreferenceDAO.get_by_email(session, email)
    suggested_region = None
    request_id = _request_id_from_payload(payload)
    if request_id is not None:
        request = await RequestDAO.get_by_id(session, request_id)
        if request is not None:
            suggested_region = request.delivery_region
    return _to_response(email, pref, suggested_region=suggested_region)


@router.post(
    "/subscribe",
    response_model=SupplierPreferenceActionResponse,
    summary="Confirm opt-in for similar RFQ emails",
)
async def subscribe(
    body: SupplierPreferenceSubscribeRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SupplierPreferenceActionResponse:
    if not body.consent:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Необходимо согласие на обработку персональных данных",
        )
    payload = decode_preference_token(
        body.token,
        expected_purpose=SupplierPreferenceTokenPurpose.SUBSCRIBE,
    )
    email = _email_from_payload(payload)
    ip_address = _client_ip(request)
    await _rate_limit(session, ip_address)

    categories = [c.strip() for c in body.categories if c and c.strip()]
    if not categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите хотя бы одну категорию товаров",
        )

    now = datetime.now(UTC)
    request_id = _request_id_from_payload(payload)
    pref = await SupplierEmailPreferenceDAO.get_by_email(session, email)
    if pref is None:
        pref = await SupplierEmailPreferenceDAO.create(
            session,
            email=email,
            status=SupplierEmailPreferenceStatus.SUBSCRIBED.value,
            categories=categories,
            region=body.region,
            consent_accepted_at=now,
            consent_ip=ip_address,
            source_request_id=request_id,
            subscribed_at=now,
            unsubscribed_at=None,
        )
    else:
        updated = await SupplierEmailPreferenceDAO.update_fields(
            session,
            pref.id,
            status=SupplierEmailPreferenceStatus.SUBSCRIBED.value,
            categories=categories,
            region=body.region,
            consent_accepted_at=now,
            consent_ip=ip_address,
            source_request_id=request_id or pref.source_request_id,
            subscribed_at=now,
            unsubscribed_at=None,
        )
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось сохранить подписку",
            )
        pref = updated
    logger.info("Supplier subscribed to similar requests", email=email)
    return SupplierPreferenceActionResponse(
        email=email,
        status=pref.status,
        source_request_id=pref.source_request_id,
    )


async def _unsubscribe_email(
    session: AsyncSession,
    *,
    email: str,
    request_id: UUID | None,
    ip_address: str,
) -> SupplierEmailPreference:
    await _rate_limit(session, ip_address)
    now = datetime.now(UTC)
    pref = await SupplierEmailPreferenceDAO.get_by_email(session, email)
    if pref is None:
        pref = await SupplierEmailPreferenceDAO.create(
            session,
            email=email,
            status=SupplierEmailPreferenceStatus.UNSUBSCRIBED.value,
            categories=None,
            region=None,
            consent_accepted_at=None,
            consent_ip=ip_address,
            source_request_id=request_id,
            subscribed_at=None,
            unsubscribed_at=now,
        )
    else:
        updated = await SupplierEmailPreferenceDAO.update_fields(
            session,
            pref.id,
            status=SupplierEmailPreferenceStatus.UNSUBSCRIBED.value,
            consent_ip=ip_address,
            source_request_id=request_id or pref.source_request_id,
            unsubscribed_at=now,
        )
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось сохранить отписку",
            )
        pref = updated
    logger.info("Supplier unsubscribed from RFQ emails", email=email)
    return pref


@router.post(
    "/unsubscribe",
    response_model=SupplierPreferenceActionResponse,
    summary="Opt out of platform RFQ emails from the public page",
)
async def unsubscribe(
    body: SupplierPreferenceTokenRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SupplierPreferenceActionResponse:
    payload = decode_preference_token(
        body.token,
        expected_purpose=SupplierPreferenceTokenPurpose.UNSUBSCRIBE,
    )
    email = _email_from_payload(payload)
    pref = await _unsubscribe_email(
        session,
        email=email,
        request_id=_request_id_from_payload(payload),
        ip_address=_client_ip(request),
    )
    return SupplierPreferenceActionResponse(
        email=email,
        status=pref.status,
        source_request_id=pref.source_request_id,
    )


@router.post(
    "/one-click",
    response_model=SupplierPreferenceActionResponse,
    summary="RFC 8058 one-click unsubscribe (List-Unsubscribe-Post)",
)
async def one_click_unsubscribe(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str, Query(min_length=10)],
) -> SupplierPreferenceActionResponse:
    payload = decode_preference_token(
        token,
        expected_purpose=SupplierPreferenceTokenPurpose.UNSUBSCRIBE,
    )
    email = _email_from_payload(payload)
    pref = await _unsubscribe_email(
        session,
        email=email,
        request_id=_request_id_from_payload(payload),
        ip_address=_client_ip(request),
    )
    return SupplierPreferenceActionResponse(
        email=email,
        status=pref.status,
        source_request_id=pref.source_request_id,
    )
