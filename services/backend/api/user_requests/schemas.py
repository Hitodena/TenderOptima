import uuid
from datetime import datetime
from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.enums import RequestStatus

QUERY_MAX_LENGTH = 2000
ITEM_MAX_LENGTH = 500
ITEMS_MIN_COUNT = 2
ITEMS_MAX_COUNT = 8


class RequestCreate(BaseModel):
    """Minimal payload for creating a new supplier search request."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    query: Annotated[
        str | None,
        Field(
            default=None,
            description="Main search query describing the product needed",
            min_length=3,
            max_length=QUERY_MAX_LENGTH,
            examples=["промышленные насосы"],
        ),
    ] = None
    items: Annotated[
        list[str] | None,
        Field(
            default=None,
            description=(
                "Multiple procurement positions; joined into query with commas"
            ),
            min_length=ITEMS_MIN_COUNT,
            max_length=ITEMS_MAX_COUNT,
            examples=[["картонные коробки", "флаконы"]],
        ),
    ] = None
    delivery_region: Annotated[
        str,
        Field(
            ...,
            description="Preferred delivery region or country",
            max_length=100,
            examples=["Минск"],
        ),
    ]

    @model_validator(mode="after")
    def validate_query_or_items(self) -> Self:
        """Require exactly one of query or items; normalize items."""
        has_query = bool(self.query and self.query.strip())
        raw_items = self.items
        cleaned_items: list[str] = []
        if raw_items is not None:
            cleaned_items = [
                item.strip() for item in raw_items if item and item.strip()
            ]
            for item in cleaned_items:
                if len(item) < 3:
                    raise ValueError(
                        "Each position must be at least 3 characters"
                    )
                if len(item) > ITEM_MAX_LENGTH:
                    raise ValueError(
                        f"Each position must be at most {ITEM_MAX_LENGTH} "
                        "characters"
                    )
            self.items = cleaned_items

        has_items = bool(cleaned_items)
        if has_query == has_items:
            raise ValueError(
                "Provide either query or items (at least "
                f"{ITEMS_MIN_COUNT} positions), not both"
            )
        if has_items:
            if len(cleaned_items) < ITEMS_MIN_COUNT:
                raise ValueError(
                    f"At least {ITEMS_MIN_COUNT} positions are required"
                )
            if len(cleaned_items) > ITEMS_MAX_COUNT:
                raise ValueError(
                    f"At most {ITEMS_MAX_COUNT} positions are allowed"
                )
            joined = ", ".join(cleaned_items)
            if len(joined) > QUERY_MAX_LENGTH:
                raise ValueError(
                    f"Joined query must be at most {QUERY_MAX_LENGTH} "
                    "characters"
                )
        return self

    @property
    def resolved_query(self) -> str:
        """Return the stored query string (joined when multi-position)."""
        if self.items:
            return ", ".join(self.items)
        assert self.query is not None
        return self.query.strip()

    @property
    def is_multi_position(self) -> bool:
        return bool(self.items)


class RequestResponse(BaseModel):
    """Full representation of a user request."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique request identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    user_id: Annotated[
        uuid.UUID,
        Field(
            description="Owner of the request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    query: Annotated[
        str,
        Field(
            description="Original search query", examples=["industrial pumps"]
        ),
    ]
    is_multi_position: Annotated[
        bool,
        Field(
            default=False,
            description=(
                "True when the request was created with multiple "
                "procurement positions"
            ),
        ),
    ] = False
    status: Annotated[
        RequestStatus,
        Field(
            description="Current lifecycle status of the request",
            examples=[RequestStatus.ACTIVE],
        ),
    ]
    delivery_region: Annotated[
        str | None,
        Field(description="Requested delivery region", examples=["Minsk"]),
    ]
    description: Annotated[
        str | None,
        Field(
            description="Detailed requirements",
            examples=["High pressure centrifugal pumps"],
        ),
    ]
    additional_params: Annotated[
        list | None,
        Field(
            default=None,
            description="Selected optional parameters for the outgoing email",
        ),
    ]
    attachment_paths: Annotated[
        list | None,
        Field(
            default=None,
            description="Paths for attachments of the request",
        ),
    ]
    email_message: Annotated[
        str | None,
        Field(
            default=None,
            description="Generated email message of the request",
        ),
    ]
    email_subject: Annotated[
        str | None,
        Field(
            default=None,
            description="User-editable email subject",
            max_length=255,
        ),
    ]
    created_at: Annotated[
        datetime,
        Field(
            description="Creation timestamp", examples=["2025-01-15T10:30:00Z"]
        ),
    ]
    supplier_messages_total: Annotated[
        int,
        Field(
            default=0,
            description="Total supplier email messages for the request",
        ),
    ] = 0
    supplier_messages_incoming: Annotated[
        int,
        Field(
            default=0,
            description="Incoming supplier email messages for the request",
        ),
    ] = 0
    supplier_messages_unread: Annotated[
        int,
        Field(
            default=0,
            description=(
                "Threads with unread incoming supplier replies "
                "(not opened since the last incoming message)"
            ),
        ),
    ] = 0
    supplier_messages_incoming_suppliers: Annotated[
        int,
        Field(
            default=0,
            description="Suppliers that sent at least one incoming email",
        ),
    ] = 0
    is_first_request: Annotated[
        bool,
        Field(
            default=False,
            description=(
                "True when this is the user's only request "
                "(used for first-search onboarding hints)"
            ),
        ),
    ] = False

    @classmethod
    def from_model(
        cls,
        request: object,
        *,
        supplier_messages_total: int = 0,
        supplier_messages_incoming: int = 0,
        supplier_messages_unread: int = 0,
        supplier_messages_incoming_suppliers: int = 0,
        is_first_request: bool = False,
    ) -> "RequestResponse":
        """Build response from ORM row plus optional message aggregates."""
        base = cls.model_validate(request)
        return base.model_copy(
            update={
                "supplier_messages_total": supplier_messages_total,
                "supplier_messages_incoming": supplier_messages_incoming,
                "supplier_messages_unread": supplier_messages_unread,
                "supplier_messages_incoming_suppliers": (
                    supplier_messages_incoming_suppliers
                ),
                "is_first_request": is_first_request,
            }
        )


