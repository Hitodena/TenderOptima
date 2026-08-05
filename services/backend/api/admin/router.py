import uuid
from pathlib import Path
from typing import Annotated

from backend.api.admin.schemas import (
    AdminCooperationSendRequest,
    AdminCooperationSendResponse,
    AdminCooperationSupplierItem,
    AdminCooperationSupplierPage,
    AdminEmailMessageItem,
    AdminEmailMessageLinkUpdate,
    AdminEmailMessagePage,
    AdminRequestSupplierRecipientUpdate,
    AdminSmtpDefaultsResponse,
    AdminUserDetail,
    AdminUserListItem,
    ReferralInvitationCreate,
    ReferralInvitationResponse,
)
from backend.api.deps import get_admin, get_config_instance, get_session
from backend.api.subscriptions.helpers import subscription_to_response
from backend.api.subscriptions.schemas import SubscriptionUpdate
from backend.api.user_requests.schemas import Attachment
from backend.celery_app.tasks.admin_cooperation_tasks import (
    send_cooperation_proposals,
)
from backend.core.config import ALLOWED_CONTENT_TYPES, Config
from backend.db.dao import (
    EmailMessageDAO,
    ReferralInvitationDAO,
    RequestSupplierDAO,
    SubscriptionDAO,
    SupplierDAO,
    UserAdminDAO,
)
from backend.db.models import ReferralInvitation, User
from backend.enums import EmailMessageDirection
from backend.schemas.user_email_settings import UserEmailSettingsUpdate
from backend.utils.subscription_usage import SubscriptionUsage
from backend.utils.user_email_settings import email_settings_response
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/admin", tags=["Admin"])


def _admin_list_item(
    user: User,
    *,
    usage: SubscriptionUsage,
    pages_remaining: int | None = None,
) -> AdminUserListItem:
    return AdminUserListItem(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        ref_by=user.ref_by,
        is_admin=user.is_admin,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        smtp_password_configured=bool(user.smtp_password),
        imap_password_configured=bool(user.imap_password),
        searches_used_this_month=usage.searches_used,
        emails_sent_this_month=usage.emails_sent,
        pages_analyzed_this_month=usage.pages_analyzed,
        pages_analysis_remaining=pages_remaining,
        subscription=subscription_to_response(
            user.subscription,
            usage=usage,
        ),
    )


def _admin_detail(
    user: User,
    *,
    usage: SubscriptionUsage,
    pages_remaining: int | None = None,
) -> AdminUserDetail:
    return AdminUserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        ref_by=user.ref_by,
        is_admin=user.is_admin,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        email_settings=email_settings_response(user),
        searches_used_this_month=usage.searches_used,
        emails_sent_this_month=usage.emails_sent,
        pages_analyzed_this_month=usage.pages_analyzed,
        pages_analysis_remaining=pages_remaining,
        subscription=subscription_to_response(
            user.subscription,
            usage=usage,
        ),
    )


def _owner_mailbox(user: User | None) -> str | None:
    if user is None:
        return None
    return user.smtp_user or user.email


def _referral_item(
    invitation: ReferralInvitation,
) -> ReferralInvitationResponse:
    used_by_user = invitation.used_by_user
    return ReferralInvitationResponse(
        id=invitation.id,
        code=invitation.code,
        inviter_name=invitation.inviter_name,
        created_by_admin_id=invitation.created_by_admin_id,
        used_by_user_id=invitation.used_by_user_id,
        used_by_user_email=used_by_user.email if used_by_user else None,
        used_at=invitation.used_at,
        created_at=invitation.created_at,
    )


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
        usage, pages_remaining = await UserAdminDAO.usage_snapshot(
            session,
            user.id,
        )
        items.append(
            _admin_list_item(
                user,
                usage=usage,
                pages_remaining=pages_remaining,
            )
        )
    return items


