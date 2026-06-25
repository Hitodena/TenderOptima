from enum import StrEnum


class RequestStatus(StrEnum):
    """Lifecycle status of a user search/mailing request (DRAFT -> SEARCHING -> ACTIVE etc)."""

    DRAFT = "draft"  # after creating request
    SEARCHING = "searching"  # background parser task running (long timeout)
    ACTIVE = "active"  # after search
    QUEUED = "queued"  # mailing in progress
    COMPLETED = "completed"  # terminal state after send_emails finished
    CLOSED = "closed"  # user closed request


class RequestSupplierStatus(StrEnum):
    """Per-supplier sending + reply lifecycle for a request."""

    PENDING = "pending"  # found via search or manual add, waiting to be mailed
    SENT = "sent"  # SMTP send succeeded
    FAILED = "failed"  # SMTP error
    REPLIED = "replied"  # IMAP poll detected reply → EmailMessage row created


class SupplierSource(StrEnum):
    """Origin of a supplier record (for analytics + dedup rules)."""

    MANUAL = "manual"  # added by user via /suppliers POST
    PARSER = "parser"  # discovered via Google parser
    ADMIN = "admin"  # reserved for future bulk admin import
    IMPORT = "import"  # reserved for CSV/Excel bulk


class EmailMessageDirection(StrEnum):
    """Direction of an EmailMessage (threaded conversation item)."""

    INCOMING = "incoming"
    OUTGOING = "outgoing"


class TZAnalysisHistoryGroup(StrEnum):
    """Tab groups for the TZ analysis history page."""

    DRAFT = "draft"
    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"


class TZAnalysisRunStatus(StrEnum):
    """Lifecycle of a TZ vs KP analysis session."""

    DRAFT = "draft"
    ACTIVE = "active"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TZAnalysisStatus(StrEnum):
    MET = "met"
    PARTIAL = "partial"
    MISSING = "missing"
    NOT_FOUND = "not_found"


class TZAnalysisSupplierStatus(StrEnum):
    """Per-supplier KP extraction and comparison lifecycle."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class SubscriptionPlan(StrEnum):
    """Tariff tier for a user subscription."""

    TEST = "test"
    BASIC = "basic"
    ADVANCED = "advanced"
    CORPORATE = "corporate"


class SubscriptionGeo(StrEnum):
    """Billing geography (reserved for multi-currency admin)."""

    BY = "BY"
    US = "US"
