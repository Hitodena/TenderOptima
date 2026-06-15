import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.tz_analysis_supplier import TZAnalysisSupplier


class TZAnalysisSupplierDAO(BaseDAO[TZAnalysisSupplier]):
    model = TZAnalysisSupplier

    @classmethod
    async def list_by_analysis(
        cls,
        session: AsyncSession,
        analysis_id: uuid.UUID,
    ) -> list[TZAnalysisSupplier]:
        logger.debug(
            "Listing TZ analysis suppliers",
            analysis_id=str(analysis_id),
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.analysis_id == analysis_id)
                .order_by(cls.model.order_index, cls.model.created_at)
            )
            return list((await session.execute(stmt)).scalars().all())
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to list TZ analysis suppliers",
                error=str(exc),
                analysis_id=str(analysis_id),
            )
            raise

    @classmethod
    async def get_by_id_and_analysis(
        cls,
        session: AsyncSession,
        supplier_id: uuid.UUID,
        analysis_id: uuid.UUID,
    ) -> TZAnalysisSupplier | None:
        try:
            stmt = select(cls.model).where(
                cls.model.id == supplier_id,
                cls.model.analysis_id == analysis_id,
            )
            return (await session.execute(stmt)).scalar_one_or_none()
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ analysis supplier",
                error=str(exc),
                supplier_id=str(supplier_id),
            )
            raise

    @classmethod
    async def next_order_index(
        cls,
        session: AsyncSession,
        analysis_id: uuid.UUID,
    ) -> int:
        suppliers = await cls.list_by_analysis(session, analysis_id)
        if not suppliers:
            return 0
        return max(supplier.order_index for supplier in suppliers) + 1

    @classmethod
    async def name_exists(
        cls,
        session: AsyncSession,
        analysis_id: uuid.UUID,
        name: str,
        *,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        stmt = select(cls.model.id).where(
            cls.model.analysis_id == analysis_id,
            cls.model.name == name,
        )
        if exclude_id is not None:
            stmt = stmt.where(cls.model.id != exclude_id)
        return (await session.execute(stmt)).scalar_one_or_none() is not None
