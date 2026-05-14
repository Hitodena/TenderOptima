import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class RequestCreate(BaseModel):
    query: str
    delivery_region: str | None = None
    description: str | None = None
    quantity: float | None = None
    unit: str | None = None
    quality_requirements: str | None = None
    delivery_deadline: datetime | None = None
    max_price_per_unit: Decimal | None = None
    currency: str | None = "BYN"


class RequestRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    query: str
    status: str
    tracking_id: uuid.UUID
    delivery_region: str | None
    description: str | None
    quantity: float | None
    unit: str | None
    quality_requirements: str | None
    delivery_deadline: datetime | None
    max_price_per_unit: Decimal | None
    currency: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParserResult(BaseModel):
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
    saved_suppliers: int
    skipped_blacklisted: int
    skipped_no_email: int
    request_id: uuid.UUID
