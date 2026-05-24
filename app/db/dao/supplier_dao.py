import uuid
from datetime import datetime

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dao.base_dao import BaseDAO
from app.db.models import (
    Request,
    RequestSupplier,
    Supplier,
)
from app.enums import RequestSupplierStatus


class RequestSupplierDAO(BaseDAO[RequestSupplier]):
    model = RequestSupplier

    @classmethod
    async def update_body_text(
        cls, session: AsyncSession, rs_id: uuid.UUID, body_text: str
    ) -> None:
        logger.debug(
            "Updating request supplier body_text",
            model=cls.model,
            rs_id=rs_id,
        )
        try:
            instance = await session.get(cls.model, rs_id)
            if instance:
                instance.body_text = body_text
                await session.flush()
                await session.commit()
                logger.info(
                    "Updated request supplier body_text",
                    model=cls.model.__name__,
                    rs_id=rs_id,
                )
            else:
                logger.info(
                    "Request supplier not found for update_body_text",
                    model=cls.model,
                    rs_id=rs_id,
                )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request supplier body_text",
                error=str(exc),
                model=cls.model,
                rs_id=rs_id,
            )
            raise

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
                    cls.model.request_id == request_id,
                    cls.model.status == RequestSupplierStatus.PENDING.value,
                    cls.model.is_enabled.is_(True),
                )
                .options(
                    selectinload(cls.model.supplier),
                    selectinload(cls.model.request).selectinload(Request.user),
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
                .where(cls.model.tracking_id == tracking_id)  # ← без джоина
                .options(selectinload(cls.model.response))
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
            instance = await session.get(cls.model, rs_id)
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
    async def delete_for_request(
        cls, session: AsyncSession, rs_id: uuid.UUID, request_id: uuid.UUID
    ) -> bool:
        logger.debug(
            "Deleting request-supplier link",
            model=cls.model,
            rs_id=rs_id,
            request_id=request_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.id == rs_id,
                cls.model.request_id == request_id,
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if not instance:
                logger.info(
                    "RequestSupplier not found for delete",
                    model=cls.model,
                    rs_id=rs_id,
                    request_id=request_id,
                )
                return False
            await session.delete(instance)
            await session.flush()
            await session.commit()
            logger.info(
                "RequestSupplier deleted",
                model=cls.model.__name__,
                rs_id=rs_id,
                request_id=request_id,
            )
            return True
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to delete request-supplier link",
                error=str(exc),
                model=cls.model,
                rs_id=rs_id,
                request_id=request_id,
            )
            raise

    @classmethod
    async def mark_status(
        cls,
        session: AsyncSession,
        request_supplier: RequestSupplier,
        status: RequestSupplierStatus,
        sent_at: datetime | None = None,
        smtp_message_id: str | None = None,
    ) -> None:
        logger.debug(
            "Marking status",
            model=cls.model,
            request_supplier=request_supplier,
            status=status,
            sent_at=sent_at,
            smtp_message_id=smtp_message_id,
        )
        try:
            request_supplier.status = status
            if sent_at is not None:
                request_supplier.sent_at = sent_at
            if smtp_message_id is not None:
                request_supplier.smtp_message_id = smtp_message_id
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
        logger.debug(
            "Getting by request and supplier",
            model=cls.model,
            request_id=request_id,
            supplier_id=supplier_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.request_id == request_id,
                cls.model.supplier_id == supplier_id,
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got RequstSupplier by request and supplier",
                    model=cls.model,
                    instance=instance,
                    request_id=request_id,
                    supplier_id=supplier_id,
                )
            else:
                logger.info(
                    "RequstSupplier not found by request and supplier",
                    model=cls.model,
                    request_id=request_id,
                    supplier_id=supplier_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get RequestSupplier by request and supplier",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
                supplier_id=supplier_id,
            )
            raise

    @classmethod
    async def count_pending(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> int:
        logger.debug(
            "Counting pending by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = select(func.count()).where(
                cls.model.request_id == request_id,
                cls.model.status == RequestSupplierStatus.PENDING,
                cls.model.is_enabled.is_(True),
            )
            result = await session.execute(stmt)
            count = result.scalar_one()
            logger.info(
                "Counted pending",
                model=cls.model.__name__,
                count=count,
                request_id=request_id,
            )
            return count
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to count pending",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[RequestSupplier]:
        logger.debug(
            "Getting suppliers by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.request_id == request_id)
                .options(selectinload(cls.model.supplier))
            )
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            logger.info(
                "Got suppliers by request",
                model=cls.model,
                count=len(instances),
                request_id=request_id,
            )
            return instances
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get suppliers by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def set_enabled(
        cls, session: AsyncSession, rs_id: uuid.UUID, enabled: bool
    ) -> RequestSupplier | None:
        logger.debug(
            "Setting enabled status",
            model=cls.model,
            rs_id=rs_id,
            enabled=enabled,
        )
        try:
            instance = await session.get(cls.model, rs_id)
            if instance:
                instance.is_enabled = enabled
                await session.flush()
                await session.commit()
                logger.info(
                    "Set enabled status on supplier",
                    model=cls.model,
                    rs_id=rs_id,
                    enabled=enabled,
                )
            else:
                logger.info(
                    "Supplier not found for set_enabled",
                    model=cls.model,
                    rs_id=rs_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to set enabled status on supplier",
                error=str(exc),
                model=cls.model,
                rs_id=rs_id,
                enabled=enabled,
            )
            raise

    @classmethod
    async def get_enabled_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[RequestSupplier]:
        logger.debug(
            "Getting enabled instances by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(
                    cls.model.request_id == request_id,
                    cls.model.is_enabled.is_(True),
                )
                .options(selectinload(cls.model.supplier))
            )
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            logger.info(
                "Got enabled instances by request",
                model=cls.model,
                count=len(instances),
                request_id=request_id,
            )
            return instances
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get enabled instances by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise


class SupplierDAO(BaseDAO[Supplier]):
    model = Supplier

    @classmethod
    async def get_or_create_by_domain(
        cls,
        session: AsyncSession,
        domain: str | None,
        defaults: dict,
    ) -> Supplier:
        logger.debug(
            "Getting or creating supplier by domain",
            model=cls.model,
            domain=domain,
        )
        try:
            supplier = await cls.get_by_domain(session, domain)
            if supplier is None:
                supplier = await cls.create(session, domain=domain, **defaults)
                logger.info(
                    "Created new supplier by domain",
                    model=cls.model.__name__,
                    domain=domain,
                )
            else:
                logger.info(
                    "Got existing supplier by domain",
                    model=cls.model.__name__,
                    domain=domain,
                )
            return supplier
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed get supplier by domain",
                error=str(exc),
                model=cls.model,
            )
            raise

    @classmethod
    async def get_by_domain(
        cls, session: AsyncSession, domain: str | None
    ) -> Supplier | None:
        logger.debug(
            "Getting supplier by domain", model=cls.model, domain=domain
        )
        try:
            stmt = select(cls.model)
            if domain is not None:
                stmt = stmt.where(cls.model.domain == domain)
            else:
                return None
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got supplier by domain", model=cls.model, domain=domain
                )
            else:
                logger.info(
                    "Supplier not found by domain",
                    model=cls.model,
                    domain=domain,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get supplier by domain",
                error=str(exc),
                model=cls.model,
                domain=domain,
            )
            raise
