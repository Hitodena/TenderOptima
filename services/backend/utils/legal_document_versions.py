"""Server-stamped legal document versions shown at consent time.

Bump these strings when a PDF under public/legal/ is replaced so stored
consent evidence matches the text the user actually saw.
"""

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True, slots=True)
class ConsentAuditStamp:
    """Versions, timestamps, and client metadata for a consent event."""

    terms_accepted_at: datetime
    terms_version: str
    privacy_version: str
    consent_ip: str
    consent_user_agent: str | None
    marketing_consent_at: datetime | None
    marketing_consent_version: str | None


# Date-like identifiers; not semantic semver. Update when files change.
TERMS_OF_USE_VERSION = "2026-09-01"
PRIVACY_POLICY_VERSION = "2026-09-01"
MARKETING_CONSENT_VERSION = "2026-09-01"


def stamp_consent_audit(
    *,
    ip_address: str,
    user_agent: str | None,
    agree_marketing: bool,
) -> ConsentAuditStamp:
    """Build audit fields for ToS+Privacy (always) and optional marketing."""
    now = datetime.now(UTC)
    return ConsentAuditStamp(
        terms_accepted_at=now,
        terms_version=TERMS_OF_USE_VERSION,
        privacy_version=PRIVACY_POLICY_VERSION,
        consent_ip=ip_address,
        consent_user_agent=user_agent,
        marketing_consent_at=now if agree_marketing else None,
        marketing_consent_version=(
            MARKETING_CONSENT_VERSION if agree_marketing else None
        ),
    )
