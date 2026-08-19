"""Purpose-specific personal-data cleanup keyed by users.deleted_at."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from loguru import logger
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import (
    EmailMessage,
    FrontendErrorLog,
    IdeaSuggestion,
    Request,
    RequestSupplier,
    SearchHistory,
    TZAnalysis,
    User,
)
from backend.utils.personal_data_retention import get_purpose
from backend.utils.security import hash_password


async def list_deleted_users(session: AsyncSession) -> list[User]:
    """Return soft-deleted user tombstones newest-first."""
    stmt = (
        select(User)
        .where(User.deleted_at.is_not(None))
        .order_by(User.deleted_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def list_eligible_deleted_users(
    session: AsyncSession,
    *,
    purpose_number: int,
    now: datetime | None = None,
) -> list[User]:
    """Users whose deleted_at is old enough for the purpose retention window."""
    purpose = get_purpose(purpose_number)
    if purpose is None or not purpose.cleanup_supported:
        return []
    if purpose.retention_days_after_user_deletion is None:
        return []

    current = now or datetime.now(UTC)
    cutoff = current - timedelta(
        days=purpose.retention_days_after_user_deletion
    )
    stmt = (
        select(User)
        .where(
            User.deleted_at.is_not(None),
            User.deleted_at <= cutoff,
        )
        .order_by(User.deleted_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def cleanup_purpose_for_users(
    session: AsyncSession,
    *,
    purpose_number: int,
    users: list[User],
) -> int:
    """Run purpose cleanup for the provided users. Returns affected row count."""
    if purpose_number == 1:
        return await _cleanup_purpose_1(session, users)
    if purpose_number == 2:
        return await _cleanup_purpose_2(session, users)
    if purpose_number == 4:
        return await _cleanup_purpose_4(session, users)
    if purpose_number == 5:
        return await _cleanup_purpose_5(session, users)
    if purpose_number == 7:
        return await _cleanup_purpose_7(session, users)
    raise ValueError(f"Unsupported purpose number: {purpose_number}")


async def _cleanup_purpose_1(
    session: AsyncSession,
    users: list[User],
) -> int:
    """Finalize registration/access fields, keep anonymized tombstone."""
    affected = 0
    for user in users:
        user.hashed_password = hash_password(secrets.token_urlsafe(32))
        user.failed_login_attempts = 0
        user.lockout_level = 0
        user.locked_until = None
        user.last_login_at = None
        user.referral_invitation_id = None
        user.ref_by = None
        session.add(user)
        affected += 1
    await session.commit()
    logger.info("Purpose 1 cleanup done", users=len(users), affected=affected)
    return affected


async def _cleanup_purpose_2(
    session: AsyncSession,
    users: list[User],
) -> int:
    """Clear request/outreach personal data for deleted users."""
    if not users:
        return 0
    user_ids = [user.id for user in users]
    request_ids = list(
        (
            await session.execute(
                select(Request.id).where(Request.user_id.in_(user_ids))
            )
        )
        .scalars()
        .all()
    )
    affected = 0
    if request_ids:
        req_result = await session.execute(
            update(Request)
            .where(Request.id.in_(request_ids))
            .values(
                description=None,
                additional_params=None,
                email_message=None,
                email_subject=None,
                attachment_paths=None,
            )
        )
        affected += req_result.rowcount or 0

        rs_ids = list(
            (
                await session.execute(
                    select(RequestSupplier.id).where(
                        RequestSupplier.request_id.in_(request_ids)
                    )
                )
            )
            .scalars()
            .all()
        )
        if rs_ids:
            rs_result = await session.execute(
                update(RequestSupplier)
                .where(RequestSupplier.id.in_(rs_ids))
                .values(body_text=None)
            )
            affected += rs_result.rowcount or 0

            msg_result = await session.execute(
                update(EmailMessage)
                .where(EmailMessage.request_supplier_id.in_(rs_ids))
                .values(
                    subject=None,
                    raw_body=None,
                    attachments=None,
                    extracted_text=None,
                    from_email=None,
                    to_email=None,
                )
            )
            affected += msg_result.rowcount or 0

    await session.commit()
    logger.info(
        "Purpose 2 cleanup done",
        users=len(users),
        requests=len(request_ids),
        affected=affected,
    )
    return affected


async def _cleanup_purpose_4(
    session: AsyncSession,
    users: list[User],
) -> int:
    """Anonymize analytics/search history for deleted users."""
    if not users:
        return 0
    user_ids = [user.id for user in users]
    affected = 0

    search_result = await session.execute(
        update(SearchHistory)
        .where(SearchHistory.user_id.in_(user_ids))
        .values(
            query="[redacted]",
            raw_search_body={},
            request_id=None,
        )
    )
    affected += search_result.rowcount or 0

    tz_result = await session.execute(
        update(TZAnalysis)
        .where(TZAnalysis.user_id.in_(user_ids))
        .values(
            title="[redacted]",
            tz_filename=None,
            kp_filename=None,
            kp_filenames=[],
            requirements_tz={},
            requirements_kp={},
            items=[],
            items_overrides={},
            kp_stats={},
        )
    )
    affected += tz_result.rowcount or 0

    await session.commit()
    logger.info("Purpose 4 cleanup done", users=len(users), affected=affected)
    return affected


async def _cleanup_purpose_5(
    session: AsyncSession,
    users: list[User],
) -> int:
    """Delete appeals/feedback rows for deleted users."""
    if not users:
        return 0
    user_ids = [user.id for user in users]
    affected = 0

    ideas = await session.execute(
        delete(IdeaSuggestion).where(IdeaSuggestion.user_id.in_(user_ids))
    )
    affected += ideas.rowcount or 0

    errors = await session.execute(
        delete(FrontendErrorLog).where(FrontendErrorLog.user_id.in_(user_ids))
    )
    affected += errors.rowcount or 0

    await session.commit()
    logger.info("Purpose 5 cleanup done", users=len(users), affected=affected)
    return affected


async def _cleanup_purpose_7(
    session: AsyncSession,
    users: list[User],
) -> int:
    """Ensure marketing consent/contact fields are cleared."""
    affected = 0
    for user in users:
        changed = False
        if user.agree_marketing:
            user.agree_marketing = False
            changed = True
        if user.contact_email is not None:
            user.contact_email = None
            changed = True
        if user.full_name != "Удалённый пользователь":
            user.full_name = "Удалённый пользователь"
            changed = True
        if changed:
            session.add(user)
            affected += 1
    await session.commit()
    logger.info("Purpose 7 cleanup done", users=len(users), affected=affected)
    return affected


def days_since(deleted_at: datetime, *, now: datetime | None = None) -> int:
    """Whole days elapsed since account deletion."""
    current = now or datetime.now(UTC)
    deleted = deleted_at
    if deleted.tzinfo is None:
        deleted = deleted.replace(tzinfo=UTC)
    delta = current - deleted
    return max(0, delta.days)


def days_until_cleanup(
    deleted_at: datetime,
    retention_days: int,
    *,
    now: datetime | None = None,
) -> int:
    """Days remaining until purpose cleanup becomes eligible."""
    elapsed = days_since(deleted_at, now=now)
    return max(0, retention_days - elapsed)


def purpose_ready(
    deleted_at: datetime,
    retention_days: int,
    *,
    now: datetime | None = None,
) -> bool:
    return days_until_cleanup(deleted_at, retention_days, now=now) == 0


def nearest_cleanup_days(
    deleted_at: datetime,
    *,
    now: datetime | None = None,
) -> int | None:
    """Smallest remaining days among supported cleanup purposes."""
    from backend.utils.personal_data_retention import PERSONAL_DATA_PURPOSES

    remainders: list[int] = []
    for purpose in PERSONAL_DATA_PURPOSES:
        if (
            not purpose.cleanup_supported
            or purpose.retention_days_after_user_deletion is None
        ):
            continue
        remainders.append(
            days_until_cleanup(
                deleted_at,
                purpose.retention_days_after_user_deletion,
                now=now,
            )
        )
    if not remainders:
        return None
    return min(remainders)
