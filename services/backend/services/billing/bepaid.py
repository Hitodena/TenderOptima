"""bePaid checkout token client and webhook verification."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from loguru import logger

from backend.core.config import Config
from backend.enums import SubscriptionPaymentMethod


class BePaidError(Exception):
    """Raised when bePaid API rejects or fails a checkout request."""

    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class BePaidCheckoutResult:
    token: str
    redirect_url: str


def amount_to_minor(amount: Decimal) -> int:
    """Convert a major-unit Decimal amount to minor currency units (kopecks)."""
    return int((amount * 100).quantize(Decimal("1")))


def method_to_bepaid_type(
    method: SubscriptionPaymentMethod, config: Config
) -> str:
    """Map internal method enum to bePaid ``payment_method.types`` value."""
    mapping = {
        SubscriptionPaymentMethod.CARD: config.bepaid_method_card,
        SubscriptionPaymentMethod.SBP: config.bepaid_method_sbp,
        SubscriptionPaymentMethod.EPOS: config.bepaid_method_epos,
        SubscriptionPaymentMethod.ERIP: config.bepaid_method_erip,
    }
    return mapping[method].strip()


def _service_no_for_method(
    method: SubscriptionPaymentMethod, config: Config
) -> str | None:
    if method == SubscriptionPaymentMethod.ERIP:
        value = config.bepaid_erip_service_no.strip()
        return value or None
    if method == SubscriptionPaymentMethod.EPOS:
        value = config.bepaid_epos_service_no.strip()
        return value or None
    return None


def build_checkout_payload(
    *,
    config: Config,
    method: SubscriptionPaymentMethod,
    amount_minor: int,
    currency_code: str,
    description: str,
    tracking_id: str,
    customer_email: str | None,
    payment_id: str,
) -> dict[str, Any]:
    """Build JSON body for ``POST /ctp/api/checkouts``."""
    bepaid_type = method_to_bepaid_type(method, config)
    frontend = config.frontend_base_url.rstrip("/")
    api_base = config.api_public_base_url.rstrip("/")
    success_url = (
        f"{frontend}/subscription/payment/success?payment_id={payment_id}"
    )
    fail_url = f"{frontend}/subscription/payment/fail?payment_id={payment_id}"

    payment_method: dict[str, Any] = {"types": [bepaid_type]}
    if method in (
        SubscriptionPaymentMethod.ERIP,
        SubscriptionPaymentMethod.EPOS,
    ):
        method_section: dict[str, Any] = {
            "account_number": tracking_id[:30],
        }
        service_no = _service_no_for_method(method, config)
        if service_no:
            method_section["service_no"] = service_no
        method_section["service_info"] = [description]
        method_section["receipt"] = ["Спасибо за оплату подписки TenderOptima"]
        payment_method[bepaid_type] = method_section

    checkout: dict[str, Any] = {
        "test": config.bepaid_test,
        "transaction_type": "payment",
        "attempts": 3,
        "settings": {
            "return_url": success_url,
            "success_url": success_url,
            "decline_url": fail_url,
            "fail_url": fail_url,
            "cancel_url": fail_url,
            "notification_url": f"{api_base}/billing/payments/webhook",
            "language": "ru",
        },
        "order": {
            "currency": currency_code,
            "amount": amount_minor,
            "description": description,
            "tracking_id": tracking_id,
        },
        "payment_method": payment_method,
    }
    if customer_email:
        checkout["customer"] = {"email": customer_email}
    return {"checkout": checkout}


async def create_checkout(
    *,
    config: Config,
    method: SubscriptionPaymentMethod,
    amount_minor: int,
    currency_code: str,
    description: str,
    tracking_id: str,
    customer_email: str | None,
    payment_id: str,
) -> BePaidCheckoutResult:
    """Create a bePaid payment token and return hosted checkout URL."""
    if not config.bepaid_configured():
        raise BePaidError("bePaid credentials are not configured")

    payload = build_checkout_payload(
        config=config,
        method=method,
        amount_minor=amount_minor,
        currency_code=currency_code,
        description=description,
        tracking_id=tracking_id,
        customer_email=customer_email,
        payment_id=payment_id,
    )
    url = f"{config.bepaid_checkout_url.rstrip('/')}/ctp/api/checkouts"
    auth = (config.bepaid_shop_id.strip(), config.bepaid_secret_key.strip())
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-Version": "2",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url, json=payload, auth=auth, headers=headers
        )

    if response.status_code >= 400:
        logger.warning(
            "bePaid checkout failed",
            status=response.status_code,
            body=response.text[:500],
        )
        raise BePaidError(
            f"bePaid checkout error: {response.status_code}",
            status_code=response.status_code,
        )

    data = response.json()
    checkout = data.get("checkout") or {}
    token = checkout.get("token")
    redirect_url = checkout.get("redirect_url")
    if not token or not redirect_url:
        raise BePaidError(
            "bePaid checkout response missing token/redirect_url"
        )
    return BePaidCheckoutResult(token=token, redirect_url=redirect_url)


def _normalize_public_key(raw: str) -> bytes:
    """Accept PEM or bare base64 RSA public key from merchant backoffice."""
    text = raw.strip()
    if "BEGIN PUBLIC KEY" in text:
        return text.encode("utf-8")
    # Remove whitespace/newlines from base64 blob, then wrap as PEM.
    b64 = "".join(text.split())
    lines = [b64[i : i + 64] for i in range(0, len(b64), 64)]
    pem = (
        "-----BEGIN PUBLIC KEY-----\n"
        + "\n".join(lines)
        + "\n-----END PUBLIC KEY-----\n"
    )
    return pem.encode("utf-8")


def verify_webhook_signature(
    *,
    public_key: str,
    signature_header: str | None,
    raw_body: bytes,
) -> bool:
    """Verify ``Content-Signature`` (SHA256-RSA, base64) against raw body."""
    if not public_key.strip() or not signature_header:
        return False
    try:
        key = serialization.load_pem_public_key(
            _normalize_public_key(public_key)
        )
        signature = base64.b64decode(signature_header)
        key.verify(  # type: ignore[union-attr]
            signature,
            raw_body,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
        return True
    except (InvalidSignature, ValueError, TypeError) as exc:
        logger.warning("bePaid webhook signature invalid", error=str(exc))
        return False


def verify_webhook_basic_auth(
    *,
    config: Config,
    username: str | None,
    password: str | None,
) -> bool:
    """Validate HTTP Basic credentials against shop id / secret key."""
    if not config.bepaid_configured():
        return False
    return (
        username == config.bepaid_shop_id.strip()
        and password == config.bepaid_secret_key.strip()
    )


def extract_webhook_fields(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize checkout / card / APM webhook shapes into common fields."""
    transaction = payload.get("transaction")
    if isinstance(transaction, dict):
        return {
            "tracking_id": transaction.get("tracking_id")
            or (transaction.get("order") or {}).get("tracking_id"),
            "status": transaction.get("status"),
            "amount": transaction.get("amount"),
            "currency": transaction.get("currency"),
            "uid": transaction.get("uid") or transaction.get("id"),
            "test": transaction.get("test"),
            "expired": False,
            "finished": transaction.get("status")
            in ("successful", "failed", "expired"),
        }

    order = (
        payload.get("order") if isinstance(payload.get("order"), dict) else {}
    )
    return {
        "tracking_id": order.get("tracking_id") or payload.get("tracking_id"),
        "status": payload.get("status"),
        "amount": order.get("amount") or payload.get("amount"),
        "currency": order.get("currency") or payload.get("currency"),
        "uid": payload.get("uid") or payload.get("id"),
        "test": payload.get("test"),
        "expired": bool(payload.get("expired")),
        "finished": bool(payload.get("finished")),
    }


def map_webhook_status(
    *,
    status: str | None,
    expired: bool,
) -> str | None:
    """Map bePaid status string to SubscriptionPaymentStatus value."""
    if expired or status in ("error", "expired"):
        return "expired"
    if status in ("successful", "success"):
        return "successful"
    if status in ("failed", "declined", "error"):
        return "failed"
    if status in ("pending", "incomplete"):
        return "pending"
    return None
