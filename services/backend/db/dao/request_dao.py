import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import Request
from backend.enums import RequestStatus


class RequestDAO(BaseDAO[Request]):
    model = Request

    @classmethod
    async def get_active_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        logger.debug(
            "Getting active requests by user",
            model=cls.model,
            user_id=user_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(
                    cls.model.user_id == user_id,
                    cls.model.status != RequestStatus.CLOSED.value,
                )
                .order_by(cls.model.created_at.desc())
            )
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got active requests by user",
                model=cls.model.__name__,
                count=len(result),
                user_id=user_id,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get active requests by user",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_closed_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        return await cls.get_all(
            session,
            user_id=user_id,
            status=RequestStatus.CLOSED.value,
            order_by=cls.model.created_at.desc(),
        )

    @classmethod
    async def get_active_page_by_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        page: int = 1,
        size: int = 20,
    ) -> list[Request]:
        logger.debug(
            "Getting active requests page by user",
            model=cls.model,
            user_id=user_id,
            page=page,
            size=size,
        )
        try:
            offset = max(page - 1, 0) * size
            stmt = (
                select(cls.model)
                .where(
                    cls.model.user_id == user_id,
                    cls.model.status != RequestStatus.CLOSED.value,
                )
                .order_by(cls.model.created_at.desc())
                .offset(offset)
                .limit(size)
            )
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got active requests page",
                model=cls.model.__name__,
                count=len(result),
                user_id=user_id,
                page=page,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get active requests page",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_closed_page_by_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        *,
        page: int = 1,
        size: int = 20,
    ) -> list[Request]:
        return await cls.get_page(
            session,
            page=page,
            size=size,
            user_id=user_id,
            status=RequestStatus.CLOSED.value,
            order_by=cls.model.created_at.desc(),
        )
