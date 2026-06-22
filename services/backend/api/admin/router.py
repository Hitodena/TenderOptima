import uuid
from typing import Annotated

from backend.api.admin.schemas import (
    AdminUserDetail,
    AdminUserListItem,
    UserEmailSettingsResponse,
    UserEmailSettingsUpdate,
)
from backend.api.deps import get_admin, get_session
from backend.api.subscriptions.helpers import subscription_to_response
from backend.api.subscriptions.schemas import SubscriptionUpdate
from backend.db.dao import SubscriptionDAO, UserAdminDAO
from backend.db.models import User
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/admin", tags=["Admin"])


def _email_settings_response(user: User) -> UserEmailSettingsResponse:
    return UserEmailSettingsResponse(
        smtp_host=user.smtp_host,
        smtp_user=user.smtp_user,
        smtp_password_configured=bool(user.smtp_password),
        imap_host=user.imap_host,
        imap_user=user.imap_user,
        imap_password_configured=bool(user.imap_password),
    )


def _admin_list_item(user: User) -> AdminUserListItem:
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        is_admin=user.is_admin,
        smtp_password_configured=bool(user.smtp_password),
        imap_password_configured=bool(user.imap_password),
        subscription=subscription_to_response(user.subscription),
    )


@router.get(
    "/users",
    response_model=list[AdminUserListItem],
    summary="List all users (admin)",
)
async def list_users(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[AdminUserListItem]:
    users = await UserAdminDAO.list_users(session)
    return [_admin_list_item(user) for user in users]


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetail,
    summary="Get user admin detail",
)
async def get_user_detail(
    user_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminUserDetail:
    user = await UserAdminDAO.get_with_subscription(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return AdminUserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        is_admin=user.is_admin,
        email_settings=_email_settings_response(user),
        subscription=subscription_to_response(user.subscription),
    )


@router.patch(
    "/users/{user_id}/email-settings",
    response_model=AdminUserDetail,
    summary="Update user SMTP/IMAP settings",
)
async def update_user_email_settings(
    user_id: uuid.UUID,
    body: UserEmailSettingsUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminUserDetail:
    user = await UserAdminDAO.get_with_subscription(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    await UserAdminDAO.update_email_settings(
        session,
        user_id,
        smtp_host=body.smtp_host,
        smtp_user=body.smtp_user,
        smtp_password=body.smtp_password,
        imap_host=body.imap_host,
        imap_user=body.imap_user,
        imap_password=body.imap_password,
        clear_smtp_password=body.clear_smtp_password,
        clear_imap_password=body.clear_imap_password,
    )
    refreshed = await UserAdminDAO.get_with_subscription(session, user_id)
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return AdminUserDetail(
        id=refreshed.id,
        email=refreshed.email,
        full_name=refreshed.full_name,
        company_name=refreshed.company_name,
        is_admin=refreshed.is_admin,
        email_settings=_email_settings_response(refreshed),
        subscription=subscription_to_response(refreshed.subscription),
    )


@router.patch(
    "/users/{user_id}/subscription",
    response_model=AdminUserDetail,
    summary="Update user subscription",
)
async def update_user_subscription(
    user_id: uuid.UUID,
    body: SubscriptionUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminUserDetail:
    user = await UserAdminDAO.get_with_subscription(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    payload = body.model_dump(exclude_unset=True)
    if payload:
        plan = payload.get("plan")
        if plan is not None:
            payload["plan"] = plan.value if hasattr(plan, "value") else plan
        await SubscriptionDAO.upsert_for_user(session, user_id, **payload)
    refreshed = await UserAdminDAO.get_with_subscription(session, user_id)
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return AdminUserDetail(
        id=refreshed.id,
        email=refreshed.email,
        full_name=refreshed.full_name,
        company_name=refreshed.company_name,
        is_admin=refreshed.is_admin,
        email_settings=_email_settings_response(refreshed),
        subscription=subscription_to_response(refreshed.subscription),
    )
