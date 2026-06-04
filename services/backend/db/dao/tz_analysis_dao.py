import uuid

from loguru import logger
from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.tz_analysis import TZAnalysis
from backend.enums import TZAnalysisHistoryGroup


class TZAnalysisDAO(BaseDAO[TZAnalysis]):
    model = TZAnalysis

    @classmethod
    async def get_by_user(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> list[TZAnalysis]:
        logger.debug("Getting TZ analyses by user", user_id=user_id)
        try:
            stmt = (
                select(cls.model)
                .where(cls.model.user_id == user_id)
                .order_by(cls.model.created_at.desc())
            )
            result = list((await session.execute(stmt)).scalars().all())
            logger.info(
                "Got TZ analyses by user",
                count=len(result),
                user_id=user_id,
            )
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ analyses by user",
                error=str(exc),
                user_id=user_id,
            )
            raise

    @classmethod
    async def get_history_page_by_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        group: TZAnalysisHistoryGroup,
        *,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
    ) -> tuple[list[TZAnalysis], bool]:
        """Return a page of TZ analyses for a history tab."""
        logger.debug(
            "Getting TZ analysis history page",
            user_id=user_id,
            group=group,
            page=page,
            size=size,
        )
        try:
            offset = max(page - 1, 0) * size
            stmt = (
                select(cls.model)
                .where(
                    cls.model.user_id == user_id,
                    cls.model.status == group.value,
                )
                .order_by(cls.model.created_at.desc())
                .offset(offset)
                .limit(size + 1)
            )
            if search:
                pattern = f"%{search.strip()}%"
                kp_filenames_text = cast(cls.model.kp_filenames, String)
                stmt = stmt.where(
                    or_(
                        cls.model.title.ilike(pattern),
                        cls.model.tz_filename.ilike(pattern),
                        cls.model.kp_filename.ilike(pattern),
                        kp_filenames_text.ilike(pattern),
                    )
                )
            rows = list((await session.execute(stmt)).scalars().all())
            has_more = len(rows) > size
            return rows[:size], has_more
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ analysis history page",
                error=str(exc),
                user_id=user_id,
                group=group,
            )
            raise

    @classmethod
    async def get_by_id_and_user(
        cls,
        session: AsyncSession,
        analysis_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> TZAnalysis | None:
        logger.debug(
            "Getting TZ analysis by id and user",
            analysis_id=analysis_id,
            user_id=user_id,
        )
        try:
            stmt = select(cls.model).where(
                cls.model.id == analysis_id,
                cls.model.user_id == user_id,
            )
            result = (await session.execute(stmt)).scalar_one_or_none()
            return result
        except Exception as exc:
            await session.rollback()
            logger.exception(
                "Failed to get TZ analysis by id and user",
                error=str(exc),
                analysis_id=analysis_id,
            )
            raise

    @classmethod
    async def confirm_analysis(
        cls,
        session: AsyncSession,
        analysis_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> TZAnalysis | None:
        """Mark analysis as confirmed by the user after review."""
        row = await cls.get_by_id_and_user(session, analysis_id, user_id)
        if not row:
            return None
        return await cls.update_fields(
            session,
            analysis_id,
            confirmed=True,
        )
