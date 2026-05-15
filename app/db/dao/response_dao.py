import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dao.base_dao import BaseDAO
from app.db.models import RequestSupplier, SupplierResponse


class SupplierResponseDAO(BaseDAO[SupplierResponse]):
    model = SupplierResponse

    @classmethod
    async def get_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[SupplierResponse]:
        logger.debug(
            "Getting responses by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                select(cls.model)
                .join(cls.model.request_supplier)
                .where(RequestSupplier.request_id == request_id)
                .options(
                    selectinload(cls.model.request_supplier).selectinload(
                        RequestSupplier.supplier
                    )
                )
                .order_by(SupplierResponse.received_at.desc())
            )
            result = await session.execute(stmt)
            responses = list(result.scalars().all())
            logger.info(
                "Got responses by request",
                model=cls.model.__name__,
                count=len(responses),
                request_id=request_id,
            )
            return responses
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get responses by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise
