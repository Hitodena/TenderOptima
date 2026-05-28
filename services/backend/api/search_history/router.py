from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_session
from backend.api.search_history.schemas import SearchHistoryResponse
from backend.db.dao import SearchHistoryDAO
from backend.db.models import User

router = APIRouter(prefix="/history", tags=["Search history"])


@router.get(
    "/",
    response_model=list[SearchHistoryResponse],
    summary="Retrieve search history for the current user",
    responses={
        200: {
            "description": "List of past searches performed by the authenticated user"  # noqa: E501
        },
        401: {"description": "Missing or invalid authentication credentials"},
    },
)
async def get_search_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SearchHistoryResponse]:
    """Returns all search history entries belonging to the current user, ordered by creation time."""  # noqa: E501
    items = await SearchHistoryDAO.get_all(
        session,
        user_id=current_user.id,
        order_by=SearchHistoryDAO.model.created_at.desc(),
    )
    return [SearchHistoryResponse.model_validate(i) for i in items]
