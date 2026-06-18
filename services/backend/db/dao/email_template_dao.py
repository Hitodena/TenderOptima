import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.email_template import EmailTemplate


class EmailTemplateDAO(BaseDAO[EmailTemplate]):
    model = EmailTemplate

    @classmethod
    async def list_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[EmailTemplate]:
        stmt = (
            select(EmailTemplate)
            .where(
                or_(
                    EmailTemplate.user_id == user_id,
                    EmailTemplate.is_global.is_(True),
                )
            )
            .order_by(
                EmailTemplate.is_global.desc(),
                EmailTemplate.created_at.desc(),
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())
