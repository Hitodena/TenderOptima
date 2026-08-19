"""Manual Celery tasks for purpose-specific personal-data cleanup."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.db.dao import PersonalDataCleanupRunDAO
from backend.services.personal_data_cleanup import (
    cleanup_purpose_for_users,
    list_eligible_deleted_users,
)
from backend.utils.personal_data_retention import get_purpose


async def _run_purpose_cleanup(
    *,
    purpose_number: int,
    run_id: str,
) -> dict:
    purpose = get_purpose(purpose_number)
    if purpose is None or not purpose.cleanup_supported:
        raise ValueError(f"Purpose {purpose_number} is not cleanup-supported")

    run_uuid = UUID(run_id)
    db_manager = get_db_manager()
    now = datetime.now(UTC)

    async with db_manager.session() as session:
        eligible = await list_eligible_deleted_users(
            session,
            purpose_number=purpose_number,
            now=now,
        )
        await PersonalDataCleanupRunDAO.mark_started(
            session,
            run_uuid,
            started_at=now,
            eligible_users=len(eligible),
        )

    try:
        async with db_manager.session() as session:
            eligible = await list_eligible_deleted_users(
                session,
                purpose_number=purpose_number,
                now=now,
            )
            affected = await cleanup_purpose_for_users(
                session,
                purpose_number=purpose_number,
                users=eligible,
            )
        async with db_manager.session() as session:
            await PersonalDataCleanupRunDAO.mark_finished(
                session,
                run_uuid,
                finished_at=datetime.now(UTC),
                affected_records=affected,
            )
        logger.info(
            "Personal-data purpose cleanup completed",
            purpose_number=purpose_number,
            run_id=run_id,
            eligible_users=len(eligible),
            affected_records=affected,
        )
        return {
            "status": "completed",
            "purpose_number": purpose_number,
            "run_id": run_id,
            "eligible_users": len(eligible),
            "affected_records": affected,
        }
    except Exception as exc:
        async with db_manager.session() as session:
            await PersonalDataCleanupRunDAO.mark_finished(
                session,
                run_uuid,
                finished_at=datetime.now(UTC),
                affected_records=0,
                error=str(exc),
            )
        logger.exception(
            "Personal-data purpose cleanup failed",
            purpose_number=purpose_number,
            run_id=run_id,
            error=str(exc),
        )
        raise


@app.task(
    name="retention.cleanup_purpose_1",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_purpose_1(self, run_id: str) -> dict:
    return await _run_purpose_cleanup(purpose_number=1, run_id=run_id)


@app.task(
    name="retention.cleanup_purpose_2",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_purpose_2(self, run_id: str) -> dict:
    return await _run_purpose_cleanup(purpose_number=2, run_id=run_id)


@app.task(
    name="retention.cleanup_purpose_4",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_purpose_4(self, run_id: str) -> dict:
    return await _run_purpose_cleanup(purpose_number=4, run_id=run_id)


@app.task(
    name="retention.cleanup_purpose_5",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_purpose_5(self, run_id: str) -> dict:
    return await _run_purpose_cleanup(purpose_number=5, run_id=run_id)


@app.task(
    name="retention.cleanup_purpose_7",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_purpose_7(self, run_id: str) -> dict:
    return await _run_purpose_cleanup(purpose_number=7, run_id=run_id)


PURPOSE_TASKS = {
    1: cleanup_purpose_1,
    2: cleanup_purpose_2,
    4: cleanup_purpose_4,
    5: cleanup_purpose_5,
    7: cleanup_purpose_7,
}
