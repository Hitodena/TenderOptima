"""Celery task: soft-delete and purge expired cooperation leads."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.db.dao import CooperationLeadDAO
from backend.utils.personal_data_retention import (
    COOPERATION_LEAD_HARD_DELETE_DAYS,
    COOPERATION_LEAD_SOFT_DELETE_DAYS,
)


@app.task(
    name="retention.cleanup_cooperation_leads",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
@async_task
async def cleanup_cooperation_leads(self) -> dict:
    """Soft-delete moderated leads past retention, then hard-delete old ones."""
    now = datetime.now(UTC)
    soft_cutoff = now - timedelta(days=COOPERATION_LEAD_SOFT_DELETE_DAYS)
    hard_cutoff = now - timedelta(days=COOPERATION_LEAD_HARD_DELETE_DAYS)

    db_manager = get_db_manager()
    async with db_manager.session() as session:
        soft_deleted = await CooperationLeadDAO.soft_delete_due(
            session,
            now=now,
            approved_before=soft_cutoff,
            cancelled_before=soft_cutoff,
        )
        hard_deleted = await CooperationLeadDAO.hard_delete_soft_deleted(
            session,
            deleted_before=hard_cutoff,
        )

    logger.info(
        "Cooperation lead retention cleanup finished",
        soft_deleted=soft_deleted,
        hard_deleted=hard_deleted,
    )
    return {
        "status": "done",
        "soft_deleted": soft_deleted,
        "hard_deleted": hard_deleted,
    }
