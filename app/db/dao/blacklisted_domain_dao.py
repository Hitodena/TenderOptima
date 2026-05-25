import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.base_dao import BaseDAO
from app.db.models import BlacklistedDomain


class BlacklistedDomainDAO(BaseDAO[BlacklistedDomain]):
    model = BlacklistedDomain

    @classmethod
    async def get_domains_set(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> set[BlacklistedDomain]:
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
    async def delete_domain(
        cls, session: AsyncSession, domain_id: uuid.UUID, user_id: uuid.UUID
    ) -> bool:
        logger.debug(
            "Deleting domain",
            model=cls.model,
            domain_id=domain_id,
            user_id=user_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.id == domain_id,
                cls.model.added_by_user_id == user_id,
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if not instance:
                logger.info(
                    "Domain not found for delete",
                    model=cls.model,
                    domain_id=domain_id,
                    user_id=user_id,
                )
                return False
            await session.delete(instance)
            await session.flush()
            await session.commit()
            logger.info(
                "Domain deleted",
                model=cls.model,
                domain_id=domain_id,
                user_id=user_id,
            )
            return True
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to delete domain",
                error=str(exc),
                model=cls.model,
                domain_id=domain_id,
                user_id=user_id,
            )
            raise
