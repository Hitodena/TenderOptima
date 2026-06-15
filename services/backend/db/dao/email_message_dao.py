import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import EmailMessage, RequestSupplier
from backend.enums import EmailMessageDirection
from backend.schemas import ThreadSummaryRow


class EmailMessageDAO(BaseDAO[EmailMessage]):
    model = EmailMessage

    @classmethod
    async def get_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[EmailMessage]:
        """Load all email messages for a request."""
        logger.debug(
            "Getting email messages by request",
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
                .order_by(EmailMessage.received_at.desc())
            )
            result = await session.execute(stmt)
            messages = list(result.scalars().all())
            logger.info(
                "Got email messages by request",
                model=cls.model.__name__,
                count=len(messages),
                request_id=request_id,
            )
            return messages
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get email messages by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_thread_by_request_supplier_id(
        cls, session: AsyncSession, request_supplier_id: uuid.UUID
    ) -> list[EmailMessage]:
        """Return all messages for a request-supplier link, oldest first."""
        logger.debug(
            "Getting email messages by request-supplier id",
            model=cls.model,
            request_supplier_id=request_supplier_id,
        )
        stmt = (
            select(cls.model)
            .where(cls.model.request_supplier_id == request_supplier_id)
            .order_by(cls.model.received_at.asc())
        )
        result = await session.execute(stmt)
        messages = list(result.scalars().all())
        logger.info(
            "Got email messages by request-supplier id",
            model=cls.model.__name__,
            count=len(messages),
            request_supplier_id=request_supplier_id,
        )
        return messages

    @classmethod
    async def get_latest_incoming_by_request_supplier_id(
        cls, session: AsyncSession, request_supplier_id: uuid.UUID
    ) -> EmailMessage | None:
        """Return the most recent incoming message for a request-supplier link."""
        logger.debug(
            "Getting latest incoming message by request-supplier id",
            model=cls.model,
            request_supplier_id=request_supplier_id,
        )
        stmt = (
            select(cls.model)
            .where(
                cls.model.request_supplier_id == request_supplier_id,
                cls.model.direction == EmailMessageDirection.INCOMING.value,
            )
            .order_by(cls.model.received_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        logger.info(
            "Got latest incoming message by request-supplier id",
            model=cls.model.__name__,
            request_supplier_id=request_supplier_id,
        )
        return result.scalar_one_or_none()

    @classmethod
    async def get_incoming_before(
        cls,
        session: AsyncSession,
        request_supplier_id: uuid.UUID,
        before_dt,
        exclude_id: uuid.UUID | None = None,
    ) -> list[EmailMessage]:
        """Incoming messages before *before_dt*, oldest first, with analysis."""
        stmt = (
            select(cls.model)
            .where(
                cls.model.request_supplier_id == request_supplier_id,
                cls.model.direction == EmailMessageDirection.INCOMING.value,
            )
            .options(selectinload(cls.model.analysis))
            .order_by(cls.model.received_at.asc().nulls_last())
        )
        if before_dt is not None:
            stmt = stmt.where(cls.model.received_at < before_dt)
        if exclude_id is not None:
            stmt = stmt.where(cls.model.id != exclude_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_incoming_with_analysis_by_request_supplier_id(
        cls,
        session: AsyncSession,
        request_supplier_id: uuid.UUID,
    ) -> list[EmailMessage]:
        """All incoming messages for a supplier, newest first, with analysis."""
        stmt = (
            select(cls.model)
            .where(
                cls.model.request_supplier_id == request_supplier_id,
                cls.model.direction == EmailMessageDirection.INCOMING.value,
            )
            .options(selectinload(cls.model.analysis))
            .order_by(cls.model.received_at.desc().nulls_last())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_by_imap_id(
        cls, session: AsyncSession, imap_id: str
    ) -> EmailMessage | None:
        """Load an email message by its IMAP ID."""
        logger.debug(
            "Getting email message by IMAP ID",
            model=cls.model,
            imap_id=imap_id,
        )
        stmt = select(cls.model).where(cls.model.imap_id == imap_id)
        result = await session.execute(stmt)
        logger.info(
            "Got email message by IMAP ID",
            model=cls.model.__name__,
            imap_id=imap_id,
        )
        return result.scalar_one_or_none()

    @classmethod
    async def _count_messages_by_request_supplier(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
    ) -> dict[uuid.UUID, int]:
        """Message count per request_supplier_id for enabled links on the request."""
        stmt = (
            select(
                cls.model.request_supplier_id,
                func.count().label("message_count"),
            )
            .join(RequestSupplier)
            .where(
                RequestSupplier.request_id == request_id,
                RequestSupplier.is_enabled.is_(True),
            )
            .group_by(cls.model.request_supplier_id)
        )
        rows = (await session.execute(stmt)).all()
        return {row[0]: int(row[1]) for row in rows}

    @classmethod
    async def _latest_message_per_request_supplier(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
    ) -> list[EmailMessage]:
        """One latest message per enabled request-supplier (PostgreSQL DISTINCT ON)."""
        stmt = (
            select(cls.model)
            .join(cls.model.request_supplier)
            .where(
                RequestSupplier.request_id == request_id,
                RequestSupplier.is_enabled.is_(True),
            )
            .distinct(cls.model.request_supplier_id)
            .order_by(
                cls.model.request_supplier_id,
                cls.model.received_at.desc().nulls_last(),
            )
            .options(
                selectinload(cls.model.request_supplier).selectinload(
                    RequestSupplier.supplier
                )
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_threads_summary(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[ThreadSummaryRow]:
        """Enabled request-suppliers with >=1 message: preview, count, unread flag."""
        logger.debug(
            "Getting thread summaries by request",
            model=cls.model,
            request_id=request_id,
        )
        try:
            counts = await cls._count_messages_by_request_supplier(
                session, request_id
            )
            if not counts:
                return []

            latest_messages = await cls._latest_message_per_request_supplier(
                session, request_id
            )

            summaries: list[ThreadSummaryRow] = []
            for message in latest_messages:
                rs_id = message.request_supplier_id
                if rs_id is None:
                    continue
                count = counts.get(rs_id, 0)
                if count == 0:
                    continue
                try:
                    summaries.append(
                        ThreadSummaryRow.from_message(message, count)
                    )
                except ValueError:
                    logger.warning(
                        "Skipping thread row with missing relations",
                        request_supplier_id=str(rs_id),
                    )
                    continue

            summaries.sort(
                key=lambda row: (
                    row.last_message.received_at.timestamp()
                    if row.last_message.received_at
                    else 0.0
                ),
                reverse=True,
            )
            logger.info(
                "Got thread summaries by request",
                model=cls.model.__name__,
                count=len(summaries),
                request_id=request_id,
            )
            return summaries
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get thread summaries by request",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise
