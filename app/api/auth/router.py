from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.schemas import (
    RegisterCreate,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from app.api.deps import get_current_user, get_session
from app.db.dao import UserDAO
from app.db.models import User
from app.utils.jwt_utils import create_access_token
from app.utils.security import hash_password, verify_password
from app.utils.user_utils import build_business_info

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    responses={
        201: {"description": "User successfully created and JWT returned"},
        409: {"description": "Email already exists in the system"},
        422: {"description": "Validation error in request payload"},
    },
)
async def register(
    request: RegisterCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """Creates a new user record. Returns a JWT access token on success. Fails
    with 409 if the email is already registered.
    """
    existing_user = await UserDAO.get_by_email(session, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    hashed_password = hash_password(request.password)
    user = await UserDAO.create(
        session,
        email=request.email,
        hashed_password=hashed_password,
        full_name=request.full_name,
        company_name=request.company_name,
    )
    business_info = build_business_info(user)
    await UserDAO.update_contact_info(
        session, user, business_info=business_info
    )

    access_token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Authenticate user and obtain JWT",
    responses={
        200: {"description": "Authentication successful, JWT returned"},
        401: {"description": "Invalid credentials provided"},
        422: {"description": "Invalid form data"},
    },
)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """
    OAuth2 password flow login. Returns JWT on successful credential
    validation.
    """
    user = await UserDAO.get_by_email(session, form_data.username)
    if not user or not verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current authenticated user",
    responses={
        200: {"description": "Current user profile returned"},
        401: {"description": "Missing or invalid JWT"},
    },
)
async def get_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """
    Returns profile data for the currently authenticated user using the
    provided JWT.
    """
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current authenticated user profile",
    responses={
        200: {"description": "User profile updated successfully"},
        204: {"description": "No fields to update"},
        401: {"description": "Missing or invalid JWT"},
        422: {"description": "Validation error in request payload"},
    },
)
async def update_user(
    request: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserResponse:
    """
    Updates profile fields for the currently authenticated user.
    """
    has_updates = any(
        getattr(request, field) is not None
        for field in ["full_name", "contact_email", "business_info"]
    )
    if not has_updates:
        return UserResponse.model_validate(current_user)

    updated_user = await UserDAO.update_contact_info(
        session,
        current_user,
        full_name=request.full_name,
        contact_email=request.contact_email,
        business_info=request.business_info,
    )
    return UserResponse.model_validate(updated_user)
