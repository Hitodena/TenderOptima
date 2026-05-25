from enum import StrEnum


class RequestStatus(StrEnum):
    """Lifecycle status of a user search/mailing request."""

    DRAFT = "draft"  # after creating request
    ACTIVE = "active"  # after search
    QUEUED = "queued"  # mailing in progress (matches frontend)
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
