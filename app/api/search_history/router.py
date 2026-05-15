from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.api.search_history.schemas import SearchHistoryRead
from app.db.dao import (
    SearchHistoryDAO,
)
from app.db.models import User

router = APIRouter(prefix="/history", tags=["Search history"])


@router.get("/", response_model=list[SearchHistoryRead])
async def get_search_history(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SearchHistoryRead]:
    items = await SearchHistoryDAO.get_all_by_user(session, current_user.id)
    return [SearchHistoryRead.model_validate(i) for i in items]
