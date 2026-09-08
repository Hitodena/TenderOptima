"""DAO helpers for the verified supplier registry."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.cooperation import VerifiedSupplier


class VerifiedSupplierDAO(BaseDAO[VerifiedSupplier]):
    model = VerifiedSupplier

    @classmethod
    async def get_by_email(
        cls,
        session: AsyncSession,
        email: str,
    ) -> VerifiedSupplier | None:
        """Load a verified supplier by unique email."""
        stmt = select(cls.model).where(cls.model.email == email)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_source_lead_id(
        cls,
        session: AsyncSession,
        source_lead_id: UUID,
    ) -> VerifiedSupplier | None:
        """Load a verified supplier created from a cooperation lead."""
        stmt = select(cls.model).where(
            cls.model.source_lead_id == source_lead_id
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def create_from_lead(
        cls,
        session: AsyncSession,
        *,
        company_name: str,
        email: str,
        phone: str | None,
        industry: str,
        contact_name: str | None,
        comments: str | None,
        source_lead_id: UUID,
        approved_by_admin_id: UUID,
        agree_marketing: bool = False,
        terms_accepted_at: datetime | None = None,
        terms_version: str | None = None,
        privacy_version: str | None = None,
        consent_ip: str | None = None,
        consent_user_agent: str | None = None,
        marketing_consent_at: datetime | None = None,
        marketing_consent_version: str | None = None,
    ) -> VerifiedSupplier:
        """Insert a verified supplier without committing (caller owns txn)."""
        existing = await cls.get_by_email(session, email)
        consent_fields = {
            "agree_marketing": agree_marketing,
            "terms_accepted_at": terms_accepted_at,
            "terms_version": terms_version,
            "privacy_version": privacy_version,
            "consent_ip": consent_ip,
            "consent_user_agent": consent_user_agent,
            "marketing_consent_at": marketing_consent_at,
            "marketing_consent_version": marketing_consent_version,
        }
        if existing is not None:
            existing.company_name = company_name
            existing.phone = phone
            existing.industry = industry
            existing.contact_name = contact_name
            existing.comments = comments
            existing.source = "cooperation_approval"
            existing.source_lead_id = source_lead_id
            existing.approved_by_admin_id = approved_by_admin_id
            for key, value in consent_fields.items():
                setattr(existing, key, value)
            session.add(existing)
            await session.flush()
            await session.refresh(existing)
            return existing

        row = cls.model(
            company_name=company_name,
            email=email,
            phone=phone,
            industry=industry,
            contact_name=contact_name,
            comments=comments,
            source="cooperation_approval",
            source_lead_id=source_lead_id,
            approved_by_admin_id=approved_by_admin_id,
            **consent_fields,
        )
        session.add(row)
        await session.flush()
        await session.refresh(row)
        return row

    @classmethod
    async def list_page(
        cls,
        session: AsyncSession,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[VerifiedSupplier], int]:
        """Return verified suppliers newest-first."""
        count_stmt = select(func.count()).select_from(cls.model)
        total = (await session.execute(count_stmt)).scalar_one()

        offset = max(page - 1, 0) * size
        stmt = (
            select(cls.model)
            .order_by(cls.model.created_at.desc())
            .offset(offset)
            .limit(size)
        )
        result = list((await session.execute(stmt)).scalars().all())
        return result, total
