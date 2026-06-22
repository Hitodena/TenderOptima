"""Queue supplier email analysis Celery jobs."""

import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.celery_app.tasks.analysis_tasks import run_email_analysis
from backend.db.dao import ResponseAnalysisDAO
from backend.db.models import Request
from backend.enums import TZAnalysisRunStatus


def request_has_requirements(request: Request) -> bool:
    """Return True when request has non-empty additional_params list."""
    params = request.additional_params
    if not params or not isinstance(params, list):
        return False
    return any(str(p).strip() for p in params)


async def queue_email_analysis(
    session: AsyncSession,
    message_id: uuid.UUID,
    request: Request,
    *,
    reanalyze: bool = False,
) -> bool:
    """Create PROCESSING analysis row and enqueue Celery task.

    When ``reanalyze`` is False, skip messages that already have ACTIVE or
    PROCESSING analysis. When True (manual re-run), reset ACTIVE rows.

    Returns True if a new job was queued.
    """
    if not request_has_requirements(request):
        logger.debug(
            "Skip email analysis: no requirements",
            message_id=str(message_id),
        )
        return False

    existing = await ResponseAnalysisDAO.get_by_response_id(
        session, message_id
    )
    if existing:
        if existing.status == TZAnalysisRunStatus.PROCESSING.value:
            return False
        if (
            existing.status == TZAnalysisRunStatus.ACTIVE.value
            and not reanalyze
        ):
            return False
        await ResponseAnalysisDAO.update_fields(
            session,
            existing.id,
            raw_llm_response=None,
            previous_parameters=None,
            llm_model="",
            status=TZAnalysisRunStatus.PROCESSING.value,
        )
    else:
        await ResponseAnalysisDAO.create(
            session,
            response_id=message_id,
            llm_model="",
            raw_llm_response=None,
            status=TZAnalysisRunStatus.PROCESSING.value,
        )

    run_email_analysis.delay(str(message_id))  # type: ignore[attr-defined]
    logger.info("Email analysis queued", message_id=str(message_id))
    return True
