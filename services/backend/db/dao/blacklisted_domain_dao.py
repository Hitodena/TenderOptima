import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import BlacklistedDomain


class BlacklistedDomainDAO(BaseDAO[BlacklistedDomain]):
    model = BlacklistedDomain

    @classmethod
    async def get_domains_set(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> set[BlacklistedDomain]:
        """Load user blacklist entries and global blacklist for parser exclusion."""
        logger.debug("Getting domains set", model=cls.model, user_id=user_id)
        try:
            stmt = select(cls.model).where(
                (cls.model.added_by_user_id == user_id)
                | (cls.model.is_global.is_(True))
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
    async def get_excluded_domain_names(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[str]:
        """User and global blacklist domain names for parser exclusion."""
        domains = await cls.get_domains_set(session, user_id)
        return sorted({d.domain.lower() for d in domains})

    @classmethod
    async def delete_by_id(
        cls,
        session: AsyncSession,
        id: uuid.UUID,
        user_id: uuid.UUID,
        *,
        is_admin: bool = False,
    ) -> bool:
        """Delete a blacklist row owned by the user or global when admin."""
        logger.debug(
            "Deleting domain by id",
            model=cls.model,
            id=id,
            user_id=user_id,
            is_admin=is_admin,
        )
        try:
            stmt = select(cls.model).where(cls.model.id == id)
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
            if instance.is_global:
                if not is_admin:
                    logger.info(
                        "Global domain delete denied",
                        model=cls.model,
                        id=id,
                        user_id=user_id,
                    )
                    return False
            elif instance.added_by_user_id != user_id:
                logger.info(
                    "Domain not owned by user",
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
