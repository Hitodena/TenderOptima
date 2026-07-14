from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.consultation import Consultation
from backend.enums import ConsultationRole, ConsultationStatus


class ConsultationDAO(BaseDAO[Consultation]):
    model = Consultation

    @classmethod
    async def get_by_email(
        cls,
        session: AsyncSession,
        email: str,
    ) -> Consultation | None:
        """Load a consultation by unique email address."""
        stmt = select(cls.model).where(cls.model.email == email)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_phone(
        cls,
        session: AsyncSession,
        phone: str,
    ) -> Consultation | None:
        """Load a consultation by unique phone number."""
        stmt = select(cls.model).where(cls.model.phone == phone)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def count_recent_by_ip(
        cls,
        session: AsyncSession,
        ip_address: str,
        since: datetime,
    ) -> int:
        """Count submissions from an IP since a timestamp (rate-limit check)."""
        stmt = select(func.count()).where(
            cls.model.ip_address == ip_address,
            cls.model.created_at >= since,
        )
        result = await session.execute(stmt)
        return result.scalar_one()

    @classmethod
    async def list_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
        status: ConsultationStatus | None = None,
        role: ConsultationRole | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[Consultation], int]:
        """Return a page of consultations newest-first, with total row count."""
        filters = []
        if status is not None:
            filters.append(cls.model.status == status.value)
        if role is not None:
            filters.append(cls.model.role == role.value)
        if created_from is not None:
            filters.append(cls.model.created_at >= created_from)
        if created_to is not None:
            filters.append(cls.model.created_at <= created_to)

        count_stmt = select(func.count()).select_from(cls.model)
        for condition in filters:
            count_stmt = count_stmt.where(condition)
        total = (await session.execute(count_stmt)).scalar_one()

        offset = max(page - 1, 0) * size
        stmt = select(cls.model)
        for condition in filters:
            stmt = stmt.where(condition)
        stmt = (
            stmt.order_by(cls.model.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        result = list((await session.execute(stmt)).scalars().all())
        return result, total
