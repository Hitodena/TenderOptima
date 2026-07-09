import uuid
from datetime import datetime
from typing import Annotated

from backend.enums import EmailTemplateCategory
from pydantic import BaseModel, ConfigDict, Field


class EmailTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    title: str
    subject: str
    body: str
    is_global: bool
    is_primary: bool
    category: EmailTemplateCategory
    created_at: datetime
    updated_at: datetime


class EmailTemplateCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255)]
    subject: Annotated[str, Field(min_length=1, max_length=500)]
    body: Annotated[str, Field(min_length=1, max_length=50000)]
    is_global: bool = False
    is_primary: bool = False
    category: EmailTemplateCategory = EmailTemplateCategory.LETTER


class EmailTemplateUpdate(BaseModel):
    title: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    subject: Annotated[str | None, Field(min_length=1, max_length=500)] = None
    body: Annotated[str | None, Field(min_length=1, max_length=50000)] = None
    category: EmailTemplateCategory | None = None
    is_primary: bool | None = None
