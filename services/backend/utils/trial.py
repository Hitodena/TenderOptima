"""Onboarding trial of the test plan.

A new account gets the test plan. It can search and walk through the sample
request, but real letters to suppliers go out only during a 14-day trial the
user starts after the onboarding tour. The phone number is already known
from registration, so starting the trial needs no extra data.
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum

from backend.db.models import Subscription
from backend.enums import SubscriptionPlan

TRIAL_DAYS = 14


class TrialState(StrEnum):
    NOT_STARTED = "not_started"
    ACTIVE = "active"
    ENDED = "ended"


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def trial_state(
    subscription: Subscription, now: datetime | None = None
) -> TrialState:
    """Where the trial window stands for this subscription."""
    if (
        subscription.trial_started_at is None
        or subscription.trial_ends_at is None
    ):
        return TrialState.NOT_STARTED
    moment = now or datetime.now(UTC)
    if _aware(subscription.trial_ends_at) > moment:
        return TrialState.ACTIVE
    return TrialState.ENDED


def mailing_needs_trial(
    subscription: Subscription, now: datetime | None = None
) -> bool:
    """True when the test plan may not send real letters right now."""
    if subscription.plan != SubscriptionPlan.TEST.value:
        return False
    return trial_state(subscription, now) != TrialState.ACTIVE


def trial_window(now: datetime | None = None) -> tuple[datetime, datetime]:
    """(started_at, ends_at) for a trial starting now."""
    start = now or datetime.now(UTC)
    return start, start + timedelta(days=TRIAL_DAYS)
