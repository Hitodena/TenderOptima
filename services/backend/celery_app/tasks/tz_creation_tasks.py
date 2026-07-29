"""Celery tasks for the TZ creation wizard (Module 3).

Only the "refine existing" upload step runs in the background — it
reuses Module 2's chunked TZ extraction, which can take a while for
large documents. Chat turns stay synchronous (single short JSON call)
and are handled directly in the API router.
"""

import uuid

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.db.dao import TZCreationMessageDAO, TZCreationSessionDAO
from backend.enums import TZCreationMessageRole, TZCreationStatus
from backend.services.analysis.tz import extract_tz_from_file
from backend.services.analysis.tz_creation import run_post_upload_intake_turn
from backend.services.extraction.router import UnsupportedFileTypeError
from backend.utils.ocr import OcrNotAvailableError
from backend.utils.requirements_struct import (
    count_requirements,
    normalize_tz_requirements,
)
from backend.utils.tz_storage import resolve_tz_creation_file

_TZ_CREATION_EXTRACT_SOFT_LIMIT = 7000  # 1 h 57 min
_TZ_CREATION_EXTRACT_TIME_LIMIT = 7200  # 2 h
_MAX_RETRIES = 2
_RETRY_COUNTDOWN_SEC = 30


def _retry_or_fail(task, exc: Exception) -> None:
    if task.request.retries < task.max_retries:
        raise task.retry(exc=exc, countdown=_RETRY_COUNTDOWN_SEC)


@app.task(
    name="tz_creation.extract_and_analyze",
    bind=True,
    soft_time_limit=_TZ_CREATION_EXTRACT_SOFT_LIMIT,
    time_limit=_TZ_CREATION_EXTRACT_TIME_LIMIT,
    max_retries=_MAX_RETRIES,
)
@async_task
async def run_tz_creation_extract(self, session_id: str) -> dict:
    """Extract an uploaded TZ, then ask what to improve (intake turn).

    Full gap analysis runs later on the user's first chat reply.
    """
    db_manager = get_db_manager()
    sid = uuid.UUID(session_id)

    async with db_manager.session() as session:
        row = await TZCreationSessionDAO.get_by_id(session, sid)
        if not row:
            logger.error(
                "TZ creation extract: session not found",
                session_id=session_id,
            )
            return {"error": "not_found", "session_id": session_id}
        user_id = str(row.user_id)
        context = dict(row.context or {})

    tz_path = resolve_tz_creation_file(sid)
    if not tz_path:
        logger.error(
            "TZ creation extract: TZ file missing",
            session_id=session_id,
            user_id=user_id,
        )
        async with db_manager.session() as session:
            await TZCreationSessionDAO.update_fields(
                session, sid, status=TZCreationStatus.FAILED.value
            )
        return {"error": "files_missing", "session_id": session_id}

    logger.info(
        "TZ creation extract started",
        session_id=session_id,
        user_id=user_id,
    )
    try:
        requirements_tz = await extract_tz_from_file(
            tz_path,
            analysis_id=session_id,
            user_id=user_id,
        )
        extracted_hierarchy = normalize_tz_requirements(requirements_tz)
        intake = await run_post_upload_intake_turn(
            extracted_hierarchy, context
        )
        assistant_message = intake["assistant_message"]
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "TZ creation extract failed",
            session_id=session_id,
            user_id=user_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZCreationSessionDAO.update_fields(
                session, sid, status=TZCreationStatus.FAILED.value
            )
        return {"error": type(exc).__name__, "session_id": session_id}
    except Exception as exc:
        logger.exception(
            "TZ creation extract unexpected failure",
            session_id=session_id,
            user_id=user_id,
            error=str(exc),
            retries=self.request.retries,
            max_retries=self.max_retries,
        )
        _retry_or_fail(self, exc)
        async with db_manager.session() as session:
            await TZCreationSessionDAO.update_fields(
                session, sid, status=TZCreationStatus.FAILED.value
            )
        return {"error": "failed", "session_id": session_id}

    async with db_manager.session() as session:
        await TZCreationMessageDAO.create(
            session,
            session_id=sid,
            role=TZCreationMessageRole.ASSISTANT.value,
            content=assistant_message,
        )
        await TZCreationSessionDAO.update_fields(
            session,
            sid,
            draft_hierarchy=extracted_hierarchy,
            fields=[],
            open_questions=[],
            status=TZCreationStatus.ACTIVE.value,
        )

    logger.info(
        "TZ creation extract finished",
        session_id=session_id,
        user_id=user_id,
        requirements=count_requirements(extracted_hierarchy),
    )
    return {"session_id": session_id, "status": TZCreationStatus.ACTIVE.value}
