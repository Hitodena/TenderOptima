import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.base_dao import BaseDAO
from app.db.models import Request


class RequestDAO(BaseDAO[Request]):
    model = Request

    @classmethod
    async def get_by_id(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> Request | None:
        logger.debug(
            "Getting instance by id", model=cls.model, request_id=request_id
        )
        try:
            instance = await session.get(cls.model, request_id)
            logger.info(
                "Got instance",
                model=cls.model,
                instance=instance,
                request_id=request_id,
            )
            return instance
        except Exception as exc:
            logger.exception(
                "Failed to get instance by id",
                error=exc,
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_by_tracking_id(
        cls, session: AsyncSession, tracking_id: uuid.UUID
    ) -> Request | None:
        logger.debug(
            "Getting instance by tracking id",
            model=cls.model,
            tracking_id=tracking_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.tracking_id == tracking_id
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            logger.info(
                "Got instance",
                model=cls.model,
                instance=instance,
                tracking_id=tracking_id,
            )
            return instance
        except Exception as exc:
            logger.exception(
                "Failed to get instance by tracking id",
                error=exc,
                model=cls.model,
                tracking_id=tracking_id,
            )
            raise
