import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.enums import SupplierSource


class SupplierCreate(BaseModel):
    """Payload for manually creating/registering a new supplier."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    domain: Annotated[
        str,
        Field(
            description="Supplier domain (unique, will be lowercased)",
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
            description="Origin/source tag (stored as from_source). Examples: 'manual', 'admin', 'import'",  # noqa: E501
            max_length=50,
            examples=[SupplierSource.MANUAL],
        ),
    ]
    request_id: Annotated[
        uuid.UUID | None,
        Field(
            default=None,
            description="Optional: attach the (new or existing) supplier to this request immediately by creating a pending RequestSupplier link. The request must belong to the current user.",  # noqa: E501
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
        str,
        Field(description="Supplier domain", examples=["example-supplier.ru"]),
    ]
    company_name: Annotated[
        str, Field(description="Company name", examples=["ООО ПромПоставка"])
    ]
    email: Annotated[
        str,
        Field(
            description="Contact email", examples=["sales@example-supplier.ru"]
        ),
    ]
    from_source: Annotated[
        str | None,
        Field(
            description="How the supplier was added (from_source)",
            examples=["manual"],
        ),
    ]
    created_at: Annotated[
        datetime,
        Field(
            description="Creation timestamp", examples=["2025-01-15T10:30:00Z"]
        ),
    ]
