import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.tz_creation import TZCreationMessage, TZCreationSession


class TZCreationSessionDAO(BaseDAO[TZCreationSession]):
    model = TZCreationSession

    @classmethod
    async def get_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[TZCreationSession]:
        logger.debug("Getting TZ creation sessions by user", user_id=user_id)
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
            )
            return list((await session.execute(stmt)).scalars().all())
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ creation sessions by user",
                error=str(exc),
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_history_page_by_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[TZCreationSession], bool]:
        """Return a page of TZ creation sessions ordered by recency."""
        try:
            offset = max(page - 1, 0) * size
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
                .offset(offset)
                .limit(size + 1)
            )
            rows = list((await session.execute(stmt)).scalars().all())
            has_more = len(rows) > size
            return rows[:size], has_more
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ creation session history page",
                error=str(exc),
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_by_id_and_user(
        cls,
        session: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> TZCreationSession | None:
        try:
            stmt = select(cls.model).where(
                cls.model.id == session_id,
                cls.model.user_id == user_id,
            )
            return (await session.execute(stmt)).scalar_one_or_none()
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ creation session by id and user",
                error=str(exc),
                session_id=str(session_id),
            )
            raise


class TZCreationMessageDAO(BaseDAO[TZCreationMessage]):
    model = TZCreationMessage

    @classmethod
    async def list_by_session(
        cls,
        session: AsyncSession,
        session_id: uuid.UUID,
    ) -> list[TZCreationMessage]:
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.session_id == session_id)
                .order_by(cls.model.created_at)
            )
            return list((await session.execute(stmt)).scalars().all())
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to list TZ creation messages",
                error=str(exc),
                session_id=str(session_id),
            )
            raise
