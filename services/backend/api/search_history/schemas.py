import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class SearchHistoryResponse(BaseModel):
    """Read model for a single search history entry."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique identifier of the history record",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    query: Annotated[
        str,
        Field(
            description="The search query string that was executed",
            min_length=1,
            max_length=500,
            examples=["Water pumps"],
        ),
    ]
    results_count: Annotated[
        int | None,
        Field(
            description="Number of results returned by the search (if available)",
            examples=[20],
        ),
    ]
    request_id: Annotated[
        uuid.UUID | None,
        Field(
            description="Optional reference to the original request that triggered this search",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    created_at: Annotated[
        datetime,
        Field(
            description="Timestamp when the search was recorded",
            examples=["2025-01-15T10:30:00Z"],
        ),
    ]
