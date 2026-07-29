import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class FrontendErrorLogCreate(BaseModel):
    """Payload sent by the frontend when an error is captured."""

    model_config = ConfigDict(str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=4000)
    backend_response: str | None = Field(default=None, max_length=8000)
    page_url: str | None = Field(default=None, max_length=2048)
    request_method: str | None = Field(default=None, max_length=16)
    request_url: str | None = Field(default=None, max_length=2048)
    status_code: int | None = None


class UserBriefResponse(BaseModel):
    """Minimal user info embedded in feedback responses."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None


class FrontendErrorLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    user: UserBriefResponse | None = None
    message: str
    backend_response: str | None
    page_url: str | None
    request_method: str | None
    request_url: str | None
    status_code: int | None
    created_at: datetime


class FrontendErrorLogPageResponse(BaseModel):
    items: list[FrontendErrorLogResponse]
    page: int
    size: int
    total: int


class IdeaAttachment(BaseModel):
    """Metadata for a file attached to an idea / problem report."""

    model_config = ConfigDict(from_attributes=True)

    filename: Annotated[str, Field(description="Original filename")]
    content_type: Annotated[
        str | None, Field(description="MIME type of the file")
    ] = None
    size: Annotated[int | None, Field(description="File size in bytes")] = None
    path: Annotated[
        str | None, Field(description="Server path where the file is stored")
    ] = None


class IdeaSuggestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user: UserBriefResponse | None = None
    message: str
    attachments: list[IdeaAttachment] = Field(default_factory=list)
    created_at: datetime


class IdeaSuggestionPageResponse(BaseModel):
    items: list[IdeaSuggestionResponse]
    page: int
    size: int
    total: int
