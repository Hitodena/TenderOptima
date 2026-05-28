import uuid

from loguru import logger
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import BlacklistedDomain


class BlacklistedDomainDAO(BaseDAO[BlacklistedDomain]):
    model = BlacklistedDomain

    @classmethod
    async def get_domains_set(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> set[BlacklistedDomain]:
        """Load all blacklisted domains for the given user."""
        logger.debug("Getting domains set", model=cls.model, user_id=user_id)
        try:
            stmt = select(cls.model).where(
                (cls.model.added_by_user_id == user_id)
                | (cls.model.added_by_user_id.is_(None))
            )
            result = await session.execute(stmt)
            domains = set(result.scalars().all())
            logger.info(
                "Got domains set",
                model=cls.model.__name__,
                count=len(domains),
                user_id=user_id,
            )
            return domains
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get domains set",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise

    @classmethod
    async def delete_by_id(
        cls, session: AsyncSession, id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        """Delete a blacklist row by id when it belongs to the given user."""
        logger.debug(
            "Deleting domain by id",
            model=cls.model,
            id=id,
            user_id=user_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.id == id,
                or_(
                    cls.model.added_by_user_id == user_id,
                    cls.model.added_by_user_id.is_(None),
                ),
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if not instance:
                logger.info(
                    "Domain not found for delete",
                    model=cls.model,
                    id=id,
                    user_id=user_id,
                )
                return False
            await session.delete(instance)
            await session.flush()
            await session.commit()
            logger.info(
                "Domain deleted by id",
                model=cls.model,
                id=id,
                user_id=user_id,
            )
            return True
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to delete domain by id",
                error=str(exc),
                model=cls.model,
                id=id,
                user_id=user_id,
            )
            raise
