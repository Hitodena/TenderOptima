import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.deps import get_current_user, get_session
from backend.api.response_analysis.schemas import (
    EmailAnalysisPatch,
    EmailAnalysisResponse,
)
from backend.db.dao import ResponseAnalysisDAO
from backend.db.models import EmailMessage, Request, RequestSupplier, User
from backend.enums import (
    EmailMessageDirection,
    TZAnalysisRunStatus,
    TZAnalysisStatus,
)
from backend.schemas.analysis import EmailAnalysisResult
from backend.services.analysis.email_queue import (
    queue_email_analysis,
    request_has_requirements,
)
from backend.utils.comparison_price import (
    is_price_requirement,
    parse_offer_numeric,
)

router = APIRouter(prefix="/responses", tags=["Response Analysis"])


async def _get_owned_incoming_message(
    session: AsyncSession,
    message_id: uuid.UUID,
    current_user: User,
) -> tuple[EmailMessage, Request]:
    stmt = (
        select(EmailMessage)
        .where(EmailMessage.id == message_id)
        .options(
            selectinload(EmailMessage.request_supplier).selectinload(
                RequestSupplier.request
            )
        )
    )
    message = (await session.execute(stmt)).scalar_one_or_none()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    if message.direction != EmailMessageDirection.INCOMING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is only available for incoming messages",
        )
    rs = message.request_supplier
    if not rs or not rs.request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    request = rs.request
    if request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )
    return message, request


def _requirements_text(request: Request) -> str:
    if not request_has_requirements(request):
        return ""
    params = request.additional_params
    lines = [str(p).strip() for p in params if str(p).strip()]
    return "\n".join(f"- {line}" for line in lines)


def _analysis_to_response(
    message_id: uuid.UUID,
    row,
) -> EmailAnalysisResponse:
    prev = row.previous_parameters if row else None
    if isinstance(prev, dict):
        previous_parameters = {
            str(k): str(v) for k, v in prev.items() if v is not None
        }
    else:
        previous_parameters = None

    if row.status == TZAnalysisRunStatus.PROCESSING.value:
        return EmailAnalysisResponse(
            message_id=str(message_id),
            status=TZAnalysisRunStatus.PROCESSING,
            parameters={},
            matches=[],
            previous_parameters=previous_parameters,
        )
    if row.status == TZAnalysisRunStatus.FAILED.value:
        return EmailAnalysisResponse(
            message_id=str(message_id),
            status=TZAnalysisRunStatus.FAILED,
            parameters={},
            matches=[],
            previous_parameters=previous_parameters,
        )
    if not row.raw_llm_response:
        return EmailAnalysisResponse(
            message_id=str(message_id),
            status=TZAnalysisRunStatus(row.status),
            parameters={},
            matches=[],
            previous_parameters=previous_parameters,
        )
    result = EmailAnalysisResult(**row.raw_llm_response)
    return EmailAnalysisResponse(
        message_id=str(message_id),
        status=TZAnalysisRunStatus(row.status),
        previous_parameters=previous_parameters,
        **result.model_dump(),
    )


@router.post(
    "/{message_id}/analyze",
    response_model=EmailAnalysisResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue supplier email analysis against request requirements",
)
async def analyze_response(
    message_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmailAnalysisResponse:
    _message, request = await _get_owned_incoming_message(
        session, message_id, current_user
    )
    if not _requirements_text(request):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has no additional_params requirements",
        )

    existing = await ResponseAnalysisDAO.get_by_response_id(
        session, message_id
    )
    if existing and existing.status == TZAnalysisRunStatus.PROCESSING.value:
        return _analysis_to_response(message_id, existing)

    await queue_email_analysis(session, message_id, request, reanalyze=True)
    row = await ResponseAnalysisDAO.get_by_response_id(session, message_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to queue analysis",
        )
    return _analysis_to_response(message_id, row)


@router.get(
    "/{message_id}/analysis",
    response_model=EmailAnalysisResponse,
    summary="Get saved email analysis",
)
async def get_response_analysis(
    message_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmailAnalysisResponse:
    await _get_owned_incoming_message(session, message_id, current_user)
    row = await ResponseAnalysisDAO.get_by_response_id(session, message_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status == TZAnalysisRunStatus.PROCESSING.value:
        return _analysis_to_response(message_id, row)
    if row.status == TZAnalysisRunStatus.FAILED.value:
        return _analysis_to_response(message_id, row)
    if not row.raw_llm_response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return _analysis_to_response(message_id, row)


@router.patch(
    "/{message_id}/analysis",
    response_model=EmailAnalysisResponse,
    summary="Update extracted parameters after manual edit",
)
async def patch_response_analysis(
    message_id: uuid.UUID,
    body: EmailAnalysisPatch,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmailAnalysisResponse:
    await _get_owned_incoming_message(session, message_id, current_user)
    row = await ResponseAnalysisDAO.get_by_response_id(session, message_id)
    if not row or not row.raw_llm_response:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    if row.status != TZAnalysisRunStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Analysis is not ready for editing",
        )

    data = dict(row.raw_llm_response)
    if body.matches:
        by_req = {
            str(m.get("requirement", "")).strip(): dict(m)
            for m in data.get("matches") or []
            if isinstance(m, dict) and str(m.get("requirement", "")).strip()
        }
        for patch_match in body.matches:
            req = patch_match.requirement.strip()
            if req not in by_req:
                continue
            entry = by_req[req]
            old_value = entry.get("offer_value")
            new_value = patch_match.offer_value
            if new_value == old_value:
                continue
            if old_value is not None and str(old_value).strip():
                entry["corrected_from"] = str(old_value)
            entry["offer_value"] = new_value
            if is_price_requirement(req):
                entry["numeric_value"] = parse_offer_numeric(new_value)
            if new_value is not None and str(new_value).strip():
                entry["status"] = TZAnalysisStatus.MET.value
                entry["explanation"] = None
        data["matches"] = list(by_req.values())
    await ResponseAnalysisDAO.update_fields(
        session, row.id, raw_llm_response=data
    )
    result = EmailAnalysisResult(**data)
    prev = row.previous_parameters
    previous_parameters = (
        {str(k): str(v) for k, v in prev.items() if v is not None}
        if isinstance(prev, dict)
        else None
    )
    return EmailAnalysisResponse(
        message_id=str(message_id),
        status=TZAnalysisRunStatus.ACTIVE,
        previous_parameters=previous_parameters,
        **result.model_dump(),
    )
