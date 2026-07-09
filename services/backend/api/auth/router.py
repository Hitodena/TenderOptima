from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth.helpers import user_to_response
from backend.api.auth.schemas import (
    RegisterCreate,
    TokenResponse,
    UserResponse,
    UserUpdate,
)
from backend.api.deps import get_current_user, get_session
from backend.celery_app.tasks.security_tasks import send_login_lockout_alert
from backend.db.dao import SubscriptionDAO, UserAdminDAO, UserDAO
from backend.db.models import User
from backend.enums import SubscriptionPlan
from backend.schemas.user_email_settings import (
    UserEmailSettingsResponse,
    UserEmailSettingsUpdate,
)
from backend.utils.jwt_utils import create_access_token
from backend.utils.login_lockout import (
    raise_if_locked,
    record_failed_login,
    reset_login_lockout,
)
from backend.utils.security import hash_password, verify_password
from backend.utils.user_email_settings import email_settings_response
from backend.utils.user_utils import build_business_info

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
        phone=request.phone,
    )
    business_info = build_business_info(user)
    await UserDAO.update_contact_info(
        session, user.id, business_info=business_info
    )
    await SubscriptionDAO.upsert_for_user(
        session,
        user.id,
        plan=SubscriptionPlan.TEST.value,
        module_1_enabled=True,
        module_2_enabled=True,
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
    if user:
        raise_if_locked(user)

    if not user or not verify_password(
        form_data.password, user.hashed_password
    ):
        if user:
            send_alert = await record_failed_login(session, user)
            if send_alert and user.locked_until is not None:
                send_login_lockout_alert.delay(
                    user.email,
                    user.lockout_level,
                    user.locked_until.isoformat(),
                )
            if user.locked_until is not None:
                raise_if_locked(user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    reset_login_lockout(user)
    user.last_login_at = datetime.now(UTC)
    session.add(user)
    await session.commit()

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
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserResponse:
    """
    Returns profile data for the currently authenticated user using the
    provided JWT.
    """
    return await user_to_response(session, current_user)


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
        for field in [
            "full_name",
            "company_name",
            "contact_email",
            "business_info",
        ]
    )
    if not has_updates:
        return await user_to_response(session, current_user)

    updated_user = await UserDAO.update_contact_info(
        session,
        current_user.id,
        full_name=request.full_name,
        company_name=request.company_name,
        contact_email=request.contact_email,
        business_info=request.business_info,
    )
    return await user_to_response(session, updated_user)


@router.get(
    "/me/email-settings",
    response_model=UserEmailSettingsResponse,
    summary="Get current user SMTP/IMAP settings",
)
async def get_my_email_settings(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserEmailSettingsResponse:
    return email_settings_response(current_user)


@router.patch(
    "/me/email-settings",
    response_model=UserEmailSettingsResponse,
    summary="Update current user SMTP/IMAP settings",
)
async def update_my_email_settings(
    body: UserEmailSettingsUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserEmailSettingsResponse:
    updated = await UserAdminDAO.update_email_settings(
        session,
        current_user.id,
        smtp_host=body.smtp_host,
        smtp_port=body.smtp_port,
        smtp_user=body.smtp_user,
        smtp_password=body.smtp_password,
        imap_host=body.imap_host,
        imap_port=body.imap_port,
        imap_user=body.imap_user,
        imap_password=body.imap_password,
        clear_smtp_password=body.clear_smtp_password,
        clear_imap_password=body.clear_imap_password,
    )
    return email_settings_response(updated)
