import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import SearchHistory


class SearchHistoryDAO(BaseDAO[SearchHistory]):
    model = SearchHistory

    @classmethod
    async def get_all_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[SearchHistory]:
        logger.debug(
            "Getting all search history by user",
            model=cls.model,
            user_id=user_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
            )
            result = await session.execute(stmt)
            histories = list(result.scalars().all())
            logger.info(
                "Got search history by user",
                model=cls.model.__name__,
                count=len(histories),
                user_id=user_id,
            )
            return histories
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get search history by user",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise
