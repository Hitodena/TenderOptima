"""Encrypt/decrypt sensitive user secrets at rest (SMTP/IMAP passwords)."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from backend.core.config import Config, get_config

_ENC_PREFIX = "enc:"


def _fernet(config: Config | None = None) -> Fernet:
    cfg = config or get_config()
    digest = hashlib.sha256(cfg.secret_key.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value: str, *, config: Config | None = None) -> str:
    """Return prefixed Fernet ciphertext for a plaintext secret."""
    token = _fernet(config).encrypt(value.encode("utf-8")).decode("ascii")
    return f"{_ENC_PREFIX}{token}"


def decrypt_secret(
    stored: str | None,
    *,
    config: Config | None = None,
) -> str | None:
    """Decrypt stored secret; plain legacy values pass through unchanged."""
    if not stored:
        return None
    if not stored.startswith(_ENC_PREFIX):
        return stored
    token = stored[len(_ENC_PREFIX) :]
    try:
        return _fernet(config).decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return None


def store_secret(
    value: str | None, *, config: Config | None = None
) -> str | None:
    """Encrypt non-empty secret for DB storage."""
    if not value:
        return None
    return encrypt_secret(value, config=config)
