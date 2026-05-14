import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.base_dao import BaseDAO
from app.db.models import User


class UserDAO(BaseDAO[User]):
    model = User

    @classmethod
    async def get_by_id(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> User | None:
        logger.debug("Getting user by id", model=cls.model, user_id=user_id)
        try:
            instance = await session.get(cls.model, user_id)
            if instance:
                logger.info(
                    "Got user",
                    model=cls.model,
                    instance=instance,
                    user_id=user_id,
                )
            else:
                logger.info(
                    "User not found",
                    model=cls.model,
                    user_id=user_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get user by id",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str
    ) -> User | None:
        logger.debug("Getting user by email", model=cls.model, email=email)
        try:
            stmt = select(cls.model).where(cls.model.email == email)
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got user",
                    instance=instance,
                    model=cls.model,
                    email=email,
                )
            else:
                logger.info(
                    "User not found",
                    model=cls.model,
                    email=email,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get user by email",
                error=str(exc),
                model=cls.model,
                email=email,
            )
            raise
