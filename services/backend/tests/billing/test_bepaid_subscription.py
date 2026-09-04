"""Unit tests for bePaid monthly subscription helpers."""

from __future__ import annotations

from types import SimpleNamespace

from backend.enums import SubscriptionPaymentMethod
from backend.services.billing.bepaid import (
    build_checkout_payload,
    build_subscription_payload,
    extract_subscription_webhook_fields,
    is_subscription_webhook,
)


def _config(**overrides):
    base = {
        "bepaid_test": True,
        "frontend_base_url": "http://localhost:3000",
        "api_public_base_url": "http://localhost:8000",
        "bepaid_method_card": "credit_card",
        "bepaid_method_sbp": "sbp",
        "bepaid_method_epos": "epos",
        "bepaid_method_erip": "erip",
        "bepaid_erip_service_no": "",
        "bepaid_epos_service_no": "",
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_build_subscription_payload_monthly_infinite():
    payload = build_subscription_payload(
        config=_config(),
        amount_minor=25000,
        currency_code="BYN",
        plan_title="TenderOptima Базовый — 1 месяц",
        tracking_id="abc123",
        customer_email="user@example.com",
        payment_id="pay-1",
    )
    assert payload["tracking_id"] == "abc123"
    assert payload["customer"] == {"email": "user@example.com"}
    assert (
        payload["notification_url"]
        == "http://localhost:8000/billing/payments/webhook"
    )
    assert (
        payload["return_url"]
        == "http://localhost:3000/subscription/payment/success?payment_id=pay-1"
    )
    plan = payload["plan"]
    assert plan["currency"] == "BYN"
    assert plan["infinite"] is True
    assert plan["plan"] == {
        "amount": 25000,
        "interval": 1,
        "interval_unit": "month",
    }


def test_checkout_payload_for_sbp_has_no_subscription_fields():
    payload = build_checkout_payload(
        config=_config(),
        method=SubscriptionPaymentMethod.SBP,
        amount_minor=16000,
        currency_code="BYN",
        description="test",
        tracking_id="trk",
        customer_email=None,
        payment_id="pay-2",
    )
    checkout = payload["checkout"]
    assert checkout["transaction_type"] == "payment"
    assert "plan" not in checkout
    assert checkout["payment_method"]["types"] == ["sbp"]
    assert "infinite" not in checkout


def test_is_subscription_webhook_by_event_and_id():
    assert is_subscription_webhook(
        {"event": "created.subscription", "id": "sbs_1"}
    )
    assert is_subscription_webhook({"id": "sbs_abc", "state": "active"})
    assert not is_subscription_webhook(
        {"transaction": {"status": "successful", "tracking_id": "x"}}
    )
    assert not is_subscription_webhook(
        {"id": "uid-123", "status": "successful"}
    )


def test_extract_subscription_webhook_successful_charge():
    fields = extract_subscription_webhook_fields(
        {
            "id": "sbs_1",
            "state": "active",
            "tracking_id": "trk",
            "renew_at": "2026-10-04T12:00:00Z",
            "last_transaction": {
                "uid": "tx-111",
                "status": "successful",
            },
            "plan": {
                "currency": "BYN",
                "plan": {
                    "amount": 25000,
                    "interval": 1,
                    "interval_unit": "month",
                },
            },
            "event": "created.subscription",
        }
    )
    assert fields["kind"] == "subscription"
    assert fields["subscription_id"] == "sbs_1"
    assert fields["uid"] == "tx-111"
    assert fields["is_successful_charge"] is True
    assert fields["is_terminal_stop"] is False
    assert fields["amount"] == 25000
    assert fields["currency"] == "BYN"


def test_extract_subscription_webhook_canceled():
    fields = extract_subscription_webhook_fields(
        {
            "id": "sbs_2",
            "state": "canceled",
            "tracking_id": "trk",
            "last_transaction": {"uid": "tx-old", "status": "successful"},
        }
    )
    assert fields["is_terminal_stop"] is True
    assert fields["is_successful_charge"] is False


def test_uid_idempotency_marker():
    """Same transaction uid must be treated as already applied by callers."""
    first = extract_subscription_webhook_fields(
        {
            "id": "sbs_3",
            "state": "active",
            "last_transaction": {"uid": "same-uid", "status": "successful"},
        }
    )
    second = extract_subscription_webhook_fields(
        {
            "id": "sbs_3",
            "state": "active",
            "last_transaction": {"uid": "same-uid", "status": "successful"},
        }
    )
    assert first["uid"] == second["uid"] == "same-uid"
    assert first["is_successful_charge"] and second["is_successful_charge"]
