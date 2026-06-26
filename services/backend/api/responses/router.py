import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_request_or_404, get_session
from backend.api.responses.schemas import (
    ComparisonResponse,
    ComparisonSupplier,
    CustomEmailPayload,
    EmailMessageResponse,
    Message,
    RefreshAllResponse,
    ReplyPayload,
    ThreadSummary,
)
from backend.celery_app.tasks.email_tasks import send_custom_email, send_reply
from backend.db.dao import (
    EmailMessageDAO,
    RequestSupplierDAO,
)
from backend.db.models import Request, User
from backend.enums import TZAnalysisRunStatus
from backend.schemas.analysis import EmailAnalysisResult
from backend.services.analysis.email_queue import queue_email_analysis
from backend.utils.xlsx_export import (
    build_comparison_workbook,
    workbook_to_bytes,
)

router = APIRouter(prefix="/requests", tags=["Responses"])

STATUS_LABELS = {
    "met": "Выполнено",
    "partial": "Частично",
    "missing": "Не закрыто",
    "not_found": "Не упомянуто",
}


def _requirements_list(request: Request) -> list[str]:
    params = request.additional_params
    if not params or not isinstance(params, list):
        return []
    return [str(p).strip() for p in params if str(p).strip()]


def _match_maps_from_analysis(
    raw: dict | None,
) -> tuple[
    dict[str, str | None],
    dict[str, str | None],
    dict[str, str | None],
    dict[str, str | None],
]:
    if not raw:
        return {}, {}, {}, {}
    try:
        result = EmailAnalysisResult(**raw)
    except Exception:
        return {}, {}, {}, {}
    values: dict[str, str | None] = {}
    statuses: dict[str, str | None] = {}
    explanations: dict[str, str | None] = {}
    corrected_from: dict[str, str | None] = {}
    for match in result.matches:
        req = match.requirement.strip()
        values[req] = match.offer_value
        statuses[req] = match.status.value
        explanations[req] = match.explanation
        corrected_from[req] = match.corrected_from
    return values, statuses, explanations, corrected_from


async def _latest_analyzed_incoming(session, rs_id: uuid.UUID):
    messages = await EmailMessageDAO.get_incoming_with_analysis_by_request_supplier_id(
        session, rs_id
    )
    for message in messages:
        analysis = message.analysis
        if (
            analysis
            and analysis.status == TZAnalysisRunStatus.ACTIVE.value
            and analysis.raw_llm_response
        ):
            return message
    return None


async def _build_comparison(
    session: AsyncSession,
    request: Request,
) -> ComparisonResponse:
    requirements = _requirements_list(request)
    suppliers_rows: list[ComparisonSupplier] = []
    enabled = await RequestSupplierDAO.get_enabled_by_request(
        session, request.id
    )
    for rs in enabled:
        if not rs.supplier:
            continue
        analyzed = await _latest_analyzed_incoming(session, rs.id)
        values: dict[str, str | None] = {req: None for req in requirements}
        previous_values: dict[str, str | None] = {
            req: None for req in requirements
        }
        statuses: dict[str, str | None] = {req: None for req in requirements}
        explanations: dict[str, str | None] = {
            req: None for req in requirements
        }
        corrected_from: dict[str, str | None] = {
            req: None for req in requirements
        }
        if analyzed and analyzed.analysis:
            analysis = analyzed.analysis
            (
                match_values,
                match_statuses,
                match_explanations,
                match_corrected,
            ) = _match_maps_from_analysis(analysis.raw_llm_response)
            prev = analysis.previous_parameters
            prev_map = prev if isinstance(prev, dict) else {}
            for req in requirements:
                if req in match_values:
                    values[req] = match_values[req]
                if req in match_statuses:
                    statuses[req] = match_statuses[req]
                if req in match_explanations:
                    explanations[req] = match_explanations[req]
                if req in match_corrected:
                    corrected_from[req] = match_corrected[req]
                if req in prev_map and prev_map[req] is not None:
                    previous_values[req] = str(prev_map[req])
        suppliers_rows.append(
            ComparisonSupplier(
                rs_id=str(rs.id),
                company_name=rs.supplier.company_name,
                main_email=rs.supplier.main_email,
                is_winner=bool(rs.is_winner),
                values=values,
                previous_values=previous_values,
                explanations=explanations,
                corrected_from=corrected_from,
                statuses=statuses,
            )
        )
    return ComparisonResponse(
        requirements=requirements,
        suppliers=suppliers_rows,
    )


@router.get(
    "/{request_id}/responses",
    response_model=list[EmailMessageResponse],
    summary="List supplier responses for a request",
)
async def list_responses(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EmailMessageResponse]:
    """Return all supplier email messages linked to the request."""
    await get_request_or_404(request_id, session, current_user)
    responses = await EmailMessageDAO.get_by_request(session, request_id)
    return [EmailMessageResponse.from_orm_with_supplier(r) for r in responses]


