import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterCreate(BaseModel):
    """User registration payload."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        from_attributes=True,
    )

    email: Annotated[
        EmailStr,
        Field(
            description="Valid email address used as unique user identifier",
            examples=["user@example.com"],
        ),
    ]
    password: Annotated[
        str,
        Field(
            description="Plain-text password (will be hashed server-side)",
            min_length=8,
            max_length=128,
            examples=["SecurePass123!"],
        ),
    ]
    full_name: Annotated[
        str | None,
        Field(
            default=None,
            description="Optional full legal name of the user",
            min_length=2,
            max_length=100,
            examples=["John Doe"],
        ),
    ]
    company_name: Annotated[
        str | None,
        Field(
            default=None,
            description="Optional company or organization name",
            min_length=2,
            max_length=150,
            examples=["Acme Corp"],
        ),
    ]
    agree_terms: Annotated[
        bool,
        Field(
            default=True,
            description="Accept for terms",
            examples=[True],
        ),
    ]
    agree_marketing: Annotated[
        bool,
        Field(
            default=False,
            description="Accept for mailing",
            examples=[False],
        ),
    ]


class TokenResponse(BaseModel):
    """Standard JWT bearer token response."""

    model_config = ConfigDict(from_attributes=True)

    access_token: Annotated[
        str,
        Field(
            description="JWT access token",
            examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
        ),
    ]
    token_type: Annotated[
        str,
        Field(
            default="bearer",
            description="Token type (always 'bearer')",
            examples=["bearer"],
        ),
    ]


class UserResponse(BaseModel):
    """Authenticated user profile information."""

    model_config = ConfigDict(from_attributes=True)

    id: Annotated[
        uuid.UUID,
        Field(
            description="Unique numeric user identifier",
            examples=["123e4567-e89b-12d3-a456-426614174000"],
        ),
    ]
    email: Annotated[
        EmailStr,
        Field(
            description="User's registered email address",
            examples=["user@example.com"],
        ),
    ]
    full_name: Annotated[
        str | None,
        Field(
            description="User's full name if provided during registration",
            examples=["John Doe"],
        ),
    ]
