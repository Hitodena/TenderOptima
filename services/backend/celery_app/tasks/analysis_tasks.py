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
from backend.enums import TZAnalysisRunStatus, TZAnalysisSupplierStatus
from backend.schemas.analysis import (
    RequirementMatch,
    TZAnalysisItem,
    build_analysis_stats,
)
from backend.services.analysis.email import (
    analyze_email,
)
from backend.services.analysis.tz import (
    analyze_kp_files,
    analyze_supplier_kps,
    extract_tz_from_file,
)
from backend.services.extraction.router import UnsupportedFileTypeError
from backend.utils.ocr import OcrNotAvailableError
from backend.utils.requirements_struct import (
    count_requirements,
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


def _merge_supplier_kp_result(
    *,
    existing_items: list,
    existing_requirements_kp: dict,
    existing_kp_filenames: list[str],
    new_items: list[TZAnalysisItem],
    new_requirements_kp: dict,
    new_kp_filenames: list[str],
) -> tuple[list, dict, list[str]]:
    """Merge a single supplier's KP analysis into the parent session."""
    new_names = set(new_kp_filenames)
    merged_items = [
        item
        for item in existing_items
        if not isinstance(item, dict) or item.get("kp_name") not in new_names
    ]
    merged_items.extend([item.model_dump(mode="json") for item in new_items])
    merged_requirements_kp = {
        **existing_requirements_kp,
        **new_requirements_kp,
    }
    merged_filenames = list(existing_kp_filenames)
    for name in new_kp_filenames:
        if name not in merged_filenames:
            merged_filenames.append(name)
    return merged_items, merged_requirements_kp, merged_filenames


def _all_supplier_kp_tasks_done(suppliers) -> bool:
    """True when every supplier with KP files finished processing."""
    active = [supplier for supplier in suppliers if supplier.kp_filenames]
    if not active:
        return False
    terminal = {
        TZAnalysisSupplierStatus.COMPLETED.value,
        TZAnalysisSupplierStatus.FAILED.value,
    }
    return all(supplier.status in terminal for supplier in active)


async def _matches_from_first_analyzed_incoming(
    session,
    request_supplier_id: uuid.UUID,
    exclude_id: uuid.UUID | None = None,
    before_dt=None,
) -> dict[str, str]:
    """Offer values from the first analyzed incoming message (initial supplier response)."""
    prior = await EmailMessageDAO.get_incoming_before(
        session,
        request_supplier_id,
        before_dt=before_dt,
        exclude_id=exclude_id,
    )
    for msg in prior:
        analysis = msg.analysis
        if not analysis or analysis.status != TZAnalysisRunStatus.ACTIVE.value:
            continue
        raw = analysis.raw_llm_response or {}
        matches = raw.get("matches") or []
        if not isinstance(matches, list):
            continue
        initial: dict[str, str] = {}
        for item in matches:
            if not isinstance(item, dict):
                continue
            req = str(item.get("requirement") or "").strip()
            value = item.get("offer_value")
            if req and value is not None and str(value).strip():
                initial[req] = str(value)
        return initial
    return {}


def _matches_dict_from_analysis_raw(raw: dict) -> dict[str, RequirementMatch]:
    """Parse stored analysis matches into a requirement-keyed map."""
    result: dict[str, RequirementMatch] = {}
    matches = raw.get("matches") or []
    if not isinstance(matches, list):
        return result
    for item in matches:
        if not isinstance(item, dict):
            continue
        req = str(item.get("requirement") or "").strip()
        if not req:
            continue
        try:
            result[req] = RequirementMatch(**item)
        except (ValueError, TypeError):
            continue
    return result


async def _prior_matches_from_latest_analyzed_incoming(
    session,
    request_supplier_id: uuid.UUID,
    exclude_id: uuid.UUID | None = None,
    before_dt=None,
) -> dict[str, RequirementMatch]:
    """Full match state from the most recent prior analyzed incoming message."""
    prior = await EmailMessageDAO.get_incoming_before(
        session,
        request_supplier_id,
        before_dt=before_dt,
        exclude_id=exclude_id,
    )
    for msg in reversed(prior):
        analysis = msg.analysis
        if not analysis or analysis.status != TZAnalysisRunStatus.ACTIVE.value:
            continue
        raw = analysis.raw_llm_response or {}
        matches = _matches_dict_from_analysis_raw(raw)
        if matches:
            return matches
    return {}


async def _load_email_analysis_context(
    message_id: uuid.UUID,
) -> (
    tuple[
        str,
        str,
        list[Path] | None,
        dict[str, str],
        dict[str, RequirementMatch],
    ]
    | None
):
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
        baseline_matches = await _matches_from_first_analyzed_incoming(
            session,
            message.request_supplier_id,
            exclude_id=message.id,
            before_dt=message.received_at,
        )
        prior_matches = await _prior_matches_from_latest_analyzed_incoming(
            session,
            message.request_supplier_id,
            exclude_id=message.id,
            before_dt=message.received_at,
        )
        return (
            requirements,
            message.raw_body or "",
            paths or None,
            baseline_matches,
            prior_matches,
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
            supplier_entries: list[tuple[str, list[str], list[Path]]] = []
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
                supplier_entries.append((supplier.name, display_names, paths))
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
    """Re-run direct KP analysis against saved TZ requirements and KP files."""
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
            supplier_entries: list[tuple[str, list[str], list[Path]]] = []
            for supplier in suppliers:
                paths = resolve_supplier_kp_files(aid, supplier.id)
                display_names = list(supplier.kp_filenames or [])
                if not paths:
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
                supplier_entries.append((supplier.name, display_names, paths))
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
                async with db_manager.session() as session:
                    await TZAnalysisDAO.update_fields(
                        session,
                        aid,
                        status=TZAnalysisRunStatus.FAILED.value,
                    )
                return {"error": "files_missing", "analysis_id": analysis_id}
            result = await analyze_kp_files(
                requirements_tz,
                kp_paths,
                kp_display_names=kp_display_names or None,
                analysis_id=analysis_id,
                user_id=user_id,
            )
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
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
        "TZ compare task done",
        analysis_id=analysis_id,
        user_id=user_id,
    )
    return {"status": "active", "analysis_id": analysis_id}


@app.task(
    name="analysis.supplier_kp_process",
    bind=True,
    soft_time_limit=_KP_COMPARE_SOFT_LIMIT,
    time_limit=_KP_COMPARE_TIME_LIMIT,
    max_retries=0,
)
@async_task
async def run_supplier_kp_process(
    self,
    analysis_id: str,
    supplier_id: str,
) -> dict:
    """Extract and compare KP files for a single supplier."""
    logger.info(
        "Supplier KP process task received",
        analysis_id=analysis_id,
        supplier_id=supplier_id,
        task_id=self.request.id,
    )
    db_manager = get_db_manager()
    aid = uuid.UUID(analysis_id)
    sid = uuid.UUID(supplier_id)

    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            logger.error(
                "Supplier KP process: analysis not found",
                analysis_id=analysis_id,
            )
            return {"error": "not_found", "analysis_id": analysis_id}
        supplier = await TZAnalysisSupplierDAO.get_by_id_and_analysis(
            session, sid, aid
        )
        if not supplier:
            logger.error(
                "Supplier KP process: supplier not found",
                analysis_id=analysis_id,
                supplier_id=supplier_id,
            )
            return {"error": "supplier_not_found", "analysis_id": analysis_id}
        user_id = str(row.user_id)
        requirements_tz = normalize_tz_requirements(row.requirements_tz)
        await TZAnalysisSupplierDAO.update_fields(
            session,
            sid,
            status=TZAnalysisSupplierStatus.PROCESSING.value,
        )

    if not requirements_nonempty(requirements_tz):
        async with db_manager.session() as session:
            await TZAnalysisSupplierDAO.update_fields(
                session,
                sid,
                status=TZAnalysisSupplierStatus.FAILED.value,
            )
        return {"error": "no_requirements_tz", "analysis_id": analysis_id}

    paths = resolve_supplier_kp_files(aid, sid)
    display_names = list(supplier.kp_filenames or [])
    if not paths or len(display_names) != len(paths):
        async with db_manager.session() as session:
            await TZAnalysisSupplierDAO.update_fields(
                session,
                sid,
                status=TZAnalysisSupplierStatus.FAILED.value,
            )
        return {"error": "files_missing", "analysis_id": analysis_id}

    kp_payload = flatten_supplier_kp_entries(
        [(supplier.name, display_names, paths)]
    )

    try:
        result = await analyze_supplier_kps(
            requirements_tz,
            kp_payload,
            analysis_id=analysis_id,
            user_id=user_id,
        )
    except (UnsupportedFileTypeError, OcrNotAvailableError, ValueError) as exc:
        logger.warning(
            "Supplier KP process failed",
            analysis_id=analysis_id,
            supplier_id=supplier_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisSupplierDAO.update_fields(
                session,
                sid,
                status=TZAnalysisSupplierStatus.FAILED.value,
            )
        return {"error": type(exc).__name__, "analysis_id": analysis_id}
    except Exception as exc:
        logger.exception(
            "Supplier KP process unexpected failure",
            analysis_id=analysis_id,
            supplier_id=supplier_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await TZAnalysisSupplierDAO.update_fields(
                session,
                sid,
                status=TZAnalysisSupplierStatus.FAILED.value,
            )
        return {"error": "failed", "analysis_id": analysis_id}

    async with db_manager.session() as session:
        row = await TZAnalysisDAO.get_by_id(session, aid)
        if not row:
            return {"error": "not_found", "analysis_id": analysis_id}

        merged_items, merged_req_kp, merged_filenames = (
            _merge_supplier_kp_result(
                existing_items=list(row.items or []),
                existing_requirements_kp=dict(row.requirements_kp or {}),
                existing_kp_filenames=list(row.kp_filenames or []),
                new_items=result.items,
                new_requirements_kp=result.requirements_kp,
                new_kp_filenames=result.kp_filenames,
            )
        )
        items_models = [TZAnalysisItem(**item) for item in merged_items]
        kp_stats, primary_kp, top_stats = build_analysis_stats(
            items_models,
            merged_filenames,
            row.kp_filename,
        )
        if not row.kp_filename and primary_kp:
            row_kp_filename = primary_kp
        else:
            row_kp_filename = row.kp_filename

        await TZAnalysisSupplierDAO.update_fields(
            session,
            sid,
            status=TZAnalysisSupplierStatus.COMPLETED.value,
            primary_kp_filename=(
                supplier.primary_kp_filename
                or (
                    supplier.kp_filenames[0] if supplier.kp_filenames else None
                )
            ),
        )

        await TZAnalysisDAO.update_fields(
            session,
            aid,
            kp_filename=row_kp_filename,
            kp_filenames=merged_filenames,
            requirements_kp=merged_req_kp,
            kp_stats=kp_stats,
            items=merged_items,
            confirmed=bool(row.confirmed),
            match_score=top_stats["match_score"],
            met_count=top_stats["met_count"],
            partial_count=top_stats["partial_count"],
            missing_count=top_stats["missing_count"],
            not_found_count=top_stats["not_found_count"],
            tz_requirements_count=result.tz_requirements_count,
            llm_model=config.openai_model,
            status=TZAnalysisRunStatus.ACTIVE.value,
        )

    logger.info(
        "Supplier KP process done",
        analysis_id=analysis_id,
        supplier_id=supplier_id,
        user_id=user_id,
    )
    return {"status": "completed", "analysis_id": analysis_id}


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

    (
        requirements,
        email_body,
        attachment_paths,
        baseline_matches,
        prior_matches,
    ) = ctx
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
            baseline_matches=baseline_matches or None,
            prior_matches=prior_matches or None,
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
    prev_params = baseline_matches or None
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
