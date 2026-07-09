from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import (
    get_admin,
    get_current_user,
    get_current_user_optional,
    get_session,
)
from backend.api.feedback.schemas import (
    FrontendErrorLogCreate,
    FrontendErrorLogPageResponse,
    FrontendErrorLogResponse,
    IdeaSuggestionCreate,
    IdeaSuggestionPageResponse,
    IdeaSuggestionResponse,
    UserBriefResponse,
)
from backend.db.dao import FrontendErrorLogDAO, IdeaSuggestionDAO
from backend.db.models import FrontendErrorLog, IdeaSuggestion, User

router = APIRouter(prefix="/feedback", tags=["Feedback"])


def _user_brief(user: User | None) -> UserBriefResponse | None:
    if user is None:
        return None
    return UserBriefResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


def _error_response(row: FrontendErrorLog) -> FrontendErrorLogResponse:
    return FrontendErrorLogResponse(
        id=row.id,
        user_id=row.user_id,
        user=_user_brief(row.user),
        message=row.message,
        backend_response=row.backend_response,
        page_url=row.page_url,
        request_method=row.request_method,
        request_url=row.request_url,
        status_code=row.status_code,
        created_at=row.created_at,
    )


def _idea_response(row: IdeaSuggestion) -> IdeaSuggestionResponse:
    return IdeaSuggestionResponse(
        id=row.id,
        user_id=row.user_id,
        user=_user_brief(row.user),
        message=row.message,
        created_at=row.created_at,
    )


@router.post(
    "/errors",
    status_code=status.HTTP_201_CREATED,
    response_model=FrontendErrorLogResponse,
    summary="Log a frontend error (optional auth)",
)
async def log_frontend_error(
    body: FrontendErrorLogCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> FrontendErrorLogResponse:
    row = await FrontendErrorLogDAO.create(
        session,
        user_id=current_user.id if current_user else None,
        message=body.message,
        backend_response=body.backend_response,
        page_url=body.page_url,
        request_method=body.request_method,
        request_url=body.request_url,
        status_code=body.status_code,
    )
    return _error_response(row)


@router.get(
    "/errors",
    response_model=FrontendErrorLogPageResponse,
    summary="List frontend errors (admin)",
)
async def list_frontend_errors(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> FrontendErrorLogPageResponse:
    rows, total = await FrontendErrorLogDAO.list_page(
        session, page=page, size=size
    )
    return FrontendErrorLogPageResponse(
        items=[_error_response(r) for r in rows],
        page=page,
        size=size,
        total=total,
    )


@router.post(
    "/ideas",
    status_code=status.HTTP_201_CREATED,
    response_model=IdeaSuggestionResponse,
    summary="Submit an idea suggestion (requires auth)",
)
async def submit_idea(
    body: IdeaSuggestionCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> IdeaSuggestionResponse:
    row = await IdeaSuggestionDAO.create(
        session,
        user_id=current_user.id,
        message=body.message,
    )
    row.user = current_user
    return _idea_response(row)


@router.get(
    "/ideas",
    response_model=IdeaSuggestionPageResponse,
    summary="List idea suggestions (admin)",
)
async def list_ideas(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> IdeaSuggestionPageResponse:
    rows, total = await IdeaSuggestionDAO.list_page(
        session, page=page, size=size
    )
    return IdeaSuggestionPageResponse(
        items=[_idea_response(r) for r in rows],
        page=page,
        size=size,
        total=total,
    )