class Attachment(BaseModel):
    """Email attachment metadata."""

    model_config = ConfigDict(from_attributes=True)

    filename: Annotated[
        str,
        Field(
            description="Original filename of the attachment",
            examples=["quote.pdf"],
        ),
    ]
    content_type: Annotated[
        str | None,
        Field(
            description="MIME type of the file", examples=["application/pdf"]
        ),
    ]
    size: Annotated[
        int | None,
        Field(description="File size in bytes", examples=[245678]),
    ]
    path: Annotated[
        str | None,
        Field(
            description="Server path where the file is stored",
            examples=["/app/uploads/abc-uuid/quote.pdf"],
        ),
    ]


class LaunchMailingResponse(BaseModel):
    """Response when a mailing campaign is successfully queued."""

    model_config = ConfigDict(from_attributes=True)

    status: Annotated[
        RequestStatus,
        Field(description="Task status", examples=[RequestStatus.QUEUED]),
    ]
    request_id: Annotated[
        str,
        Field(
            description="ID of the request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    pending: Annotated[
        int,
        Field(description="Number of pending suppliers", examples=[5]),
    ]


class TaskQueuedResponse(BaseModel):
    """Base response for any background task successfully queued."""

    model_config = ConfigDict(from_attributes=True)

    status: Annotated[
        str,
        Field(
            description="Task queue status",
            examples=["search_queued", "queued"],
        ),
    ]
    request_id: Annotated[
        str,
        Field(
            description="ID of the request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]


class SearchQueuedResponse(TaskQueuedResponse):
    """Response when supplier search has been queued."""


class RequestUpdate(BaseModel):
    """Payload for updating optional fields before launching the request."""

    model_config = ConfigDict(str_strip_whitespace=True, from_attributes=True)

    description: Annotated[
        str,
        Field(
            description="Detailed description of requirements",
            min_length=3,
            max_length=2000,
            examples=[
                "Высоконапорные центробежные насосы для химической промышленности"
            ],
        ),
    ]
    additional_params: Annotated[
        list | None,
        Field(
            default=None,
            description="Selected optional parameters for the outgoing email",
        ),
    ]
    email_subject: Annotated[
        str | None, Field(default=None, max_length=255)
    ] = None
    attachments: Annotated[
        list[Attachment] | None,
        Field(
            default=None,
            description="List of attachments to include in the email",
        ),
    ]


class RequestEmailUpdate(BaseModel):
    """Payload for PATCH /email_message."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email_subject: Annotated[str | None, Field(default=None)] = None
    email_message: Annotated[str | None, Field(default=None)] = None


class RequestCloseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Identifier of the closed request",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
