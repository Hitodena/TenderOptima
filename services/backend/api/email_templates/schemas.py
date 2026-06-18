import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class EmailTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    title: str
    subject: str
    body: str
    is_global: bool
    created_at: datetime
    updated_at: datetime


class EmailTemplateCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255)]
    subject: Annotated[str, Field(min_length=1, max_length=500)]
    body: Annotated[str, Field(min_length=1, max_length=50000)]
    is_global: bool = False


class EmailTemplateUpdate(BaseModel):
    title: Annotated[str | None, Field(min_length=1, max_length=255)] = None
    subject: Annotated[str | None, Field(min_length=1, max_length=500)] = None
    body: Annotated[str | None, Field(min_length=1, max_length=50000)] = None
