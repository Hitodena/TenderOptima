import uuid
from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.base import Base


class BaseDAO[T: Base]:
    model: type[T]

    @classmethod
    async def get_by_id(
        cls, session: AsyncSession, id: uuid.UUID | str | int
    ) -> T | None:
        logger.debug("Getting instance by id", model=cls.model, id=id)
        try:
            result = await session.get(cls.model, id)
            if result:
                logger.info(
                    "Got instance by id", model=cls.model.__name__, id=id
                )
            else:
                logger.info(
                    "Instance not found by id", model=cls.model.__name__, id=id
                )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instance by id",
                error=str(exc),
                model=cls.model,
                id=id,
            )
            raise

    @classmethod
    async def create(cls, session: AsyncSession, **values: Any) -> T:
        logger.debug("Creating instance", model=cls.model, values=values)
        new_instance = cls.model(**values)
        try:
            session.add(new_instance)
            await session.flush()
            await session.refresh(new_instance)
            await session.commit()
            logger.info(
                "Instance created", model=cls.model, instance=new_instance
            )
            return new_instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to create instance",
                error=str(exc),
                model=cls.model,
                values=values,
            )
            raise

    @classmethod
    async def get_all(cls, session: AsyncSession, **kwargs: Any) -> list[T]:
        logger.debug("Getting all instances", model=cls.model, filters=kwargs)
        try:
            stmt = select(cls.model).filter_by(**kwargs)
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got instances",
                model=cls.model.__name__,
                count=len(result),
                filters=kwargs,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instances",
                error=str(exc),
                model=cls.model,
                filters=kwargs,
            )
            raise

    @classmethod
    async def delete(
        cls, session: AsyncSession, id: uuid.UUID | str | int
    ) -> bool:
        logger.debug("Deleting instance", model=cls.model, id=id)
        try:
            instance = await session.get(cls.model, id)
            if not instance:
                logger.info(
                    "Instance not found for delete",
                    model=cls.model.__name__,
                    id=id,
                )
                return False
            await session.delete(instance)
            await session.flush()
            await session.commit()
            logger.info("Instance deleted", model=cls.model.__name__, id=id)
            return True
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to delete instance",
                error=str(exc),
                model=cls.model,
                id=id,
            )
            raise
