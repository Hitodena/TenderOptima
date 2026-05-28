import uuid

import httpx
from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.db.dao import (
    BlacklistedDomainDAO,
    RequestDAO,
    RequestSupplierDAO,
    SearchHistoryDAO,
    SupplierDAO,
)
from backend.enums import RequestStatus, RequestSupplierStatus
from backend.schemas import ParserResult

config = get_config()


@app.task(
    name="parser.search",
    bind=True,
    soft_time_limit=400,
    time_limit=600,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def run_parser_search(self, request_id: str) -> dict:
    db_manager = get_db_manager()
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
        await RequestDAO.update_fields(
            session, req_uuid, status=RequestStatus.SEARCHING.value
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

        candidates: list[tuple[str, ParserResult]] = []
        for result in results:
            if result.domain in blacklisted:
                logger.debug(
                    "Domain blacklisted, skipping", domain=result.domain
                )
                skipped_blacklisted += 1
                continue
            if not result.emails:
                logger.debug("No emails found, skipping", domain=result.domain)
                skipped_no_email += 1
                continue
            candidates.append((result.domain, result))

        async with db_manager.session() as session:
            for domain, result in candidates:
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
                        session,
                        request_id=req_uuid,
                        supplier_id=supplier.id,
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

            await SearchHistoryDAO.create(
                session,
                user_id=user_uuid,
                query=parser_query,
                raw_search_body={"results": raw_results},
                results_count=len(results),
                request_id=req_uuid,
            )
            await RequestDAO.update_fields(
                session, req_uuid, status=RequestStatus.ACTIVE.value
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
        logger.exception(
            "Parser service error in task",
            parser_url=config.parser_url,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await RequestDAO.update_fields(
                session, req_uuid, status=RequestStatus.DRAFT.value
            )
        return {"error": "parser_failed"}

    except Exception as exc:
        logger.exception(
            "Parser search task unexpected failure",
            request_id=request_id,
            error=str(exc),
        )
        async with db_manager.session() as session:
            await RequestDAO.update_fields(
                session, req_uuid, status=RequestStatus.DRAFT.value
            )
        return {"error": "failed"}
