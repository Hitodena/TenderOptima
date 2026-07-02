import uuid

from loguru import logger
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import (
    Request,
    RequestSupplier,
    Supplier,
)
from backend.enums import RequestSupplierStatus, SupplierSource


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
                    cls.model.request_id == request_id,
                    cls.model.sent_status == RequestSupplierStatus.PENDING,
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
        cls, session: AsyncSession, tracking_id: str
    ) -> RequestSupplier | None:
        logger.debug(
            "Getting instance by tracking id",
            model=cls.model,
            tracking_id=tracking_id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.tracking_id == tracking_id)
                .options(selectinload(cls.model.request))
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
    async def get_by_id(
        cls, session: AsyncSession, id: uuid.UUID | str | int
    ) -> RequestSupplier | None:
        """Load RequestSupplier by primary key with supplier and request.user."""
        logger.debug(
            "Getting request supplier by id with relations",
            model=cls.model,
            id=id,
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.id == id)
                .options(
                    selectinload(cls.model.supplier),
                    selectinload(cls.model.request).selectinload(Request.user),
                )
            )
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got request supplier by id",
                    model=cls.model,
                    id=id,
                )
            else:
                logger.info(
                    "Request supplier not found by id",
                    model=cls.model,
                    id=id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get request supplier by id",
                error=str(exc),
                model=cls.model,
                id=id,
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
                cls.model.sent_status == RequestSupplierStatus.PENDING,
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
                .join(Supplier, cls.model.supplier_id == Supplier.id)
                .where(cls.model.request_id == request_id)
                .options(selectinload(cls.model.supplier))
                .order_by(
                    case(
                        (
                            Supplier.from_source
                            == SupplierSource.MANUAL.value,
                            0,
                        ),
                        else_=1,
                    ),
                    cls.model.created_at,
                )
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
    async def set_enabled_bulk(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        rs_ids: list[uuid.UUID],
        enabled: bool,
    ) -> int:
        logger.debug(
            "Bulk setting enabled status",
            model=cls.model,
            request_id=request_id,
            count=len(rs_ids),
            enabled=enabled,
        )
        if not rs_ids:
            return 0
        try:
            stmt = select(cls.model).where(
                cls.model.request_id == request_id,
                cls.model.id.in_(rs_ids),
            )
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            for instance in instances:
                instance.is_enabled = enabled
            await session.flush()
            await session.commit()
            logger.info(
                "Bulk set enabled status on suppliers",
                model=cls.model,
                request_id=request_id,
                updated=len(instances),
                enabled=enabled,
            )
            return len(instances)
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed bulk set enabled status on suppliers",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
                enabled=enabled,
            )
            raise

    @classmethod
    async def set_winner(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        rs_id: uuid.UUID,
    ) -> None:
        """Mark one supplier as winner and clear winner flag on others."""
        logger.debug(
            "Setting winner for request",
            model=cls.model,
            request_id=request_id,
            rs_id=rs_id,
        )
        try:
            stmt = select(cls.model).where(cls.model.request_id == request_id)
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            for instance in instances:
                instance.is_winner = instance.id == rs_id
            await session.flush()
            await session.commit()
            logger.info(
                "Winner set for request",
                model=cls.model,
                request_id=request_id,
                rs_id=rs_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to set winner",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
                rs_id=rs_id,
            )
            raise

    @classmethod
    async def clear_winner(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
    ) -> None:
        """Clear winner flag on all suppliers for the request."""
        logger.debug(
            "Clearing winner for request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = select(cls.model).where(cls.model.request_id == request_id)
            result = await session.execute(stmt)
            instances = list(result.scalars().all())
            for instance in instances:
                instance.is_winner = False
            await session.flush()
            await session.commit()
            logger.info(
                "Winner cleared for request",
                model=cls.model,
                request_id=request_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to clear winner",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
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
