import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NewsSeverity = Literal["info", "warning", "error"]


class NewsCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=3, max_length=180)
    content: str = Field(min_length=1, max_length=5000)
    module_name: str | None = Field(default=None, max_length=100)
    severity: NewsSeverity = "warning"


class NewsUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=3, max_length=180)
    content: str | None = Field(default=None, min_length=1, max_length=5000)
    module_name: str | None = Field(default=None, max_length=100)
    severity: NewsSeverity | None = None
    is_active: bool | None = None


class NewsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    content: str
    module_name: str | None
    severity: NewsSeverity
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AdminNewsResponse(NewsResponse):
    read_count: int = 0


class NewsReadAcknowledgement(BaseModel):
    status: Literal["read"] = "read"
