import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class BlacklistCreate(BaseModel):
    """Payload for adding a domain to the blacklist."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    domain: Annotated[
        str,
        Field(
            description="Domain name to blacklist (will be lowercased and stripped)",  # noqa: E501
            min_length=3,
            max_length=255,
            examples=["example.com"],
        ),
    ]
    reason: Annotated[
        str | None,
        Field(
            default=None,
            description="Optional reason for blacklisting the domain",
            max_length=500,
            examples=["Spam source"],
        ),
    ]
    is_global: Annotated[
        bool,
        Field(
            default=False,
            description="Mark as global blacklist entry (admin only)",
        ),
    ]


class BlacklistResponse(BaseModel):
    """Representation of a blacklisted domain record."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique identifier of the blacklist entry",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    domain: Annotated[
        str,
        Field(
            description="The blacklisted domain name", examples=["example.com"]
        ),
    ]
    reason: Annotated[
        str | None,
        Field(
            description="Reason provided when the domain was blacklisted",
            examples=["Spam source"],
        ),
    ]
    is_global: Annotated[
        bool,
        Field(
            description="Whether the entry applies to all users",
            examples=[False],
        ),
    ]
    created_at: Annotated[
        datetime,
        Field(
            description="Timestamp when the entry was created",
            examples=["2025-01-15T10:30:00Z"],
        ),
    ]
