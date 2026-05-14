import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.base_dao import BaseDAO
from app.db.models import BlacklistedDomain


class BlacklistedDomainDAO(BaseDAO[BlacklistedDomain]):
    model = BlacklistedDomain

    @classmethod
    async def get_domains_set(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> set[str]:
        result = await session.execute(
            select(BlacklistedDomain.domain).where(
                (BlacklistedDomain.added_by_user_id == user_id)
                | (BlacklistedDomain.added_by_user_id.is_(None))
            )
        )
        return set(result.scalars().all())
