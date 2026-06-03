import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.response import ResponseAnalysis


class ResponseAnalysisDAO(BaseDAO[ResponseAnalysis]):
    model = ResponseAnalysis

    @classmethod
    async def get_by_response_id(
        cls, session: AsyncSession, response_id: uuid.UUID
    ) -> ResponseAnalysis | None:
        logger.debug(
            "Getting response analysis by response_id",
            response_id=response_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.response_id == response_id
            )
            return (await session.execute(stmt)).scalar_one_or_none()
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get response analysis",
                error=str(exc),
                response_id=response_id,
            )
            raise
