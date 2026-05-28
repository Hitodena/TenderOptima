from datetime import datetime

from pydantic import BaseModel, Field


class ParserResult(BaseModel):
    """Internal result from the external parser service."""

    user_id: str
    query: str
    domain: str
    description: str | None = None
    engine: str | None = None
    emails: list[str] = Field(default_factory=list)
    phones: list[str] = Field(default_factory=list)
    dateOfSearch: datetime | None = None  # noqa: N815
    page_title: str | None = None
