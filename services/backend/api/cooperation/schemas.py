"""Schemas for public supplier cooperation invitations."""

import uuid
from datetime import datetime

import phonenumbers
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from backend.enums import CooperationLeadStatus


class CooperationLeadCreate(BaseModel):
    """Payload submitted from the public supplier invitation page."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=32)
    company: str = Field(default="Не указано", min_length=1, max_length=150)
    industry: str = Field(min_length=2, max_length=150)
    comment: str | None = Field(default=None, max_length=1000)
    consent: bool
    agree_marketing: bool = False

    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=100)
    utm_content: str | None = Field(default=None, max_length=100)
    page_url: str | None = Field(default=None, max_length=500)

    honeypot: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        try:
            parsed = phonenumbers.parse(v, "RU")
        except phonenumbers.NumberParseException as exc:
            raise ValueError("Не удалось распознать номер телефона") from exc
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError("Некорректный номер телефона")
        return phonenumbers.format_number(
            parsed, phonenumbers.PhoneNumberFormat.E164
        )

    @field_validator("consent")
    @classmethod
    def validate_consent(cls, v: bool) -> bool:
        if not v:
            raise ValueError(
                "Требуется согласие на обработку персональных данных"
            )
        return v


class CooperationLeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    phone: str
    company: str
    industry: str
    comment: str | None
    agree_marketing: bool
    status: CooperationLeadStatus
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    utm_content: str | None
    page_url: str | None
    approved_at: datetime | None
    cancelled_at: datetime | None
    deleted_at: datetime | None
    created_at: datetime


class CooperationLeadPageResponse(BaseModel):
    items: list[CooperationLeadResponse]
    page: int
    size: int
    total: int


class VerifiedSupplierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    email: str
    phone: str | None
    industry: str
    contact_name: str | None
    comments: str | None
    source: str
    source_lead_id: uuid.UUID | None
    created_at: datetime


class VerifiedSupplierPageResponse(BaseModel):
    items: list[VerifiedSupplierResponse]
    page: int
    size: int
    total: int
