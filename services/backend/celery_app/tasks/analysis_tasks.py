import uuid
from pathlib import Path

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.db.dao import (
    EmailMessageDAO,
    ResponseAnalysisDAO,
    TZAnalysisDAO,
    TZAnalysisSupplierDAO,
)
from backend.enums import TZAnalysisRunStatus
from backend.services.analysis.email import (
    analyze_email,
)
from backend.services.analysis.tz import (
    analyze_kp_files,
    analyze_supplier_kps,
    compare_only,
    extract_tz_from_file,
)
from backend.services.extraction.router import UnsupportedFileTypeError
from backend.utils.ocr import OcrNotAvailableError
from backend.utils.requirements_struct import (
    count_requirements,
    normalize_requirements_kp,
    normalize_tz_requirements,
    requirements_nonempty,
)
from backend.utils.tz_storage import (
    flatten_supplier_kp_entries,
    resolve_kp_analysis_files,
    resolve_supplier_kp_files,
    resolve_tz_only_file,
)

config = get_config()

_TZ_EXTRACT_SOFT_LIMIT = 6600  # 10 min
_TZ_EXTRACT_TIME_LIMIT = 7200  # 15 min
_KP_COMPARE_SOFT_LIMIT = 6600  # 110 min
_KP_COMPARE_TIME_LIMIT = 7200  # 2 h


async def _merge_prior_matches(
    session,
    request_supplier_id: uuid.UUID,
    before_dt,
    exclude_id: uuid.UUID,
) -> dict[str, str]:
    """Merge offer_value per requirement from earlier analyzed messages."""
    prior = await EmailMessageDAO.get_incoming_before(
        session,
        request_supplier_id,
        before_dt,
        exclude_id=exclude_id,
    )
    merged: dict[str, str] = {}
    for msg in prior:
        analysis = msg.analysis
        if not analysis or analysis.status != TZAnalysisRunStatus.ACTIVE.value:
            continue
        raw = analysis.raw_llm_response or {}
        matches = raw.get("matches") or []
        if not isinstance(matches, list):
            continue
        for item in matches:
            if not isinstance(item, dict):
                continue
            req = str(item.get("requirement") or "").strip()
            value = item.get("offer_value")
            if req and value is not None and str(value).strip():
                merged[req] = str(value)
    return merged


async def _load_email_analysis_context(
    message_id: uuid.UUID,
) -> tuple[str, str, list[Path] | None, dict[str, str]] | None:
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
        current_matches = await _merge_prior_matches(
            session,
            message.request_supplier_id,
            message.received_at,
            exclude_id=message.id,
        )
        return (
            requirements,
            message.raw_body or "",
            paths or None,
            current_matches,
        )


@app.task(
    name="analysis.tz_extract",
    bind=True,
    soft_time_limit=_TZ_EXTRACT_SOFT_LIMIT,
    time_limit=_TZ_EXTRACT_TIME_LIMIT,
    max_retries=0,
)
@async_task
async def run_tz_extract(self, analysis_id: str) -> dict:
    """Extract TZ requirements only (phase 1 of two-phase analysis)."""
    db_manager = get_db_manager()
    aid = uuid.UUID(analysis_id)
    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            logger.error(
                "TZ extract: analysis not found",
                analysis_id=analysis_id,
            )
            return {"error": "not_found", "analysis_id": analysis_id}
    user_id = str(row.user_id)
    tz_path = resolve_tz_only_file(aid)
    if not tz_path:
        logger.error(
            "TZ extract: TZ file missing",
            analysis_id=analysis_id,
            user_id=user_id,
        )
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "files_missing", "analysis_id": analysis_id}

    logger.info(
        "TZ extract task started",
        analysis_id=analysis_id,
        user_id=user_id,
    )
    try:
        requirements_tz = await extract_tz_from_file(
            tz_path,
            analysis_id=analysis_id,
            user_id=user_id,
        )
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "TZ extract failed",
            analysis_id=analysis_id,
            user_id=user_id,
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
            "TZ extract unexpected failure",
            analysis_id=analysis_id,
            user_id=user_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "failed", "analysis_id": analysis_id}

    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            logger.error(
                "TZ extract: analysis not found",
                analysis_id=analysis_id,
            )
            return {"error": "not_found", "analysis_id": analysis_id}
        user_id = str(row.user_id)
        tz_filename = row.tz_filename
        await TZAnalysisDAO.update_fields(
            session,
            aid,
            tz_filename=tz_filename or tz_path.name,
            kp_filename=None,
            kp_filenames=[],
            requirements_tz=requirements_tz,
            requirements_kp={},
            kp_stats={},
            items=[],
            confirmed=False,
            tz_requirements_count=count_requirements(requirements_tz),
            match_score=0,
            met_count=0,
            partial_count=0,
            missing_count=0,
            not_found_count=0,
            llm_model=config.openai_model,
            status=TZAnalysisRunStatus.ACTIVE.value,
        )
    logger.info(
        "TZ extract task done",
        analysis_id=analysis_id,
        user_id=user_id,
    )
    return {"status": "active", "analysis_id": analysis_id}


