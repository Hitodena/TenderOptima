import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_request_or_404, get_session
from backend.api.responses.schemas import (
    EmailMessageResponse,
    Message,
    ReplyPayload,
    ThreadSummary,
)
from backend.celery_app.tasks.email_tasks import send_reply
from backend.db.dao import EmailMessageDAO, RequestSupplierDAO
from backend.db.models import User

router = APIRouter(prefix="/requests", tags=["Responses"])


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
