import uuid
from uuid import UUID

from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.base_dao import BaseDAO
from app.db.models import Request
from app.enums import RequestStatus


class RequestDAO(BaseDAO[Request]):
    model = Request

    @classmethod
    async def update_email_message(
        cls, session: AsyncSession, request_id: UUID, email_message: str | None
    ) -> None:
        logger.debug(
            "Updating request email_message",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(email_message=email_message)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()

            logger.info(
                "Updated request email_message",
                model=cls.model.__name__,
                request_id=request_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request email_message",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def update_email_subject(
        cls, session: AsyncSession, request_id: UUID, email_subject: str | None
    ) -> None:
        logger.debug(
            "Updating request email_subject",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(email_subject=email_subject)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()

            logger.info(
                "Updated request email_subject",
                model=cls.model.__name__,
                request_id=request_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request email_subject",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_by_id(
        cls, session: AsyncSession, request_id: uuid.UUID
    ) -> Request | None:
        logger.debug(
            "Getting instance by id", model=cls.model, request_id=request_id
        )
        try:
            stmt = select(cls.model).where(cls.model.id == request_id)
            result = await session.execute(stmt)
            instance = result.scalar_one_or_none()
            if instance:
                logger.info(
                    "Got instance",
                    model=cls.model,
                    instance=instance,
                    request_id=request_id,
                )
            else:
                logger.info(
                    "Instance not found",
                    model=cls.model,
                    request_id=request_id,
                )
            return instance
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get instance by id",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def update_additional_params(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        additional_params: list | None,
        description: str,
    ) -> None:
        logger.debug(
            "Updating request additional_params and description",
            model=cls.model,
            request_id=request_id,
        )
        try:
            values: dict = {
                "additional_params": additional_params,
                "description": description,
            }

            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(**values)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()

            logger.info(
                "Updated request additional_params",
                model=cls.model.__name__,
                request_id=request_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request additional_params",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def update_attachment_paths(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        attachment_paths: list[str] | None,
    ) -> None:
        logger.debug(
            "Updating request attachment_paths",
            model=cls.model,
            request_id=request_id,
        )
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(attachment_paths=attachment_paths)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()

            logger.info(
                "Updated request attachment_paths",
                model=cls.model.__name__,
                request_id=request_id,
            )
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request attachment_paths",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def update_status(
        cls,
        session: AsyncSession,
        request_id: uuid.UUID,
        status: RequestStatus,
    ) -> None:
        logger.debug(
            "Updating request status",
            model=cls.model,
            request_id=request_id,
            status=status,
        )
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == request_id)
                .values(status=status.value)
            )
            await session.execute(stmt)
            await session.flush()
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to update request status",
                error=str(exc),
                model=cls.model,
                request_id=request_id,
            )
            raise

    @classmethod
    async def get_all_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[Request]:
        logger.debug(
            "Getting all requests by user", model=cls.model, user_id=user_id
        )
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
            )
            result = await session.execute(stmt)
            requests = list(result.scalars().all())
            logger.info(
                "Got requests by user",
                model=cls.model.__name__,
                count=len(requests),
                user_id=user_id,
            )
            return requests
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get requests by user",
                error=str(exc),
                model=cls.model,
                user_id=user_id,
            )
            raise
