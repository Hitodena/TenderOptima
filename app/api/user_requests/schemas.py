import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import (
    SupplierResponse as SupplierResponseDB,
)
from app.enums import (
    RequestStatus,
    RequestSupplierStatus,
)


class RequestCreate(BaseModel):
    """Minimal payload for creating a new supplier search request (only query + region; other fields set later via PATCH before launch)."""  # noqa: E501

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    query: Annotated[
        str,
        Field(
            description="Main search query describing the product needed",
            min_length=3,
            max_length=500,
            examples=["промышленные насосы"],
        ),
    ]
    delivery_region: Annotated[
        str,
        Field(
            ...,
            description="Preferred delivery region or country",
            max_length=100,
            examples=["Минск"],
        ),
    ]


class RequestResponse(BaseModel):
    """Full representation of a user request."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique request identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    user_id: Annotated[
        uuid.UUID,
        Field(
            description="Owner of the request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    query: Annotated[
        str,
        Field(
            description="Original search query", examples=["industrial pumps"]
        ),
    ]
    status: Annotated[
        RequestStatus,
        Field(
            description="Current lifecycle status of the request",
            examples=[RequestStatus.ACTIVE],
        ),
    ]
    delivery_region: Annotated[
        str | None,
        Field(description="Requested delivery region", examples=["Minsk"]),
    ]
    description: Annotated[
        str | None,
        Field(
            description="Detailed requirements",
            examples=["High pressure centrifugal pumps"],
        ),
    ]
    additional_params: Annotated[
        list | None,
        Field(
            default=None,
            description="Selected optional and custom parameters for the outgoing email",
        ),
    ]
    attachment_paths: Annotated[
        list | None,
        Field(
            default=None,
            description="Paths for attachments of the request",
        ),
    ]
    email_message: Annotated[
        str | None,
        Field(
            default=None,
            description="Generated email message of the request",
        ),
    ]
    created_at: Annotated[
        datetime,
        Field(
            description="Creation timestamp", examples=["2025-01-15T10:30:00Z"]
        ),
    ]


class ParserResult(BaseModel):
    """Internal result from the external parser service."""

    user_id: str
    query: str
    domain: str
    description: str | None = None
    engine: str | None = None
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    dateOfSearch: datetime | None = None  # noqa: N815
    page_title: str | None = None


class SearchResult(BaseModel):
    """Summary of a supplier search operation."""

    model_config = ConfigDict(from_attributes=True)

    saved_suppliers: Annotated[
        int,
        Field(description="Number of new suppliers saved", examples=[3]),
    ]
    skipped_blacklisted: Annotated[
        int,
        Field(description="Suppliers skipped due to blacklist", examples=[1]),
    ]
    skipped_no_email: Annotated[
        int,
        Field(
            description="Suppliers skipped due to missing email", examples=[2]
        ),
    ]
    request_id: Annotated[
        uuid.UUID,
        Field(
            description="Related request identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]


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


class LaunchMailingResponse(BaseModel):
    """Response when a mailing campaign is successfully queued."""

    model_config = ConfigDict(from_attributes=True)

    status: Annotated[
        RequestStatus,
        Field(description="Task status", examples=[RequestStatus.QUEUED]),
    ]
    request_id: Annotated[
        str,
        Field(
            description="ID of the request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    pending: Annotated[
        int,
        Field(description="Number of pending suppliers", examples=[5]),
    ]


class SupplierResponse(BaseModel):
    """Minimal supplier information."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Supplier identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    domain: Annotated[
        str | None,
        Field(description="Supplier domain", examples=["supplier.com"]),
    ]
    company_name: Annotated[
        str,
        Field(description="Company name", examples=["Acme Supplies LLC"]),
    ]
    email: Annotated[
        str,
        Field(
            description="Primary contact email",
            examples=["contact@supplier.com"],
        ),
    ]


class SupplierResponseResponse(BaseModel):
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
        cls, response: SupplierResponseDB
    ) -> "SupplierResponseResponse":
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


class RequestSupplierResponse(BaseModel):
    """Response representation of a request-supplier link."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="RequestSupplier identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    supplier: Annotated[
        SupplierResponse,
        Field(description="Supplier information"),
    ]
    status: Annotated[
        RequestSupplierStatus,
        Field(
            description="Current status of the supplier request",
            examples=[RequestSupplierStatus.PENDING],
        ),
    ]
    is_enabled: Annotated[
        bool,
        Field(description="Whether the supplier is enabled for this request"),
    ]
    sent_at: Annotated[
        datetime | None,
        Field(description="Timestamp when the request was sent"),
    ]


class ToggleSupplierRequest(BaseModel):
    """Request to toggle supplier enabled status."""

    is_enabled: Annotated[
        bool,
        Field(description="New enabled status for the supplier"),
    ]


class RequestUpdate(BaseModel):
    """Payload for updating optional fields and additional parameters before launching the request."""  # noqa: E501

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    description: Annotated[
        str,
        Field(
            description="Detailed description of requirements",
            min_length=3,
            max_length=2000,
            examples=[
                "Высоконапорные центробежные насосы для химической промышленности"  # noqa: E501
            ],
        ),
    ]
    additional_params: Annotated[
        list | None,
        Field(
            default=None,
            description="Selected optional and custom parameters for the outgoing email",
        ),
    ]
    attachments: Annotated[
        list[Attachment] | None,
        Field(
            default=None,
            description="List of attachments to include in the email",
        ),
    ]


class SupplierRemoveResponse(BaseModel):
    """Confirmation response after removing a supplier association from a request."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Identifier of the removed request-supplier link",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]


class RequestRemoveResponse(BaseModel):
    """Confirmation response after deleting a user request (cascades to suppliers/responses)."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Identifier of the deleted request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
