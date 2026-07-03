from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.frontend_error_log import FrontendErrorLog


class FrontendErrorLogDAO(BaseDAO[FrontendErrorLog]):
    model = FrontendErrorLog

    @classmethod
    async def list_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[FrontendErrorLog], int]:
        """Return a page of error logs newest-first, with total row count."""
        offset = max(page - 1, 0) * size
        total = await cls.count(session)
        stmt = (
            select(cls.model)
            .options(joinedload(cls.model.user))
            .order_by(cls.model.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        result = list((await session.execute(stmt)).unique().scalars().all())
        return result, total

    @classmethod
    async def count(cls, session: AsyncSession) -> int:
        """Total number of error log rows."""
        result = await session.execute(
            select(func.count()).select_from(cls.model)
        )
        return result.scalar_one()
