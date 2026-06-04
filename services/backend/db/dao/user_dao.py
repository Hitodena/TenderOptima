import uuid

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import User


class UserDAO(BaseDAO[User]):
    model = User

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str
    ) -> User | None:
        """Load a user by unique email address."""
        logger.debug("Getting user by email", model=cls.model, email=email)
        try:
            stmt = select(cls.model).where(cls.model.email == email)
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got user",
                    instance=instance,
                    model=cls.model,
                    email=email,
                )
            else:
                logger.info(
                    "User not found",
                    model=cls.model,
                    email=email,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get user by email",
                error=str(exc),
                model=cls.model,
                email=email,
            )
            raise

    @classmethod
    async def update_contact_info(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        full_name: str | None = None,
        company_name: str | None = None,
        contact_email: str | None = None,
        business_info: str | None = None,
    ) -> User:
        """Update user contact info when it belongs to the given user."""
        logger.debug(
            "Updating user contact info",
            model=cls.model,
            user_id=user_id,
            full_name=full_name,
            company_name=company_name,
            contact_email=contact_email,
            business_info=business_info,
        )
        try:
            user = await cls.get_by_id(session, user_id)
            if user is None:
                raise ValueError(f"User with id {user_id} not found")
            if full_name is not None:
                user.full_name = full_name
            if company_name is not None:
                user.company_name = company_name
            if contact_email is not None:
                user.contact_email = contact_email
            if business_info is not None:
                user.business_info = business_info
            session.add(user)
            await session.flush()
            await session.refresh(user)
            await session.commit()
            logger.info(
                "User contact info updated", model=cls.model, user_id=user_id
            )
            return user
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update user contact info",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise
