from typing import Any

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.base import Base


class BaseDAO[T: Base]:
    model: type[T]

    @classmethod
    async def create(cls, session: AsyncSession, **values: Any) -> T | None:
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
            logger.exception(
                "Failed to create instance",
                error=exc,
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
            logger.exception(
                "Failed to get instances",
                error=exc,
                model=cls.model,
                filters=kwargs,
            )
            raise