@router.get(
    "/{request_id}/threads",
    response_model=list[ThreadSummary],
    summary="List email threads for a request",
)
async def list_threads(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ThreadSummary]:
    """Return thread summaries for suppliers that have at least one message."""
    await get_request_or_404(request_id, session, current_user)
    rows = await EmailMessageDAO.get_threads_summary(session, request_id)
    return [ThreadSummary.from_row(row) for row in rows]


@router.get(
    "/{request_id}/suppliers/{rs_id}/messages",
    response_model=list[Message],
    summary="Full chronological thread for one supplier",
)
async def list_thread_messages(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Message]:
    """Return the full message thread for one request-supplier link."""
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    await get_request_or_404(request_id, session, current_user)
    messages = await EmailMessageDAO.get_thread_by_request_supplier_id(
        session, rs_id
    )
    return [Message.model_validate(message) for message in messages]


@router.post(
    "/{request_id}/suppliers/{rs_id}/reply",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue an outgoing reply in the thread",
)
async def post_reply(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: ReplyPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send a reply in an existing supplier thread."""
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )
    await get_request_or_404(request_id, session, current_user)

    if not payload.body or not payload.body.strip():
        raise HTTPException(
            status_code=400, detail="Reply body cannot be empty"
        )

    send_reply.delay(str(rs_id), payload.body, None)  # type: ignore
    return {"status": "queued", "rs_id": str(rs_id)}


async def _queue_custom_supplier_email(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: AsyncSession,
    current_user: User,
) -> dict:
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )
    await get_request_or_404(request_id, session, current_user)

    if not payload.subject.strip() or not payload.body.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject and body cannot be empty",
        )

    send_custom_email.delay(  # type: ignore[attr-defined]
        str(rs_id),
        payload.subject.strip(),
        payload.body.strip(),
        payload.attachment_paths,
    )
    return {"status": "queued", "rs_id": str(rs_id)}


@router.post(
    "/{request_id}/suppliers/{rs_id}/improvement-request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue improvement request email to supplier",
)
async def post_improvement_request(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send an improvement request in the thread."""
    return await _queue_custom_supplier_email(
        request_id, rs_id, payload, session, current_user
    )


@router.post(
    "/{request_id}/suppliers/{rs_id}/winner-notification",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue winner notification email to supplier",
)
async def post_winner_notification(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send a winner notification in the thread."""
    result = await _queue_custom_supplier_email(
        request_id, rs_id, payload, session, current_user
    )
    await RequestSupplierDAO.set_winner(session, request_id, rs_id)
    return result


@router.delete(
    "/{request_id}/winner",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear confirmed winner for the request",
)
async def delete_winner(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Allow choosing another winner after clearing the current selection."""
    await get_request_or_404(request_id, session, current_user)
    await RequestSupplierDAO.clear_winner(session, request_id)


@router.get(
    "/{request_id}/analysis/comparison",
    response_model=ComparisonResponse,
    summary="Compare supplier responses by request requirements",
)
async def get_analysis_comparison(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComparisonResponse:
    request = await get_request_or_404(request_id, session, current_user)
    return await _build_comparison(session, request)


@router.get(
    "/{request_id}/analysis/comparison.xlsx",
    summary="Export supplier comparison as XLSX",
)
async def export_analysis_comparison_xlsx(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    request = await get_request_or_404(request_id, session, current_user)
    comparison = await _build_comparison(session, request)

    wb = build_comparison_workbook(
        requirements=comparison.requirements,
        suppliers=comparison.suppliers,
        status_labels=STATUS_LABELS,
    )

    filename = f"request_{request_id}_comparison.xlsx"
    return Response(
        content=workbook_to_bytes(wb),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{request_id}/analysis/refresh-all",
    response_model=RefreshAllResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue analysis for all unanalyzed incoming messages",
)
async def refresh_all_analysis(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RefreshAllResponse:
    request = await get_request_or_404(request_id, session, current_user)
    if not _requirements_list(request):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has no additional_params requirements",
        )

    enabled = await RequestSupplierDAO.get_enabled_by_request(
        session, request_id
    )
    queued = 0
    for rs in enabled:
        latest = (
            await EmailMessageDAO.get_latest_incoming_by_request_supplier_id(
                session, rs.id
            )
        )
        if not latest:
            continue

        if await queue_email_analysis(
            session, latest.id, request, reanalyze=False
        ):
            queued += 1

    logger.info(
        "Bulk email analysis queued",
        request_id=str(request_id),
        queued=queued,
    )
    return RefreshAllResponse(queued=queued)