@app.task(
    name="analysis.tz_kp_compare",
    bind=True,
    soft_time_limit=_KP_COMPARE_SOFT_LIMIT,
    time_limit=_KP_COMPARE_TIME_LIMIT,
    max_retries=0,
)
@async_task
async def run_tz_kp_compare(self, analysis_id: str) -> dict:
    """Extract KP offerings and compare against saved TZ requirements."""
    db_manager = get_db_manager()
    aid = uuid.UUID(analysis_id)
    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            logger.error(
                "TZ KP compare: analysis not found",
                analysis_id=analysis_id,
            )
            return {"error": "not_found", "analysis_id": analysis_id}
        user_id = str(row.user_id)
        requirements_tz = normalize_tz_requirements(row.requirements_tz)
        kp_display_names = list(row.kp_filenames or [])
        suppliers = await TZAnalysisSupplierDAO.list_by_analysis(session, aid)

    if not requirements_nonempty(requirements_tz):
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "no_requirements_tz", "analysis_id": analysis_id}

    try:
        if suppliers:
            supplier_entries: list[tuple[list[str], list[Path]]] = []
            for supplier in suppliers:
                paths = resolve_supplier_kp_files(aid, supplier.id)
                display_names = list(supplier.kp_filenames or [])
                if not paths:
                    logger.error(
                        "TZ KP compare: supplier KP files missing",
                        analysis_id=analysis_id,
                        supplier_id=str(supplier.id),
                    )
                    async with db_manager.session() as session:
                        await TZAnalysisDAO.update_fields(
                            session,
                            aid,
                            status=TZAnalysisRunStatus.FAILED.value,
                        )
                    return {
                        "error": "files_missing",
                        "analysis_id": analysis_id,
                    }
                if len(display_names) != len(paths):
                    logger.error(
                        "TZ KP compare: supplier KP metadata mismatch",
                        analysis_id=analysis_id,
                        supplier_id=str(supplier.id),
                        filenames=len(display_names),
                        paths=len(paths),
                    )
                    async with db_manager.session() as session:
                        await TZAnalysisDAO.update_fields(
                            session,
                            aid,
                            status=TZAnalysisRunStatus.FAILED.value,
                        )
                    return {
                        "error": "files_missing",
                        "analysis_id": analysis_id,
                    }
                supplier_entries.append((display_names, paths))
            kp_payload = flatten_supplier_kp_entries(supplier_entries)
            result = await analyze_supplier_kps(
                requirements_tz,
                kp_payload,
                analysis_id=analysis_id,
                user_id=user_id,
            )
        else:
            kp_paths = resolve_kp_analysis_files(aid)
            if not kp_paths:
                logger.error(
                    "TZ KP compare: KP files missing",
                    analysis_id=analysis_id,
                    user_id=user_id,
                )
                async with db_manager.session() as session:
                    await TZAnalysisDAO.update_fields(
                        session,
                        aid,
                        status=TZAnalysisRunStatus.FAILED.value,
                    )
                return {"error": "files_missing", "analysis_id": analysis_id}
            logger.info(
                "TZ KP compare task started",
                analysis_id=analysis_id,
                user_id=user_id,
            )
            result = await analyze_kp_files(
                requirements_tz,
                kp_paths,
                kp_display_names=kp_display_names or None,
                analysis_id=analysis_id,
                user_id=user_id,
            )
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "TZ KP compare failed",
            analysis_id=analysis_id,
            user_id=user_id,
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
            "TZ KP compare unexpected failure",
            analysis_id=analysis_id,
            user_id=user_id,
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
            kp_filename=result.kp_filename,
            kp_filenames=result.kp_filenames,
            requirements_kp=result.requirements_kp,
            kp_stats=result.kp_stats,
            items=items_json,
            confirmed=True,
            match_score=result.match_score,
            met_count=result.met_count,
            partial_count=result.partial_count,
            missing_count=result.missing_count,
            not_found_count=result.not_found_count,
            tz_requirements_count=result.tz_requirements_count,
            llm_model=config.openai_model,
            status=TZAnalysisRunStatus.ACTIVE.value,
        )
    logger.info(
        "TZ KP compare task done",
        analysis_id=analysis_id,
        user_id=user_id,
    )
    return {"status": "active", "analysis_id": analysis_id}


