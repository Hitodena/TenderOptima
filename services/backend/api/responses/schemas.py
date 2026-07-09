import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from backend.api.suppliers.schemas import SupplierResponse
from backend.db.models import EmailMessage as EmailMessageDB
from backend.enums import EmailMessageDirection
from backend.schemas import LastMessagePreviewRow, ThreadSummaryRow


class Attachment(BaseModel):
    """Email attachment metadata."""

    model_config = ConfigDict(from_attributes=True)

    filename: Annotated[
        str,
        Field(
            description="Original filename of the attachment",
            examples=["quote.pdf"],
        ),
    ]
    content_type: Annotated[
        str | None,
        Field(
            description="MIME type of the file", examples=["application/pdf"]
        ),
    ]
    size: Annotated[
        int | None,
        Field(description="File size in bytes", examples=[245678]),
    ]
    path: Annotated[
        str | None,
        Field(
            description="Server path where the file is stored",
            examples=["/app/uploads/abc-uuid/quote.pdf"],
        ),
    ]


class LastMessagePreview(BaseModel):
    """Preview of the latest message in a supplier thread."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    direction: EmailMessageDirection
    subject: str | None = None
    body: str | None = None
    received_at: str | None = None

    @classmethod
    def from_row(cls, row: LastMessagePreviewRow) -> "LastMessagePreview":
        return cls(
            id=str(row.id),
            direction=row.direction,
            subject=row.subject,
            body=row.body,
            received_at=row.received_at.isoformat()
            if row.received_at
            else None,
        )


class EmailMessageResponse(BaseModel):
    """Email response received from a supplier."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Response identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    subject: Annotated[
        str | None,
        Field(
            description="Email subject",
            examples=["Quotation for industrial pumps"],
        ),
    ]
    raw_body: Annotated[
        str | None,
        Field(
            description="Raw email body",
            examples=["Dear Sir/Madam, we can supply..."],
        ),
    ]
    attachments: Annotated[
        list[Attachment] | None,
        Field(description="List of attachments included in the email"),
    ]
    received_at: Annotated[
        datetime | None,
        Field(
            description="When the response was received",
            examples=["2025-01-15T14:22:00Z"],
        ),
    ]
    supplier: Annotated[
        SupplierResponse,
        Field(description="Supplier that sent the response"),
    ]

    @classmethod
    def from_orm_with_supplier(
        cls, response: EmailMessageDB
    ) -> "EmailMessageResponse":
        return cls(
            id=response.id,
            subject=response.subject,
            raw_body=response.raw_body,
            attachments=response.attachments,
            received_at=response.received_at,
            supplier=SupplierResponse.model_validate(
                response.request_supplier.supplier
            ),
        )


class ThreadSummary(BaseModel):
    """Thread list item for suppliers that have at least one email."""

    model_config = ConfigDict(from_attributes=True)

    rs_id: str
    supplier: SupplierResponse
    last_message: LastMessagePreview
    message_count: int
    unread: bool
    has_outgoing: bool = False

    @classmethod
    def from_row(cls, row: ThreadSummaryRow) -> "ThreadSummary":
        return cls(
            rs_id=str(row.rs_id),
            supplier=SupplierResponse.model_validate(row.supplier),
            last_message=LastMessagePreview.from_row(row.last_message),
            message_count=row.message_count,
            unread=row.unread,
            has_outgoing=row.has_outgoing,
        )


class Message(BaseModel):
    """Single email in a thread."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: uuid.UUID
    direction: EmailMessageDirection
    subject: str | None = None
    raw_body: str | None = Field(default=None)
    attachments: list[Attachment] | None = None
    received_at: datetime | None = None


class ReplyPayload(BaseModel):
    """Payload for POST reply in a supplier thread."""

    body: Annotated[str, Field(min_length=1, max_length=50000)]


class CustomEmailPayload(BaseModel):
    """Payload for improvement request or winner notification."""

    subject: Annotated[str, Field(min_length=1, max_length=500)]
    body: Annotated[str, Field(min_length=1, max_length=50000)]
    attachment_paths: list[str] | None = None


class ComparisonSupplier(BaseModel):
    """One supplier column in the comparison table."""

    rs_id: str
    company_name: str
    main_email: str
    is_winner: bool = False
    values: dict[str, str | None]
    previous_values: dict[str, str | None]
    explanations: dict[str, str | None] = {}
    corrected_from: dict[str, str | None] = {}
    statuses: dict[str, str | None]
    numeric_values: dict[str, float | None] = {}
    percent_vs_min: dict[str, float | None] = {}


class ComparisonResponse(BaseModel):
    """Horizontal comparison of requirements across suppliers."""

    requirements: list[str]
    price_requirements: list[str] = []
    suppliers: list[ComparisonSupplier]


class RefreshAllResponse(BaseModel):
    queued: int
