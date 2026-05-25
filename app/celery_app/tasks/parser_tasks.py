import asyncio
import functools
import uuid

import httpx
from loguru import logger

from app.api.user_requests.schemas import ParserResult
from app.celery_app.celery_config import app
from app.celery_app.context import WorkerContext
from app.core import get_config
from app.db.dao import (
    BlacklistedDomainDAO,
    RequestDAO,
    RequestSupplierDAO,
    SearchHistoryDAO,
    SupplierDAO,
)
from app.enums import RequestStatus, RequestSupplierStatus
from app.utils.search_utils import extract_domain

config = get_config()


def _get_db_manager():
    ctx = WorkerContext._instance
    if ctx is None or ctx.db_manager is None:
        raise RuntimeError("WorkerContext is not initialized")
    return ctx.db_manager


def _async_task(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(func(*args, **kwargs))

    return wrapper


@app.task(
    name="parser.search",
    bind=True,
    soft_time_limit=400,
    time_limit=600,
    max_retries=1,
    default_retry_delay=60,
)
@_async_task
async def run_parser_search(self, request_id: str) -> dict:
    db_manager = _get_db_manager()
    req_uuid = uuid.UUID(request_id)
    parser_query: str | None = None
    user_uuid: uuid.UUID | None = None
    delivery_region: str | None = None
    async with db_manager.session() as session:
        request = await RequestDAO.get_by_id(session, req_uuid)
        if not request:
            return {"error": "not_found"}
        parser_query = request.query
        if request.delivery_region:
            parser_query = f"{parser_query} {request.delivery_region}"
        user_uuid = request.user_id
        delivery_region = request.delivery_region
        await RequestDAO.update_status(
            session, req_uuid, RequestStatus.SEARCHING
        )

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.post(
                config.parser_url,
                json={
                    "query": parser_query,
                    "elements": 100,
                    "user_id": str(user_uuid),
                    "region": delivery_region,
                },
            )
            resp.raise_for_status()
            raw_results: list[dict] = resp.json().get("results", [])

        results = [ParserResult(**r) for r in raw_results]
        logger.info(
            "Parser returned results",
            count=len(results),
            request_id=request_id,
        )

        async with db_manager.session() as session:
            blacklisted = await BlacklistedDomainDAO.get_domains_set(
                session, user_uuid
            )

        saved = 0
        skipped_blacklisted = 0
        skipped_no_email = 0

        for result in results:
            domain = extract_domain(result.domain)

            if domain in blacklisted:
                logger.debug("Domain blacklisted, skipping", domain=domain)
                skipped_blacklisted += 1
                continue

            if not result.emails:
                logger.debug("No emails found, skipping", domain=domain)
                skipped_no_email += 1
                continue

            async with db_manager.session() as session:
                supplier = await SupplierDAO.get_or_create_by_domain(
                    session,
                    domain=domain,
                    defaults={
                        "company_name": result.page_title or domain,
                        "main_email": result.emails[0],
                        "from_source": result.engine,
                        "extra_emails": result.emails,
                    },
                )

                existing = (
                    await RequestSupplierDAO.get_by_request_and_supplier(
                        session, request_id=req_uuid, supplier_id=supplier.id
                    )
                )
                if not existing:
                    await RequestSupplierDAO.create(
                        session,
                        request_id=req_uuid,
                        supplier_id=supplier.id,
                        sent_to_email=result.emails[0],
                        sent_status=RequestSupplierStatus.PENDING,
                    )
                    saved += 1

        async with db_manager.session() as session:
            await SearchHistoryDAO.create(
                session,
                user_id=user_uuid,
                query=parser_query,
                raw_search_body={"results": raw_results},
                results_count=len(results),
                request_id=req_uuid,
            )

            await RequestDAO.update_status(
                session, req_uuid, RequestStatus.ACTIVE
            )

        logger.info(
            "Search done",
            request_id=request_id,
            saved=saved,
            skipped_blacklisted=skipped_blacklisted,
            skipped_no_email=skipped_no_email,
        )
        return {
            "saved": saved,
            "skipped_blacklisted": skipped_blacklisted,
            "skipped_no_email": skipped_no_email,
            "request_id": str(req_uuid),
        }

    except httpx.HTTPError as exc:
        logger.exception("Parser service error in task", error=str(exc))
        async with db_manager.session() as session:
            await RequestDAO.update_status(
                session, req_uuid, RequestStatus.DRAFT
            )
        return {"error": "parser_failed"}

    except Exception as exc:
        logger.exception(
            "Parser search task unexpected failure",
            request_id=request_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await RequestDAO.update_status(
                session, req_uuid, RequestStatus.DRAFT
            )
        return {"error": "failed"}
