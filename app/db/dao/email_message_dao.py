import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.dao.base_dao import BaseDAO
from app.db.models import EmailMessage, RequestSupplier


class EmailMessageDAO(BaseDAO[EmailMessage]):
    model = EmailMessage

    @classmethod
    async def get_by_request(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[EmailMessage]:
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
    async def get_thread(
        cls, session: AsyncSession, request_supplier_id: uuid.UUID
    ) -> list[EmailMessage]:
        stmt = (
            select(cls.model)
            .where(cls.model.request_supplier_id == request_supplier_id)
            .order_by(cls.model.received_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_latest_incoming(
        cls, session: AsyncSession, request_supplier_id: uuid.UUID
    ) -> EmailMessage | None:
        stmt = (
            select(cls.model)
            .where(
                cls.model.request_supplier_id == request_supplier_id,
                cls.model.direction == "incoming",
            )
            .order_by(cls.model.received_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_imap_id(
        cls, session: AsyncSession, imap_id: str
    ) -> EmailMessage | None:
        stmt = select(cls.model).where(cls.model.imap_id == imap_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_threads_summary(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> list[dict]:
        """Returns RequestSuppliers that have >=1 EmailMessage. Includes last msg preview + count + unread heuristic."""
        rs_id_stmt = (
            select(cls.model.request_supplier_id)
            .join(RequestSupplier)
            .where(
                RequestSupplier.request_id == request_id,
                RequestSupplier.is_enabled.is_(True),
            )
            .distinct()
        )
        rs_ids = [row[0] for row in (await session.execute(rs_id_stmt)).all()]
        if not rs_ids:
            return []

        summaries: list[dict] = []
        for rs_id in rs_ids:
            cnt_stmt = select(func.count()).where(
                cls.model.request_supplier_id == rs_id
            )
            message_count = (await session.execute(cnt_stmt)).scalar_one() or 0

            last_stmt = (
                select(cls.model)
                .where(cls.model.request_supplier_id == rs_id)
                .order_by(cls.model.received_at.desc())
                .limit(1)
                .options(
                    selectinload(cls.model.request_supplier).selectinload(
                        RequestSupplier.supplier
                    )
                )
            )
            last = (await session.execute(last_stmt)).scalar_one_or_none()
            if (
                not last
                or not last.request_supplier
                or not last.request_supplier.supplier
            ):
                continue

            rs = last.request_supplier
            sup = rs.supplier
            preview = (last.raw_body or last.subject or "")[:280]
            last_msg = {
                "id": str(last.id),
                "direction": last.direction,
                "subject": last.subject,
                "body": preview + ("..." if len(preview) == 280 else ""),
                "received_at": last.received_at.isoformat()
                if last.received_at
                else None,
            }
            unread = last.direction == "incoming"

            summaries.append(
                {
                    "rs_id": str(rs_id),
                    "supplier": {
                        "id": str(sup.id),
                        "domain": sup.domain,
                        "company_name": sup.company_name,
                        "email": sup.email,
                    },
                    "last_message": last_msg,
                    "message_count": message_count,
                    "unread": unread,
                }
            )

        summaries.sort(
            key=lambda s: s.get("last_message", {}).get("received_at") or "",
            reverse=True,
        )
        return summaries
