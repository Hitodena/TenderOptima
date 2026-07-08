import uuid
from typing import Annotated

from backend.api.admin.schemas import (
    AdminEmailMessageItem,
    AdminEmailMessageLinkUpdate,
    AdminEmailMessagePage,
    AdminRequestSupplierRecipientUpdate,
    AdminUserDetail,
    AdminUserListItem,
)
from backend.api.deps import get_admin, get_session
from backend.api.subscriptions.helpers import subscription_to_response
from backend.api.subscriptions.schemas import SubscriptionUpdate
from backend.db.dao import (
    EmailMessageDAO,
    RequestSupplierDAO,
    SubscriptionDAO,
    UserAdminDAO,
)
from backend.db.models import User
from backend.enums import EmailMessageDirection
from backend.schemas.user_email_settings import UserEmailSettingsUpdate
from backend.utils.user_email_settings import email_settings_response
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/admin", tags=["Admin"])


def _admin_list_item(
    user: User,
    *,
    emails_sent: int = 0,
    pages_analyzed: int = 0,
    pages_remaining: int | None = None,
) -> AdminUserListItem:
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        is_admin=user.is_admin,
        created_at=user.created_at,
        smtp_password_configured=bool(user.smtp_password),
        imap_password_configured=bool(user.imap_password),
        emails_sent_this_month=emails_sent,
        pages_analyzed_this_month=pages_analyzed,
        pages_analysis_remaining=pages_remaining,
        subscription=subscription_to_response(user.subscription),
    )


def _admin_detail(
    user: User,
    *,
    emails_sent: int = 0,
    pages_analyzed: int = 0,
    pages_remaining: int | None = None,
) -> AdminUserDetail:
    return AdminUserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        is_admin=user.is_admin,
        created_at=user.created_at,
        email_settings=email_settings_response(user),
        emails_sent_this_month=emails_sent,
        pages_analyzed_this_month=pages_analyzed,
        pages_analysis_remaining=pages_remaining,
        subscription=subscription_to_response(user.subscription),
    )


def _owner_mailbox(user: User | None) -> str | None:
    if user is None:
        return None
    return user.smtp_user or user.email


def _email_message_item(message) -> AdminEmailMessageItem:
    rs = message.request_supplier
    supplier = rs.supplier if rs else None
    request = rs.request if rs else None
    owner = request.user if request else None
    is_outgoing = message.direction == EmailMessageDirection.OUTGOING.value
    owner_mailbox = _owner_mailbox(owner)
    supplier_recipient = (rs.sent_to_email if rs else None) or (
        supplier.main_email if supplier else None
    )

    from_email = message.from_email
    to_email = message.to_email
    mailbox_email = message.mailbox_email or owner_mailbox

    if is_outgoing:
        from_email = from_email or owner_mailbox
        to_email = to_email or supplier_recipient
    else:
        from_email = from_email or supplier_recipient
        to_email = to_email or owner_mailbox

    matched_by = message.matched_by or (
        "outbound" if is_outgoing else "unknown"
    )
    match_confidence = message.match_confidence or (
        "n/a" if is_outgoing else "unknown"
    )

    supplier_company = supplier.company_name if supplier else None

    return AdminEmailMessageItem(
        id=message.id,
        direction=message.direction,
        subject=message.subject,
        from_email=from_email,
        to_email=to_email,
        mailbox_email=mailbox_email,
        imap_id=message.imap_id,
        message_id=message.message_id,
        matched_by=matched_by,
        match_confidence=match_confidence,
        received_at=message.received_at,
        request_supplier_id=message.request_supplier_id,
        request_id=rs.request_id if rs else None,
        tracking_id=rs.tracking_id if rs else None,
        supplier_email=supplier_recipient,
        supplier_company=supplier_company,
        supplier_domain=supplier.domain if supplier else None,
        user_email=owner.email if owner else None,
        user_id=owner.id if owner else None,
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
    items: list[AdminUserListItem] = []
    for user in users:
        (
            emails_sent,
            pages_analyzed,
            pages_remaining,
        ) = await UserAdminDAO.usage_snapshot(session, user.id)
        items.append(
            _admin_list_item(
                user,
                emails_sent=emails_sent,
                pages_analyzed=pages_analyzed,
                pages_remaining=pages_remaining,
            )
        )
    return items


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
    (
        emails_sent,
        pages_analyzed,
        pages_remaining,
    ) = await UserAdminDAO.usage_snapshot(session, user_id)
    return _admin_detail(
        user,
        emails_sent=emails_sent,
        pages_analyzed=pages_analyzed,
        pages_remaining=pages_remaining,
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
    refreshed = await UserAdminDAO.get_with_subscription(session, user_id)
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    (
        emails_sent,
        pages_analyzed,
        pages_remaining,
    ) = await UserAdminDAO.usage_snapshot(session, user_id)
    return _admin_detail(
        refreshed,
        emails_sent=emails_sent,
        pages_analyzed=pages_analyzed,
        pages_remaining=pages_remaining,
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
    (
        emails_sent,
        pages_analyzed,
        pages_remaining,
    ) = await UserAdminDAO.usage_snapshot(session, user_id)
    return _admin_detail(
        refreshed,
        emails_sent=emails_sent,
        pages_analyzed=pages_analyzed,
        pages_remaining=pages_remaining,
    )


@router.get(
    "/email-messages",
    response_model=AdminEmailMessagePage,
    summary="List email messages for routing diagnostics",
)
async def list_email_messages(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    missing_subject_only: Annotated[
        bool,
        Query(
            description=(
                "When true, only incoming messages with empty subject"
            ),
        ),
    ] = True,
) -> AdminEmailMessagePage:
    rows, total = await EmailMessageDAO.list_admin_page(
        session,
        page=page,
        size=size,
        missing_subject_only=missing_subject_only,
    )
    return AdminEmailMessagePage(
        items=[_email_message_item(row) for row in rows],
        total=total,
        page=page,
        size=size,
    )


@router.patch(
    "/email-messages/{message_id}/link",
    response_model=AdminEmailMessageItem,
    summary="Reassign email message to another request-supplier link",
)
async def relink_email_message(
    message_id: uuid.UUID,
    body: AdminEmailMessageLinkUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminEmailMessageItem:
    message = await EmailMessageDAO.get_by_id(session, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Email message not found")
    rs = await RequestSupplierDAO.get_by_id(session, body.request_supplier_id)
    if not rs:
        raise HTTPException(
            status_code=404, detail="Request supplier not found"
        )
    updated = await EmailMessageDAO.update_fields(
        session,
        message_id,
        request_supplier_id=body.request_supplier_id,
        matched_by="manual",
        match_confidence="manual",
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Email message not found")
    refreshed = await EmailMessageDAO.get_by_id(session, message_id)
    if refreshed is None:
        raise HTTPException(status_code=404, detail="Email message not found")
    return _email_message_item(refreshed)


@router.patch(
    "/request-suppliers/{rs_id}/recipient",
    response_model=dict,
    summary="Update stored recipient email for a request-supplier link",
)
async def update_request_supplier_recipient(
    rs_id: uuid.UUID,
    body: AdminRequestSupplierRecipientUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> dict:
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs:
        raise HTTPException(
            status_code=404, detail="Request supplier not found"
        )
    await RequestSupplierDAO.update_fields(
        session,
        rs_id,
        sent_to_email=str(body.sent_to_email),
    )
    return {"status": "updated", "rs_id": str(rs_id)}
