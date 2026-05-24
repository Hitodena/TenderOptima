import secrets
import string

_TID_ALPHABET: str = string.ascii_letters + string.digits


def generate_tid(length: int = 8) -> str:
    """Generate a short, cryptographically random tracking ID."""
    return "".join(secrets.choice(_TID_ALPHABET) for _ in range(length))
