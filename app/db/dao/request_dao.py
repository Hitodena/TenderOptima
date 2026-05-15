import uuid

from loguru import logger
from sqlalchemy import select, update
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
            stmt = select(cls.model).where(cls.model.id == request_id)
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got instance",
                    model=cls.model,
                    instance=instance,
                    request_id=request_id,
                )
            else:
                logger.info(
                    "Instance not found",
                    model=cls.model,
                    request_id=request_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instance by id",
                error=str(exc),
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
            if instance:
                logger.info(
                    "Got instance",
                    model=cls.model,
                    instance=instance,
                    tracking_id=tracking_id,
                )
            else:
                logger.info(
                    "Instance not found",
                    model=cls.model,
                    tracking_id=tracking_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instance by tracking id",
                error=str(exc),
                model=cls.model,
                tracking_id=tracking_id,
            )
            raise

    @classmethod
    async def update_status(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        status: str,
    ) -> None:
        logger.debug(
            "Updating request status",
            model=cls.model,
            request_id=request_id,
            status=status,
        )
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(status=status)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request status",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_all_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        logger.debug(
            "Getting all requests by user", model=cls.model, user_id=user_id
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
            )
            result = await session.execute(stmt)
            requests = list(result.scalars().all())
            logger.info(
                "Got requests by user",
                model=cls.model.__name__,
                count=len(requests),
                user_id=user_id,
            )
            return requests
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get requests by user",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise
