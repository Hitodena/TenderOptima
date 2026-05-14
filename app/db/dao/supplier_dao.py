import uuid
from datetime import datetime

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dao.base_dao import BaseDAO
from app.db.models import Request, RequestSupplier, Supplier


class RequestSupplierDAO(BaseDAO[RequestSupplier]):
    model = RequestSupplier

    @classmethod
    async def get_pending_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[RequestSupplier]:
        logger.debug(
            "Getting pending instances by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(
                    RequestSupplier.request_id == request_id,
                    RequestSupplier.status == "pending",
                )
                .options(
                    selectinload(RequestSupplier.supplier),
                    selectinload(RequestSupplier.request).selectinload(
                        Request.user
                    ),
                )
            )
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            logger.info(
                "Got pending instances",
                model=cls.model,
                count=len(instances),
                request_id=request_id,
            )
            return instances
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get pending instances by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_by_tracking_id(
        cls, session: AsyncSession, tracking_id: uuid.UUID
    ) -> RequestSupplier | None:
        logger.debug(
            "Getting instance by tracking id",
            model=cls.model,
            tracking_id=tracking_id,
        )
        try:
            stmt = (
                select(cls.model)
                .join(RequestSupplier.request)
                .where(Request.tracking_id == tracking_id)
                .options(selectinload(RequestSupplier.response))
                .order_by(RequestSupplier.sent_at.desc())
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got instance",
                    model=cls.model,
                    instance=instance,
                    tracking_id=tracking_id,
                )
            else:
                logger.info(
                    "Instance not found",
                    model=cls.model,
                    tracking_id=tracking_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instance by tracking id",
                error=str(exc),
                model=cls.model,
                tracking_id=tracking_id,
            )
            raise

    @classmethod
    async def get_supplier_by_id(
        cls, session: AsyncSession, rs_id: uuid.UUID
    ) -> RequestSupplier | None:
        logger.debug("Getting supplier by id", model=cls.model, rs_id=rs_id)
        try:
            instance = await session.get(RequestSupplier, rs_id)
            if instance:
                logger.info(
                    "Got supplier",
                    model=cls.model,
                    instance=instance,
                    rs_id=rs_id,
                )
            else:
                logger.info("Supplier not found", model=cls.model, rs_id=rs_id)
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get supplier by id",
                error=str(exc),
                model=cls.model,
                rs_id=rs_id,
            )
            raise

    @classmethod
    async def mark_sending_status(
        cls,
        session: AsyncSession,
        request_supplier: RequestSupplier,
        sent_at: datetime,
        status: str,
        smtp_message_id: str | None = None,
    ) -> None:
        logger.debug(
            "Marking sending status",
            model=cls.model,
            request_supplier=request_supplier,
            status=status,
            sent_at=sent_at,
            smtp_message_id=smtp_message_id,
        )
        try:
            request_supplier.status = status
            request_supplier.smtp_message_id = smtp_message_id
            request_supplier.sent_at = sent_at
            await session.flush()
            await session.commit()
            logger.info(
                "Marked sending status",
                model=cls.model,
                request_supplier=request_supplier,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to mark sending status",
                error=str(exc),
                model=cls.model,
                request_supplier=request_supplier,
                status=status,
            )
            raise

    @classmethod
    async def mark_status(
        cls,
        session: AsyncSession,
        request_supplier: RequestSupplier,
        status: str,
    ) -> None:
        logger.debug(
            "Marking status",
            model=cls.model,
            request_supplier=request_supplier,
            status=status,
        )
        try:
            request_supplier.status = status
            await session.flush()
            await session.commit()
            logger.info(
                "Marked status",
                model=cls.model,
                request_supplier=request_supplier,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to mark status",
                error=str(exc),
                model=cls.model,
                request_supplier=request_supplier,
                status=status,
            )
            raise

    @classmethod
    async def get_by_request_and_supplier(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        supplier_id: uuid.UUID,
    ) -> RequestSupplier | None:
        result = await session.execute(
            select(RequestSupplier).where(
                RequestSupplier.request_id == request_id,
                RequestSupplier.supplier_id == supplier_id,
            )
        )
        return result.scalar_one_or_none()

    @classmethod
    async def count_pending(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> int:
        result = await session.execute(
            select(func.count()).where(
                RequestSupplier.request_id == request_id,
                RequestSupplier.status == "pending",
            )
        )
        return result.scalar_one()


class SupplierDAO(BaseDAO[Supplier]):
    model = Supplier

    @classmethod
    async def get_or_create_by_domain(
        cls,
        session: AsyncSession,
        domain: str,
        defaults: dict,
    ) -> Supplier:
        try:
            result = await session.execute(
                select(cls.model).where(cls.model.domain == domain)
            )
            supplier = result.scalar_one_or_none()
            if supplier is None:
                supplier = await cls.create(session, domain=domain, **defaults)
            return supplier
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed get supplier by domain",
                error=str(exc),
                model=cls.model,
            )
            raise
