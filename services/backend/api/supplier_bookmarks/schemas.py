import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SupplierBookmarkItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    email: str
    domain: str | None
    phone: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class SupplierBookmarkListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    title: str
    is_global: bool
    items: list[SupplierBookmarkItemResponse]
    created_at: datetime
    updated_at: datetime


class SupplierBookmarkListCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Annotated[str, Field(min_length=1, max_length=255)]
    is_global: bool = False


class SupplierBookmarkListUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: Annotated[
        str | None, Field(default=None, min_length=1, max_length=255)
    ]


class SupplierBookmarkItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: Annotated[str, Field(min_length=1, max_length=200)]
    email: Annotated[EmailStr, Field()]
    domain: Annotated[
        str | None,
        Field(default=None, min_length=3, max_length=255),
    ]
    phone: Annotated[str | None, Field(default=None, max_length=50)]
    notes: Annotated[str | None, Field(default=None, max_length=2000)]


class SupplierBookmarkItemUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: Annotated[
        str | None, Field(default=None, min_length=1, max_length=200)
    ]
    email: Annotated[EmailStr | None, Field(default=None)]
    domain: Annotated[
        str | None, Field(default=None, min_length=3, max_length=255)
    ]
    phone: Annotated[str | None, Field(default=None, max_length=50)]
    notes: Annotated[str | None, Field(default=None, max_length=2000)]
