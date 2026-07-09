import uuid
from typing import Any

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from backend.db.models.base import Base


class BaseDAO[T: Base]:
    model: type[T]

    @classmethod
    async def get_by_id(
        cls, session: AsyncSession, id: uuid.UUID | str | int
    ) -> T | None:
        """Load a single row by primary key."""
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
    async def get_all(
        cls,
        session: AsyncSession,
        *,
        order_by: ColumnElement | None = None,
        **kwargs: Any,
    ) -> list[T]:
        """Load all rows."""
        logger.debug("Getting all instances", model=cls.model, filters=kwargs)
        try:
            stmt = select(cls.model).filter_by(**kwargs)
            if order_by is not None:
                stmt = stmt.order_by(order_by)
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
    async def get_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
        order_by: ColumnElement | None = None,
        **kwargs: Any,
    ) -> list[T]:
        """Load a page of rows."""
        logger.debug(
            "Getting page",
            model=cls.model,
            page=page,
            size=size,
            filters=kwargs,
        )
        try:
            offset = max(page - 1, 0) * size
            stmt = select(cls.model).filter_by(**kwargs)
            if order_by is not None:
                stmt = stmt.order_by(order_by)
            stmt = stmt.offset(offset).limit(size)
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got page",
                model=cls.model.__name__,
                count=len(result),
                page=page,
                size=size,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get page",
                error=str(exc),
                model=cls.model,
                page=page,
                size=size,
            )
            raise

    @classmethod
    async def update_fields(
        cls,
        session: AsyncSession,
        id: uuid.UUID | str | int,
        **values: Any,
    ) -> T | None:
        """Update fields of a single row."""
        logger.debug(
            "Updating instance fields",
            model=cls.model,
            id=id,
            fields=list(values.keys()),
        )
        if not values:
            return await cls.get_by_id(session, id)
        try:
            stmt = update(cls.model).where(cls.model.id == id).values(**values)  # type: ignore
            await session.execute(stmt)
            await session.flush()
            await session.commit()
            # Core UPDATE bypasses the identity map; with expire_on_commit=False
            # a cached instance would otherwise keep stale attribute values.
            session.expire_all()
            updated = await cls.get_by_id(session, id)
            logger.info(
                "Updated instance fields",
                model=cls.model.__name__,
                id=id,
            )
            return updated
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update instance fields",
                error=str(exc),
                model=cls.model,
                id=id,
            )
            raise

    @classmethod
    async def delete(
        cls, session: AsyncSession, id: uuid.UUID | str | int
    ) -> bool:
        """Delete a single row."""
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
