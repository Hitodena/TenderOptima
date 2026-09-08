"""DAO for platform-wide supplier email preferences."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.request import Request
from backend.db.models.supplier_email_preference import SupplierEmailPreference
from backend.enums import SupplierEmailPreferenceStatus


class SupplierEmailPreferenceDAO(BaseDAO[SupplierEmailPreference]):
    model = SupplierEmailPreference

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str
    ) -> SupplierEmailPreference | None:
        """Load preference by normalized email."""
        normalized = email.lower().strip()
        if not normalized:
            return None
        stmt = select(cls.model).where(cls.model.email == normalized).limit(1)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def statuses_for_emails(
        cls, session: AsyncSession, emails: list[str]
    ) -> dict[str, str]:
        """Map normalized email -> status for the given addresses."""
        normalized = [e.lower().strip() for e in emails if e and e.strip()]
        if not normalized:
            return {}
        stmt = select(cls.model.email, cls.model.status).where(
            cls.model.email.in_(normalized)
        )
        result = await session.execute(stmt)
        return {row.email: row.status for row in result.all()}

    @classmethod
    async def is_unsubscribed(cls, session: AsyncSession, email: str) -> bool:
        """True when this address opted out of platform RFQ mailings."""
        pref = await cls.get_by_email(session, email)
        return (
            pref is not None
            and pref.status == SupplierEmailPreferenceStatus.UNSUBSCRIBED.value
        )

    @classmethod
    async def list_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
        status: SupplierEmailPreferenceStatus | None = None,
    ) -> tuple[list[tuple[SupplierEmailPreference, str | None]], int]:
        """Return preferences newest-first with optional source request query."""
        filters = []
        if status is not None:
            filters.append(cls.model.status == status.value)

        count_stmt = select(func.count()).select_from(cls.model)
        for condition in filters:
            count_stmt = count_stmt.where(condition)
        total = (await session.execute(count_stmt)).scalar_one()

        source_request = aliased(Request)
        offset = max(page - 1, 0) * size
        stmt = select(cls.model, source_request.query).outerjoin(
            source_request,
            source_request.id == cls.model.source_request_id,
        )
        for condition in filters:
            stmt = stmt.where(condition)
        stmt = (
            stmt.order_by(
                cls.model.subscribed_at.desc().nullslast(),
                cls.model.created_at.desc(),
            )
            .offset(offset)
            .limit(size)
        )
        rows = list((await session.execute(stmt)).all())
        return [(row[0], row[1]) for row in rows], total
