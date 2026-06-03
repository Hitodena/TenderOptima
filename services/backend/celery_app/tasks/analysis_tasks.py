"""Background LLM analysis: TZ/KP comparison and supplier email requirements."""

import uuid
from pathlib import Path

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.db.dao import ResponseAnalysisDAO, TZAnalysisDAO
from backend.enums import TZAnalysisRunStatus
from backend.services.analysis.email import (
    analyze_email,
)
from backend.services.analysis.tz import analyze_tz_files
from backend.services.extraction.router import UnsupportedFileTypeError
from backend.utils.ocr import OcrNotAvailableError
from backend.utils.tz_storage import resolve_tz_analysis_files

config = get_config()


async def _load_email_analysis_context(
    message_id: uuid.UUID,
) -> tuple[str, str, list[Path] | None] | None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from backend.db.models import EmailMessage, RequestSupplier

    db_manager = get_db_manager()
    async with db_manager.session() as session:
        stmt = (
            select(EmailMessage)
            .where(EmailMessage.id == message_id)
            .options(
                selectinload(EmailMessage.request_supplier).selectinload(
                    RequestSupplier.request
                )
            )
        )
        message = (await session.execute(stmt)).scalar_one_or_none()
        if not message or not message.request_supplier:
            return None
        request = message.request_supplier.request
        if not request:
            return None
        params = request.additional_params
        if not params or not isinstance(params, list):
            requirements = ""
        else:
            lines = [str(p).strip() for p in params if str(p).strip()]
            requirements = "\n".join(f"- {line}" for line in lines)
        paths: list[Path] = []
        for att in message.attachments or []:
            if isinstance(att, dict) and att.get("path"):
                paths.append(Path(att["path"]))
        return requirements, message.raw_body or "", paths or None


@app.task(
    name="analysis.tz",
    bind=True,
    soft_time_limit=600,
    time_limit=900,
    max_retries=0,
)
@async_task
async def run_tz_analysis(self, analysis_id: str) -> dict:
    """Run TZ vs KP LLM comparison for a queued analysis row."""
    db_manager = get_db_manager()
    aid = uuid.UUID(analysis_id)
    paths = resolve_tz_analysis_files(aid)
    if not paths:
        logger.error("TZ analysis files missing", analysis_id=analysis_id)
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "files_missing", "analysis_id": analysis_id}

    tz_path, kp_path = paths
    try:
        result = await analyze_tz_files(tz_path, kp_path)
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "TZ analysis failed",
            analysis_id=analysis_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": type(exc).__name__, "analysis_id": analysis_id}
    except Exception as exc:
        logger.exception(
            "TZ analysis unexpected failure",
            analysis_id=analysis_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "failed", "analysis_id": analysis_id}

    items_json = [item.model_dump(mode="json") for item in result.items]
    async with db_manager.session() as session:
        await TZAnalysisDAO.update_fields(
            session,
            aid,
            tz_filename=result.tz_filename or tz_path.name,
            kp_filename=result.kp_filename or kp_path.name,
            items=items_json,
            match_score=result.match_score,
            met_count=result.met_count,
            partial_count=result.partial_count,
            missing_count=result.missing_count,
            not_found_count=result.not_found_count,
            llm_model=config.openai_model,
            status=TZAnalysisRunStatus.ACTIVE.value,
        )
    logger.info("TZ analysis task done", analysis_id=analysis_id)
    return {"status": "active", "analysis_id": analysis_id}


@app.task(
    name="analysis.email",
    bind=True,
    soft_time_limit=600,
    time_limit=900,
    max_retries=0,
)
@async_task
async def run_email_analysis(self, message_id: str) -> dict:
    """Analyze supplier email against request requirements."""
    db_manager = get_db_manager()
    mid = uuid.UUID(message_id)
    ctx = await _load_email_analysis_context(mid)
    if ctx is None:
        logger.error(
            "Email message not found for analysis", message_id=message_id
        )
        return {"error": "not_found", "message_id": message_id}

    requirements, email_body, attachment_paths = ctx
    if not requirements:
        async with db_manager.session() as session:
            row = await ResponseAnalysisDAO.get_by_response_id(session, mid)
            if row:
                await ResponseAnalysisDAO.update_fields(
                    session,
                    row.id,
                    status=TZAnalysisRunStatus.FAILED.value,
                )
        return {"error": "no_requirements", "message_id": message_id}

    try:
        result = await analyze_email(
            user_requirements=requirements,
            email_body=email_body,
            attachment_paths=attachment_paths,
        )
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "Email analysis failed",
            message_id=message_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            row = await ResponseAnalysisDAO.get_by_response_id(session, mid)
            if row:
                await ResponseAnalysisDAO.update_fields(
                    session,
                    row.id,
                    status=TZAnalysisRunStatus.FAILED.value,
                )
        return {"error": type(exc).__name__, "message_id": message_id}
    except Exception as exc:
        logger.exception(
            "Email analysis unexpected failure",
            message_id=message_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            row = await ResponseAnalysisDAO.get_by_response_id(session, mid)
            if row:
                await ResponseAnalysisDAO.update_fields(
                    session,
                    row.id,
                    status=TZAnalysisRunStatus.FAILED.value,
                )
        return {"error": "failed", "message_id": message_id}

    raw = result.model_dump(mode="json")
    async with db_manager.session() as session:
        existing = await ResponseAnalysisDAO.get_by_response_id(session, mid)
        if existing:
            await ResponseAnalysisDAO.update_fields(
                session,
                existing.id,
                raw_llm_response=raw,
                llm_model=config.openai_model,
                status=TZAnalysisRunStatus.ACTIVE.value,
            )
        else:
            await ResponseAnalysisDAO.create(
                session,
                response_id=mid,
                llm_model=config.openai_model,
                raw_llm_response=raw,
                status=TZAnalysisRunStatus.ACTIVE.value,
            )
    logger.info("Email analysis task done", message_id=message_id)
    return {"status": "active", "message_id": message_id}
