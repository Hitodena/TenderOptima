"""Onboarding: trial window of the test plan and sample letters."""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from backend.enums import SubscriptionPlan
from backend.services.onboarding_demo import (
    DEMO_REQUIREMENTS,
    DEMO_SUPPLIERS,
    _follow_up,
    _letter,
    demo_role,
    follow_up_due,
)
from backend.utils.trial import (
    TRIAL_DAYS,
    TrialState,
    mailing_needs_trial,
    trial_state,
    trial_window,
)

NOW = datetime(2026, 11, 8, 12, 0, tzinfo=UTC)


def _sub(plan=SubscriptionPlan.TEST.value, started=None, ends=None):
    return SimpleNamespace(
        plan=plan, trial_started_at=started, trial_ends_at=ends
    )


class TestTrialState:
    def test_not_started_without_dates(self):
        assert trial_state(_sub(), NOW) == TrialState.NOT_STARTED

    def test_not_started_with_only_start(self):
        assert trial_state(_sub(started=NOW), NOW) == TrialState.NOT_STARTED

    def test_active_inside_window(self):
        sub = _sub(started=NOW, ends=NOW + timedelta(days=14))
        assert trial_state(sub, NOW) == TrialState.ACTIVE

    def test_active_one_second_before_end(self):
        sub = _sub(started=NOW, ends=NOW + timedelta(seconds=1))
        assert trial_state(sub, NOW) == TrialState.ACTIVE

    def test_ended_exactly_at_end(self):
        sub = _sub(started=NOW - timedelta(days=14), ends=NOW)
        assert trial_state(sub, NOW) == TrialState.ENDED

    def test_ended_after_end(self):
        sub = _sub(
            started=NOW - timedelta(days=20), ends=NOW - timedelta(days=6)
        )
        assert trial_state(sub, NOW) == TrialState.ENDED

    def test_naive_dates_are_utc(self):
        naive_end = (NOW + timedelta(days=1)).replace(tzinfo=None)
        sub = _sub(started=NOW.replace(tzinfo=None), ends=naive_end)
        assert trial_state(sub, NOW) == TrialState.ACTIVE


class TestMailingNeedsTrial:
    def test_test_plan_without_trial_is_blocked(self):
        assert mailing_needs_trial(_sub(), NOW) is True

    def test_test_plan_with_active_trial_sends(self):
        sub = _sub(started=NOW, ends=NOW + timedelta(days=3))
        assert mailing_needs_trial(sub, NOW) is False

    def test_test_plan_after_trial_is_blocked(self):
        sub = _sub(started=NOW - timedelta(days=15), ends=NOW)
        assert mailing_needs_trial(sub, NOW) is True

    @pytest.mark.parametrize(
        "plan",
        [p.value for p in SubscriptionPlan if p != SubscriptionPlan.TEST],
    )
    def test_paid_plans_never_need_trial(self, plan):
        assert mailing_needs_trial(_sub(plan=plan), NOW) is False


def test_trial_window_is_fourteen_days():
    start, end = trial_window(NOW)
    assert start == NOW
    assert end - start == timedelta(days=TRIAL_DAYS) == timedelta(days=14)


class TestSampleLetters:
    PRODUCT = "Кабель ВВГнг-LS 3×2,5"

    def test_six_suppliers_with_unique_roles_and_names(self):
        roles = [s.role for s in DEMO_SUPPLIERS]
        names = [s.name for s in DEMO_SUPPLIERS]
        assert len(DEMO_SUPPLIERS) == 6
        assert len(set(roles)) == 6
        assert len(set(names)) == 6

    def test_requirements_are_site_defaults(self):
        assert "Цена за единицу без НДС" in DEMO_REQUIREMENTS
        assert "Сроки поставки" in DEMO_REQUIREMENTS

    @pytest.mark.parametrize("role", ["full", "gaps", "pricey"])
    def test_offers_mention_product_and_price(self, role):
        text = _letter(role, self.PRODUCT, "Ирина")
        assert self.PRODUCT in text
        assert "руб." in text
        assert text.endswith("Ирина")

    def test_gaps_offer_lacks_delivery_time_and_warranty(self):
        text = _letter("gaps", self.PRODUCT, "").lower()
        assert "срок" not in text
        assert "гарант" not in text

    def test_gaps_follow_up_fills_the_gaps(self):
        text = _follow_up("gaps", "").lower()
        assert "сроки поставки" in text
        assert "гарантия" in text

    def test_silent_supplier_has_no_letter(self):
        assert _letter("silent", self.PRODUCT, "") is None

    @pytest.mark.parametrize("role", ["auto", "refusal", "silent", "unknown"])
    def test_no_follow_up_for_non_offers(self, role):
        assert _follow_up(role, "") is None

    def test_no_signature_when_contact_empty(self):
        text = _letter("refusal", self.PRODUCT, "")
        assert "С уважением" not in text


class TestDemoRole:
    def test_reads_role_from_comment(self):
        assert demo_role(SimpleNamespace(comments="demo:gaps")) == "gaps"

    def test_ordinary_supplier_has_no_role(self):
        assert demo_role(SimpleNamespace(comments="хороший поставщик")) is None

    def test_empty_comment(self):
        assert demo_role(SimpleNamespace(comments=None)) is None

    def test_no_supplier(self):
        assert demo_role(None) is None


class TestFollowUpDue:
    """The sample supplier answers the user's first letter after 20 s."""

    T0 = datetime(2026, 11, 8, 10, 0, tzinfo=UTC)

    def _msg(self, direction, minutes=0, seconds=0):
        return SimpleNamespace(
            direction=direction,
            received_at=self.T0 + timedelta(minutes=minutes, seconds=seconds),
        )

    def _thread(self, *extra):
        rfq = self._msg("outgoing")
        offer = self._msg("incoming", minutes=40)
        return [rfq, offer, *extra]

    def test_no_user_letter_no_answer(self):
        now = self.T0 + timedelta(hours=1)
        assert follow_up_due(self._thread(), "gaps", now) is False

    def test_too_early(self):
        asked = self._msg("outgoing", minutes=50)
        now = asked.received_at + timedelta(seconds=19)
        assert follow_up_due(self._thread(asked), "gaps", now) is False

    def test_exactly_twenty_seconds(self):
        asked = self._msg("outgoing", minutes=50)
        now = asked.received_at + timedelta(seconds=20)
        assert follow_up_due(self._thread(asked), "gaps", now) is True

    def test_answered_once_only(self):
        asked = self._msg("outgoing", minutes=50)
        answer = self._msg("incoming", minutes=50, seconds=25)
        now = asked.received_at + timedelta(minutes=5)
        assert follow_up_due(self._thread(asked, answer), "gaps", now) is False

    def test_second_user_letter_gets_no_new_answer(self):
        asked = self._msg("outgoing", minutes=50)
        answer = self._msg("incoming", minutes=50, seconds=25)
        again = self._msg("outgoing", minutes=55)
        now = again.received_at + timedelta(minutes=1)
        thread = self._thread(asked, answer, again)
        assert follow_up_due(thread, "gaps", now) is False

    @pytest.mark.parametrize("role", ["auto", "refusal", "silent", None])
    def test_suppliers_without_answers(self, role):
        asked = self._msg("outgoing", minutes=50)
        now = asked.received_at + timedelta(minutes=1)
        assert follow_up_due(self._thread(asked), role, now) is False

    def test_order_of_rows_does_not_matter(self):
        asked = self._msg("outgoing", minutes=50)
        now = asked.received_at + timedelta(seconds=30)
        thread = list(reversed(self._thread(asked)))
        assert follow_up_due(thread, "full", now) is True
