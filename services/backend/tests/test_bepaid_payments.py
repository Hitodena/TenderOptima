"""Unit tests for bePaid amount helpers, signature verify, and webhook mapping."""

from __future__ import annotations

import base64
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from backend.core.config import Config
from backend.enums import SubscriptionPaymentMethod
from backend.services.billing.bepaid import (
    amount_to_minor,
    build_checkout_payload,
    extract_webhook_fields,
    map_webhook_status,
    method_to_bepaid_type,
    verify_webhook_basic_auth,
    verify_webhook_signature,
)
from backend.services.billing.payment_activation import compute_renewal_bounds


def test_amount_to_minor_rounds_to_kopecks() -> None:
    assert amount_to_minor(Decimal("160.00")) == 16000
    assert amount_to_minor(Decimal("360.50")) == 36050
    assert amount_to_minor(Decimal("0.01")) == 1


def test_method_to_bepaid_type_uses_config_overrides() -> None:
    config = SimpleNamespace(
        bepaid_method_card="credit_card",
        bepaid_method_sbp="sbp",
        bepaid_method_epos="epos",
        bepaid_method_erip="erip",
    )
    assert (
        method_to_bepaid_type(SubscriptionPaymentMethod.CARD, config)  # type: ignore[arg-type]
        == "credit_card"
    )
    assert (
        method_to_bepaid_type(SubscriptionPaymentMethod.SBP, config)  # type: ignore[arg-type]
        == "sbp"
    )


def test_build_checkout_payload_includes_erip_section() -> None:
    config = SimpleNamespace(
        bepaid_test=True,
        bepaid_method_card="credit_card",
        bepaid_method_sbp="sbp",
        bepaid_method_epos="epos",
        bepaid_method_erip="erip",
        bepaid_erip_service_no="12345678",
        bepaid_epos_service_no="",
        frontend_base_url="http://localhost:3000",
        api_public_base_url="http://localhost:8000",
    )
    payload = build_checkout_payload(
        config=config,  # type: ignore[arg-type]
        method=SubscriptionPaymentMethod.ERIP,
        amount_minor=16000,
        currency_code="BYN",
        description="Подписка",
        tracking_id="abc123tracking",
        customer_email="user@example.com",
        payment_id="pay-1",
    )
    checkout = payload["checkout"]
    assert checkout["order"]["amount"] == 16000
    assert checkout["payment_method"]["types"] == ["erip"]
    assert checkout["payment_method"]["erip"]["service_no"] == "12345678"
    assert "notification_url" in checkout["settings"]


def test_verify_webhook_signature_roundtrip() -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    raw_body = b'{"transaction":{"status":"successful","tracking_id":"t1"}}'
    signature = private_key.sign(raw_body, padding.PKCS1v15(), hashes.SHA256())
    signature_b64 = base64.b64encode(signature).decode("ascii")

    assert verify_webhook_signature(
        public_key=public_pem.decode("utf-8"),
        signature_header=signature_b64,
        raw_body=raw_body,
    )
    assert not verify_webhook_signature(
        public_key=public_pem.decode("utf-8"),
        signature_header=signature_b64,
        raw_body=b'{"tampered":true}',
    )


def test_verify_webhook_basic_auth() -> None:
    config = MagicMock(spec=Config)
    config.bepaid_configured.return_value = True
    config.bepaid_shop_id = "shop"
    config.bepaid_secret_key = "secret"
    assert verify_webhook_basic_auth(
        config=config, username="shop", password="secret"
    )
    assert not verify_webhook_basic_auth(
        config=config, username="shop", password="wrong"
    )


def test_extract_and_map_webhook_status_idempotent_shapes() -> None:
    card_payload = {
        "transaction": {
            "uid": "uid-1",
            "status": "successful",
            "amount": 16000,
            "currency": "BYN",
            "tracking_id": "track-1",
            "test": True,
        }
    }
    fields = extract_webhook_fields(card_payload)
    assert fields["tracking_id"] == "track-1"
    assert fields["amount"] == 16000
    assert map_webhook_status(status=fields["status"], expired=False) == (
        "successful"
    )

    expired_payload = {
        "status": "error",
        "expired": True,
        "order": {"tracking_id": "track-2", "amount": 100, "currency": "BYN"},
    }
    fields2 = extract_webhook_fields(expired_payload)
    assert map_webhook_status(
        status=str(fields2["status"]),
        expired=bool(fields2["expired"]),
    ) == "expired"


def test_compute_renewal_bounds_extends_from_future_expiry() -> None:
    now = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)
    subscription = SimpleNamespace(
        starts_at=datetime(2026, 7, 1, tzinfo=UTC),
        expires_at=datetime(2026, 9, 1, tzinfo=UTC),
    )
    starts_at, expires_at = compute_renewal_bounds(
        subscription,  # type: ignore[arg-type]
        now=now,
    )
    assert starts_at == datetime(2026, 7, 1, tzinfo=UTC)
    assert expires_at == datetime(2026, 10, 1, tzinfo=UTC)


def test_compute_renewal_bounds_from_now_when_expired() -> None:
    now = datetime(2026, 8, 5, 12, 0, tzinfo=UTC)
    subscription = SimpleNamespace(
        starts_at=None,
        expires_at=datetime(2026, 7, 1, tzinfo=UTC),
    )
    starts_at, expires_at = compute_renewal_bounds(
        subscription,  # type: ignore[arg-type]
        now=now,
    )
    assert starts_at == now
    assert expires_at == datetime(2026, 9, 5, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("status", "expired", "expected"),
    [
        ("successful", False, "successful"),
        ("failed", False, "failed"),
        ("pending", False, "pending"),
        ("error", True, "expired"),
        ("unknown", False, None),
    ],
)
def test_map_webhook_status_table(
    status: str, expired: bool, expected: str | None
) -> None:
    assert map_webhook_status(status=status, expired=expired) == expected
