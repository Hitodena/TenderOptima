"""Escalating login lockout after repeated failed password attempts."""

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.models import User

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_15_MIN = timedelta(minutes=15)
LOCKOUT_1_HOUR = timedelta(hours=1)
LOCKOUT_24_HOURS = timedelta(hours=24)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def is_account_locked(user: User) -> bool:
    """Return True when the user is within an active lockout window."""
    if user.locked_until is None:
        return False
    locked_until = user.locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    return locked_until > _utcnow()


def raise_if_locked(user: User) -> None:
    """Raise HTTP 429 when the account is temporarily locked."""
    if not is_account_locked(user):
        return
    locked_until = user.locked_until
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=UTC)
    unlock_at = (
        locked_until.strftime("%d.%m.%Y %H:%M UTC") if locked_until else ""
    )
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=(
            f"Слишком много неудачных попыток входа. "
            f"Повторите после {unlock_at}."
        ),
    )


def reset_login_lockout(user: User) -> None:
    """Clear lockout counters after a successful login."""
    user.failed_login_attempts = 0
    user.lockout_level = 0
    user.locked_until = None


async def record_failed_login(
    session: AsyncSession,
    user: User,
) -> bool:
    """Increment failed attempts; apply lockout every fifth failure.

    Returns True when a 24-hour lockout tier was triggered (admin alert).
    """
    user.failed_login_attempts += 1
    send_admin_alert = False

    if user.failed_login_attempts % MAX_FAILED_ATTEMPTS != 0:
        session.add(user)
        await session.commit()
        return send_admin_alert

    now = _utcnow()
    if user.lockout_level == 0:
        user.locked_until = now + LOCKOUT_15_MIN
        user.lockout_level = 1
    elif user.lockout_level == 1:
        user.locked_until = now + LOCKOUT_1_HOUR
        user.lockout_level = 2
    else:
        user.locked_until = now + LOCKOUT_24_HOURS
        send_admin_alert = True

    user.failed_login_attempts = 0
    session.add(user)
    await session.commit()

    logger.warning(
        "Login lockout applied",
        email=user.email,
        lockout_level=user.lockout_level,
        locked_until=user.locked_until.isoformat(),
    )
    return send_admin_alert