@router.get(
    "/referrals",
    response_model=list[ReferralInvitationResponse],
    summary="List registration referral invitations",
)
async def list_referrals(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[ReferralInvitationResponse]:
    invitations = await ReferralInvitationDAO.list_invitations(session)
    return [_referral_item(invitation) for invitation in invitations]


@router.post(
    "/referrals",
    response_model=ReferralInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create registration referral invitation",
)
async def create_referral(
    body: ReferralInvitationCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(get_admin)],
) -> ReferralInvitationResponse:
    invitation = await ReferralInvitationDAO.create_invitation(
        session,
        inviter_name=body.inviter_name,
        created_by_admin_id=admin.id,
    )
    return _referral_item(invitation)


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
    usage, pages_remaining = await UserAdminDAO.usage_snapshot(
        session,
        user_id,
    )
    return _admin_detail(
        user,
        usage=usage,
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
    usage, pages_remaining = await UserAdminDAO.usage_snapshot(
        session,
        user_id,
    )
    return _admin_detail(
        refreshed,
        usage=usage,
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
        updated_sub = await SubscriptionDAO.upsert_for_user(
            session, user_id, **payload
        )
        # Ensure the user.subscription relationship reflects the upsert result
        # even if a prior selectinload left a stale instance in the session.
        await session.refresh(updated_sub)
        user.subscription = updated_sub
    refreshed = await UserAdminDAO.get_with_subscription(session, user_id)
    if not refreshed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    usage, pages_remaining = await UserAdminDAO.usage_snapshot(
        session,
        user_id,
    )
    return _admin_detail(
        refreshed,
        usage=usage,
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


@router.get(
    "/smtp-defaults",
    response_model=AdminSmtpDefaultsResponse,
    summary="Global SMTP defaults from environment",
)
async def get_smtp_defaults(
    config: Annotated[Config, Depends(get_config_instance)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminSmtpDefaultsResponse:
    return AdminSmtpDefaultsResponse(
        smtp_host=config.smtp_host,
        smtp_port=config.smtp_port,
        smtp_user=config.smtp_user,
        smtp_password_configured=bool(config.smtp_password),
    )


@router.get(
    "/cooperation/suppliers",
    response_model=AdminCooperationSupplierPage,
    summary="List suppliers who replied at least once",
)
async def list_cooperation_suppliers(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminCooperationSupplierPage:
    rows, total = await SupplierDAO.list_replied_for_cooperation(
        session,
        q=q,
        page=page,
        size=size,
    )
    return AdminCooperationSupplierPage(
        items=[
            AdminCooperationSupplierItem(
                id=supplier.id,
                company_name=supplier.company_name,
                domain=supplier.domain,
                main_email=supplier.main_email,
                queries=queries,
            )
            for supplier, queries in rows
        ],
        total=total,
        page=page,
        size=size,
    )


@router.post(
    "/cooperation/attachments",
    response_model=list[Attachment],
    summary="Upload attachments for cooperation outreach",
)
async def upload_cooperation_attachments(
    files: list[UploadFile],
    config: Annotated[Config, Depends(get_config_instance)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[Attachment]:
    if len(files) > config.max_upload_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Maximum {config.max_upload_files} files allowed per upload"
            ),
        )

    batch_dir = (
        Path(config.upload_dir) / "admin_cooperation" / uuid.uuid4().hex
    )
    try:
        batch_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cannot create upload directory",
        ) from exc

    results: list[Attachment] = []
    for file in files:
        if file.size and file.size > config.max_upload_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds max upload size",
            )
        if (
            file.content_type
            and file.content_type not in ALLOWED_CONTENT_TYPES
        ):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type {file.content_type} not supported",
            )
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required",
            )

        safe_filename = Path(file.filename).name.replace("..", "_")
        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
        file_path = batch_dir / unique_filename
        content = await file.read()
        if len(content) > config.max_upload_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File {file.filename} exceeds max upload size",
            )
        file_path.write_bytes(content)
        results.append(
            Attachment(
                filename=safe_filename,
                content_type=file.content_type,
                size=len(content),
                path=str(file_path),
            )
        )
    return results


@router.post(
    "/cooperation/send",
    response_model=AdminCooperationSendResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue cooperation proposal emails",
)
async def send_cooperation_emails(
    body: AdminCooperationSendRequest,
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminCooperationSendResponse:
    if not body.subject.strip() or not body.body.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject and body cannot be empty",
        )

    send_cooperation_proposals.delay(  # type: ignore[attr-defined]
        [str(sid) for sid in body.supplier_ids],
        body.subject.strip(),
        body.body.strip(),
        body.attachment_paths,
        body.smtp_host,
        body.smtp_user,
        body.smtp_password,
    )
    return AdminCooperationSendResponse(
        status="queued",
        queued=len(body.supplier_ids),
    )
