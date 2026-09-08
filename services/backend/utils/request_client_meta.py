"""Extract client IP and User-Agent from FastAPI Request."""

from fastapi import Request

USER_AGENT_MAX_LENGTH = 512


def client_ip(request: Request) -> str:
    """Prefer first X-Forwarded-For hop; fall back to direct client host."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def client_user_agent(request: Request) -> str | None:
    """Return trimmed User-Agent or None when missing/empty."""
    raw = request.headers.get("user-agent")
    if not raw:
        return None
    trimmed = raw.strip()
    if not trimmed:
        return None
    if len(trimmed) > USER_AGENT_MAX_LENGTH:
        return trimmed[:USER_AGENT_MAX_LENGTH]
    return trimmed
