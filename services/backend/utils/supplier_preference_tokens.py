"""Signed tokens for public supplier subscribe / unsubscribe links."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import HTTPException, status

from backend.core.config import get_config
from backend.enums import SupplierPreferenceTokenPurpose

_TOKEN_TYP = "supplier_pref"
_TOKEN_TTL = timedelta(days=730)


def create_preference_token(
    email: str,
    purpose: SupplierPreferenceTokenPurpose,
    *,
    request_id: UUID | None = None,
) -> str:
    """Sign a long-lived preference token bound to one email and purpose."""
    config = get_config()
    payload: dict = {
        "typ": _TOKEN_TYP,
        "sub": email.lower().strip(),
        "purpose": purpose.value,
        "exp": datetime.now(UTC) + _TOKEN_TTL,
    }
    if request_id is not None:
        payload["rid"] = str(request_id)
    return jwt.encode(payload, config.secret_key, algorithm=config.alghoritm)


def decode_preference_token(
    token: str,
    *,
    expected_purpose: SupplierPreferenceTokenPurpose | None = None,
) -> dict:
    """Validate a preference token. Raises HTTP 400 on any failure."""
    config = get_config()
    try:
        payload = jwt.decode(
            token, config.secret_key, algorithms=[config.alghoritm]
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ссылка устарела. Запросите новое письмо.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная ссылка.",
        ) from exc

    if payload.get("typ") != _TOKEN_TYP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная ссылка.",
        )
    email = str(payload.get("sub") or "").lower().strip()
    purpose = str(payload.get("purpose") or "")
    if not email or "@" not in email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная ссылка.",
        )
    if expected_purpose is not None and purpose != expected_purpose.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недействительная ссылка.",
        )
    return payload