@app.task(
    name="analysis.tz_compare",
    bind=True,
    soft_time_limit=_KP_COMPARE_SOFT_LIMIT,
    time_limit=_KP_COMPARE_TIME_LIMIT,
    max_retries=0,
)
@async_task
async def run_tz_compare(self, analysis_id: str) -> dict:
    """Re-run TZ vs KP comparison using user-confirmed requirement lists."""
    db_manager = get_db_manager()
    aid = uuid.UUID(analysis_id)
    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            logger.error(
                "TZ compare: analysis not found",
                analysis_id=analysis_id,
            )
            return {"error": "not_found", "analysis_id": analysis_id}
        user_id = str(row.user_id)
        requirements_tz = normalize_tz_requirements(row.requirements_tz)
        requirements_kp = normalize_requirements_kp(row.requirements_kp)

    if not requirements_nonempty(requirements_tz):
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "no_requirements_tz", "analysis_id": analysis_id}
    if not requirements_kp or not any(
        requirements_nonempty(items) for items in requirements_kp.values()
    ):
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "no_requirements_kp", "analysis_id": analysis_id}

    try:
        items = await compare_only(
            requirements_tz,
            requirements_kp,
            analysis_id=analysis_id,
            user_id=user_id,
        )
    except ValueError as exc:
        logger.warning(
            "TZ compare failed",
            analysis_id=analysis_id,
            user_id=user_id,
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
            "TZ compare unexpected failure",
            analysis_id=analysis_id,
            user_id=user_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisDAO.update_fields(
                session,
                aid,
                status=TZAnalysisRunStatus.FAILED.value,
            )
        return {"error": "failed", "analysis_id": analysis_id}

    from backend.schemas.analysis import build_analysis_stats

    kp_filenames = list(row.kp_filenames or [])
    if not kp_filenames:
        kp_filenames = list(requirements_kp.keys())
    if not kp_filenames and row.kp_filename:
        kp_filenames = [row.kp_filename]
    primary_kp = row.kp_filename
    kp_stats, primary_kp, top_stats = build_analysis_stats(
        items,
        kp_filenames,
        primary_kp,
    )
    items_json = [item.model_dump(mode="json") for item in items]
    async with db_manager.session() as session:
        await TZAnalysisDAO.update_fields(
            session,
            aid,
            items=items_json,
            kp_stats=kp_stats,
            kp_filename=primary_kp,
            confirmed=True,
            match_score=top_stats["match_score"],
            met_count=top_stats["met_count"],
            partial_count=top_stats["partial_count"],
            missing_count=top_stats["missing_count"],
            not_found_count=top_stats["not_found_count"],
            tz_requirements_count=count_requirements(requirements_tz),
            llm_model=config.openai_model,
            status=TZAnalysisRunStatus.ACTIVE.value,
        )
    logger.info(
        "TZ compare task done",
        analysis_id=analysis_id,
        user_id=user_id,
    )
    return {"status": "active", "analysis_id": analysis_id}


@app.task(
    name="analysis.email",
    bind=True,
    soft_time_limit=1800,
    time_limit=2100,
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

    requirements, email_body, attachment_paths, current_matches = ctx
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
            existing_matches=current_matches or None,
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
    prev_params = current_matches or None
    async with db_manager.session() as session:
        existing = await ResponseAnalysisDAO.get_by_response_id(session, mid)
        if existing:
            await ResponseAnalysisDAO.update_fields(
                session,
                existing.id,
                raw_llm_response=raw,
                previous_parameters=prev_params,
                llm_model=config.openai_model,
                status=TZAnalysisRunStatus.ACTIVE.value,
            )
        else:
            await ResponseAnalysisDAO.create(
                session,
                response_id=mid,
                llm_model=config.openai_model,
                raw_llm_response=raw,
                previous_parameters=prev_params,
                status=TZAnalysisRunStatus.ACTIVE.value,
            )
    logger.info("Email analysis task done", message_id=message_id)
    return {"status": "active", "message_id": message_id}
