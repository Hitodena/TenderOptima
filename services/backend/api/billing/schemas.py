"""Billing API schemas."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class BillingProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    country: str | None = None
    organization_form: str | None = None
    inn: str | None = None
    organization_name: str | None = None
    kpp: str | None = None
    ogrn: str | None = None
    legal_address: str | None = None
    postal_address: str | None = None
    director_name: str | None = None
    bik: str | None = None
    bank_name: str | None = None
    settlement_account: str | None = None
    correspondent_account: str | None = None
    contact_person: str | None = None
    contact_full_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class BillingProfileUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    country: str | None = None
    organization_form: str | None = None
    inn: str | None = None
    organization_name: str | None = None
    kpp: str | None = None
    ogrn: str | None = None
    legal_address: str | None = None
    postal_address: str | None = None
    director_name: str | None = None
    bik: str | None = None
    bank_name: str | None = None
    settlement_account: str | None = None
    correspondent_account: str | None = None
    contact_person: str | None = None
    contact_full_name: str | None = None
    contact_email: EmailStr | None = None
    contact_phone: str | None = None


class BillingDocumentLineItem(BaseModel):
    name: str
    amount: str


class BillingDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    receipt_id: str
    plan: str
    period_start: datetime
    period_end: datetime
    currency_code: str
    total_amount: Decimal
    line_items: list[BillingDocumentLineItem]
    email_status: str
    sent_at: datetime | None = None
    recipient_email: str | None = None
    created_at: datetime


class BillingGenerateRequest(BaseModel):
    period_year: int | None = None
    period_month: Annotated[int | None, Field(ge=1, le=12)] = None
    send_email: bool = True


class BillingGenerateResponse(BaseModel):
    document: BillingDocumentResponse
    email_queued: bool = False
