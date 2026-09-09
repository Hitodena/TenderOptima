import uuid

from loguru import logger
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import Request
from backend.enums import RequestHistoryGroup, RequestStatus


class RequestDAO(BaseDAO[Request]):
    model = Request

    @classmethod
    async def get_active_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        logger.debug(
            "Getting active requests by user",
            model=cls.model,
            user_id=user_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(
                    cls.model.user_id == user_id,
                    cls.model.status != RequestStatus.CLOSED.value,
                )
                .order_by(cls.model.created_at.desc())
            )
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got active requests by user",
                model=cls.model.__name__,
                count=len(result),
                user_id=user_id,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get active requests by user",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_closed_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        return await cls.get_all(
            session,
            user_id=user_id,
            status=RequestStatus.CLOSED.value,
            order_by=cls.model.created_at.desc(),
        )

    @classmethod
    async def get_history_page_by_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        group: RequestHistoryGroup,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
    ) -> tuple[list[Request], bool]:
        """Return a page of requests for a history tab."""
        logger.debug(
            "Getting request history page",
            model=cls.model,
            user_id=user_id,
            group=group,
            page=page,
            size=size,
        )
        try:
            offset = max(page - 1, 0) * size
            if group == RequestHistoryGroup.CLOSED:
                status_filter = cls.model.status == RequestStatus.CLOSED.value
            else:
                status_filter = cls.model.status != RequestStatus.CLOSED.value
            stmt = (
                select(cls.model)
                .where(
                    cls.model.user_id == user_id,
                    status_filter,
                )
                .order_by(cls.model.created_at.desc())
                .offset(offset)
                .limit(size + 1)
            )
            if search:
                pattern = f"%{search.strip()}%"
                stmt = stmt.where(
                    or_(
                        cls.model.query.ilike(pattern),
                        cls.model.delivery_region.ilike(pattern),
                    )
                )
            rows = list((await session.execute(stmt)).scalars().all())
            has_more = len(rows) > size
            return rows[:size], has_more
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get request history page",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
                group=group,
            )
            raise
