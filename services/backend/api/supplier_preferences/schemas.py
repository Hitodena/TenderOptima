"""Public schemas for supplier RFQ subscribe / unsubscribe."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupplierPreferenceResponse(BaseModel):
    """Current preference state plus token-bound email."""

    model_config = ConfigDict(from_attributes=True)

    email: Annotated[str, Field(description="Supplier address from the link")]
    status: Annotated[
        str | None,
        Field(description="subscribed, unsubscribed, or null if unknown"),
    ] = None
    categories: Annotated[list[str], Field(default_factory=list)]
    region: Annotated[str | None, Field(default=None)]
    suggested_region: Annotated[
        str | None,
        Field(
            default=None,
            description="Region prefilled from the source request",
        ),
    ] = None
    consent_accepted_at: Annotated[datetime | None, Field(default=None)]


class SupplierPreferenceSubscribeRequest(BaseModel):
    """Confirm opt-in for similar RFQ emails."""

    model_config = ConfigDict(str_strip_whitespace=True)

    token: Annotated[str, Field(min_length=10)]
    categories: Annotated[
        list[str],
        Field(
            min_length=1, description="Product categories the supplier sells"
        ),
    ]
    region: Annotated[str, Field(min_length=2, max_length=100)]
    consent: Annotated[
        bool, Field(description="Explicit personal-data consent")
    ]


class SupplierPreferenceTokenRequest(BaseModel):
    """Token-only payload for page confirm and one-click unsubscribe."""

    model_config = ConfigDict(str_strip_whitespace=True)

    token: Annotated[str, Field(min_length=10)]


class SupplierPreferenceActionResponse(BaseModel):
    """Result of a subscribe or unsubscribe action."""

    email: str
    status: str
    source_request_id: UUID | None = None
