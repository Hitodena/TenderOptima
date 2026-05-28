import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from backend.enums import RequestSupplierStatus, SupplierSource


class SupplierCreate(BaseModel):
    """Payload for manually creating/registering a new supplier."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    domain: Annotated[
        str | None,
        Field(
            default=None,
            description=(
                "Supplier domain (unique, will be lowercased). "
                "Can be null if creating without domain."
            ),
            min_length=3,
            max_length=255,
            examples=["example-supplier.ru"],
        ),
    ]
    company_name: Annotated[
        str,
        Field(
            description="Legal or display company name",
            min_length=1,
            max_length=200,
            examples=["ООО ПромПоставка"],
        ),
    ]
    email: Annotated[
        EmailStr,
        Field(
            description="Primary contact email for the supplier",
            examples=["sales@example-supplier.ru"],
        ),
    ]
    source: Annotated[
        SupplierSource | None,
        Field(
            default=SupplierSource.MANUAL,
            description=(
                "Origin/source tag (stored as from_source). "
                "Examples: 'manual', 'admin', 'import'"
            ),
            max_length=50,
            examples=[SupplierSource.MANUAL],
        ),
    ]
    request_id: Annotated[
        uuid.UUID | None,
        Field(
            default=None,
            description=(
                "Optional: attach the (new or existing) supplier to this "
                "request immediately by creating a pending RequestSupplier "
                "link. The request must belong to the current user."
            ),
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]


class SupplierResponse(BaseModel):
    """Public representation of a supplier (after creation or lookup)."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique supplier identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    domain: Annotated[
        str | None,
        Field(description="Supplier domain", examples=["example-supplier.ru"]),
    ]
    company_name: Annotated[
        str, Field(description="Company name", examples=["ООО ПромПоставка"])
    ]
    main_email: Annotated[
        str,
        Field(
            description="Contact email", examples=["sales@example-supplier.ru"]
        ),
    ]
    extra_emails: Annotated[
        list[str] | None,
        Field(
            description="Additional contact emails",
            examples=[["sales@example-supplier.ru"]],
        ),
    ]
    from_source: Annotated[
        str | None,
        Field(
            description="How the supplier was added",
            examples=["manual"],
        ),
    ] = None


class SupplierMainEmailUpdate(BaseModel):
    """Payload for updating supplier's main email."""

    model_config = ConfigDict(str_strip_whitespace=True)

    main_email: Annotated[
        EmailStr,
        Field(
            description="New main email address (must exist in current emails)",
            examples=["sales@example-supplier.ru"],
        ),
    ]


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
    sent_status: Annotated[
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


class BulkToggleSuppliersRequest(BaseModel):
    """Bulk update enabled status for request suppliers."""

    ids: Annotated[
        list[uuid.UUID],
        Field(
            min_length=1,
            description="RequestSupplier identifiers to update",
        ),
    ]
    is_enabled: Annotated[
        bool,
        Field(description="New enabled status for the listed suppliers"),
    ]


class BulkToggleSuppliersResponse(BaseModel):
    """Result of bulk enabled status update."""

    updated: Annotated[
        int,
        Field(description="Number of request suppliers updated"),
    ]


class SupplierRemoveResponse(BaseModel):
    """Confirmation after removing a supplier association from a request."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Identifier of the removed request-supplier link",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
