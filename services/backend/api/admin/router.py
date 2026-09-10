import mimetypes
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from backend.api.admin.schemas import (
    AdminAnalysisAttachment,
    AdminAnalysisDetail,
    AdminAnalysisListItem,
    AdminAnalysisMatchItem,
    AdminAnalysisPage,
    AdminCooperationSendRequest,
    AdminCooperationSendResponse,
    AdminCooperationSupplierItem,
    AdminCooperationSupplierPage,
    AdminEmailMessageItem,
    AdminEmailMessageLinkUpdate,
    AdminEmailMessagePage,
    AdminRequestSupplierRecipientUpdate,
    AdminSmtpDefaultsResponse,
    AdminSupplierPreferenceItem,
    AdminSupplierPreferencePage,
    AdminUserDetail,
    AdminUserListItem,
    DeletedUserPurposeCountdown,
    DeletedUserRetentionItem,
    DeletedUserRetentionPage,
    PersonalDataCleanupEnqueueResponse,
    PersonalDataCleanupRunResponse,
    PersonalDataPurposeResponse,
    ReferralInvitationCreate,
    ReferralInvitationResponse,
)
from backend.api.cooperation.schemas import (
    CooperationLeadPageResponse,
    CooperationLeadResponse,
    VerifiedSupplierPageResponse,
    VerifiedSupplierResponse,
)
from backend.api.deps import get_admin, get_config_instance, get_session
from backend.api.subscriptions.helpers import subscription_to_response
from backend.api.subscriptions.schemas import SubscriptionUpdate
from backend.api.user_requests.router import (
    _resolve_and_validate_attachment_path,
)
from backend.api.user_requests.schemas import Attachment
from backend.celery_app.tasks.admin_cooperation_tasks import (
    send_cooperation_proposals,
)
from backend.celery_app.tasks.retention_tasks import PURPOSE_TASKS
from backend.core.config import ALLOWED_CONTENT_TYPES, Config
from backend.db.dao import (
    CooperationLeadDAO,
    EmailMessageDAO,
    PersonalDataCleanupRunDAO,
    ReferralInvitationDAO,
    RequestSupplierDAO,
    SubscriptionDAO,
    SupplierDAO,
    SupplierEmailPreferenceDAO,
    UserAdminDAO,
    VerifiedSupplierDAO,
)
from backend.db.models import CooperationLead, ReferralInvitation, User
from backend.enums import (
    CooperationLeadStatus,
    EmailMessageDirection,
    SupplierEmailPreferenceStatus,
)
from backend.schemas.analysis import EmailAnalysisResult
from backend.schemas.user_email_settings import UserEmailSettingsUpdate
from backend.services.personal_data_cleanup import (
    days_since,
    days_until_cleanup,
    list_deleted_users,
    nearest_cleanup_days,
    purpose_ready,
)
from backend.utils.personal_data_retention import (
    PERSONAL_DATA_PURPOSES,
    get_purpose,
)
from backend.utils.subscription_carryover import (
    limits_after_plan_change_for_subscription,
    merge_carryover_into_payload,
)
from backend.utils.subscription_usage import (
    SubscriptionUsage,
    SubscriptionUsageDAO,
)
from backend.utils.user_email_settings import email_settings_response
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
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
        agree_terms=user.agree_terms,
        agree_marketing=user.agree_marketing,
        terms_accepted_at=user.terms_accepted_at,
        terms_version=user.terms_version,
        privacy_version=user.privacy_version,
        consent_ip=user.consent_ip,
        consent_user_agent=user.consent_user_agent,
        marketing_consent_at=user.marketing_consent_at,
        marketing_consent_version=user.marketing_consent_version,
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


def _attachment_items(raw: list | None) -> list[AdminAnalysisAttachment]:
    items: list[AdminAnalysisAttachment] = []
    if not isinstance(raw, list):
        return items
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        path = str(entry.get("path") or "").strip()
        filename = str(entry.get("filename") or "").strip()
        if not path or not filename:
            continue
        size_raw = entry.get("size")
        try:
            size = int(size_raw) if size_raw is not None else None
        except (TypeError, ValueError):
            size = None
        content_type = entry.get("content_type")
        items.append(
            AdminAnalysisAttachment(
                filename=filename,
                content_type=(
                    str(content_type).strip() if content_type else None
                ),
                size=size,
                path=path,
            )
        )
    return items


def _match_items_from_raw(raw: dict | None) -> list[AdminAnalysisMatchItem]:
    if not raw:
        return []
    try:
        result = EmailAnalysisResult(**raw)
    except Exception:
        return []
    items: list[AdminAnalysisMatchItem] = []
    for match in result.matches:
        items.append(
            AdminAnalysisMatchItem(
                requirement=match.requirement,
                offer_value=match.offer_value,
                numeric_value=match.numeric_value,
                currency=match.currency,
                explanation=match.explanation,
                status=match.status.value,
                corrected_from=match.corrected_from,
                value_origin=(
                    match.value_origin.value if match.value_origin else None
                ),
                source_message_id=match.source_message_id,
            )
        )
    return items


def _match_origin_counts(
    matches: list[AdminAnalysisMatchItem],
) -> tuple[int, int, int, int]:
    calculated = 0
    manual = 0
    extracted = 0
    for match in matches:
        if match.corrected_from:
            manual += 1
        elif match.value_origin == "calculated":
            calculated += 1
        elif match.value_origin == "extracted":
            extracted += 1
    return len(matches), calculated, manual, extracted


def _analysis_list_item(message) -> AdminAnalysisListItem:
    rs = message.request_supplier
    supplier = rs.supplier if rs else None
    request = rs.request if rs else None
    owner = request.user if request else None
    analysis = message.analysis
    attachments = _attachment_items(message.attachments)
    matches = _match_items_from_raw(
        analysis.raw_llm_response if analysis else None
    )
    match_count, calculated, manual, extracted = _match_origin_counts(matches)
    supplier_email = (rs.sent_to_email if rs else None) or (
        supplier.main_email if supplier else None
    )
    return AdminAnalysisListItem(
        message_id=message.id,
        analysis_id=analysis.id if analysis else None,
        analysis_status=analysis.status if analysis else None,
        llm_model=analysis.llm_model if analysis else None,
        subject=message.subject,
        from_email=message.from_email or supplier_email,
        received_at=message.received_at,
        request_id=rs.request_id if rs else None,
        request_query=request.query if request else None,
        request_supplier_id=message.request_supplier_id,
        supplier_company=supplier.company_name if supplier else None,
        supplier_email=supplier_email,
        user_email=owner.email if owner else None,
        user_id=owner.id if owner else None,
        attachment_count=len(attachments),
        match_count=match_count,
        calculated_count=calculated,
        manual_count=manual,
        extracted_count=extracted,
    )


def _analysis_detail(message) -> AdminAnalysisDetail:
    rs = message.request_supplier
    supplier = rs.supplier if rs else None
    request = rs.request if rs else None
    owner = request.user if request else None
    analysis = message.analysis
    attachments = _attachment_items(message.attachments)
    matches = _match_items_from_raw(
        analysis.raw_llm_response if analysis else None
    )
    body = (message.raw_body or "").strip()
    body_preview = body[:2000] if body else None
    supplier_email = (rs.sent_to_email if rs else None) or (
        supplier.main_email if supplier else None
    )
    return AdminAnalysisDetail(
        message_id=message.id,
        analysis_id=analysis.id if analysis else None,
        analysis_status=analysis.status if analysis else None,
        llm_model=analysis.llm_model if analysis else None,
        subject=message.subject,
        from_email=message.from_email or supplier_email,
        to_email=message.to_email,
        received_at=message.received_at,
        body_preview=body_preview,
        request_id=rs.request_id if rs else None,
        request_query=request.query if request else None,
        request_supplier_id=message.request_supplier_id,
        supplier_company=supplier.company_name if supplier else None,
        supplier_email=supplier_email,
        user_email=owner.email if owner else None,
        user_id=owner.id if owner else None,
        attachments=attachments,
        matches=matches,
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
        existing = user.subscription
        new_plan = payload.get("plan")
        plan_changed = new_plan is not None and (
            existing is None or existing.plan != new_plan
        )
        if plan_changed:
            geo_code = payload.get(
                "geo_code",
                existing.geo_code if existing else "BY",
            )
            usage = await SubscriptionUsageDAO.get_for_user(
                session,
                user_id,
            )
            carried = limits_after_plan_change_for_subscription(
                existing,
                new_plan=new_plan,
                new_geo_code=geo_code,
                usage=usage,
            )
            merge_carryover_into_payload(
                payload,
                carried=carried,
                plan=new_plan,
                geo_code=geo_code,
            )
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


@router.get(
    "/response-analyses",
    response_model=AdminAnalysisPage,
    summary="List email analyses for prompt/debug review",
)
async def list_response_analyses(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    q: Annotated[str | None, Query(max_length=200)] = None,
    with_attachments_only: Annotated[bool, Query()] = False,
) -> AdminAnalysisPage:
    rows, total = await EmailMessageDAO.list_admin_analysis_page(
        session,
        page=page,
        size=size,
        q=q,
        with_attachments_only=with_attachments_only,
    )
    return AdminAnalysisPage(
        items=[_analysis_list_item(row) for row in rows],
        total=total,
        page=page,
        size=size,
    )


@router.get(
    "/response-analyses/{message_id}",
    response_model=AdminAnalysisDetail,
    summary="Get email analysis detail with attachments and matches",
)
async def get_response_analysis_debug(
    message_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> AdminAnalysisDetail:
    message = await EmailMessageDAO.get_admin_analysis_detail(
        session, message_id
    )
    if not message or not message.analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return _analysis_detail(message)


@router.get(
    "/attachments/serve",
    summary="Download a request/email attachment (admin)",
)
async def serve_admin_attachment(
    _admin: Annotated[User, Depends(get_admin)],
    config: Annotated[Config, Depends(get_config_instance)],
    attachment_path: Annotated[
        str,
        Query(description="Stored attachment path (full or relative)"),
    ],
) -> FileResponse:
    candidate = _resolve_and_validate_attachment_path(
        attachment_path, config.upload_dir
    )
    if candidate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )
    filename = candidate.name
    if "_" in filename:
        prefix, rest = filename.split("_", 1)
        if len(prefix) == 32 and all(
            ch in "0123456789abcdefABCDEF" for ch in prefix
        ):
            filename = rest
    media_type = (
        mimetypes.guess_type(filename)[0] or "application/octet-stream"
    )
    return FileResponse(
        path=str(candidate),
        filename=filename,
        media_type=media_type,
    )


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


def _cooperation_lead_response(
    row: CooperationLead,
) -> CooperationLeadResponse:
    return CooperationLeadResponse(
        id=row.id,
        name=row.name,
        email=row.email,
        phone=row.phone,
        company=row.company,
        industry=row.industry,
        comment=row.comment,
        agree_marketing=row.agree_marketing,
        status=CooperationLeadStatus(row.status),
        utm_source=row.utm_source,
        utm_medium=row.utm_medium,
        utm_campaign=row.utm_campaign,
        utm_content=row.utm_content,
        page_url=row.page_url,
        approved_at=row.approved_at,
        cancelled_at=row.cancelled_at,
        created_at=row.created_at,
    )


@router.get(
    "/cooperation/leads",
    response_model=CooperationLeadPageResponse,
    summary="List supplier cooperation invitation leads",
)
async def list_cooperation_leads(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Annotated[
        CooperationLeadStatus | None, Query(alias="status")
    ] = None,
) -> CooperationLeadPageResponse:
    rows, total = await CooperationLeadDAO.list_page(
        session,
        page=page,
        size=size,
        status=status_filter,
    )
    return CooperationLeadPageResponse(
        items=[_cooperation_lead_response(row) for row in rows],
        page=page,
        size=size,
        total=total,
    )


def _supplier_preference_item(
    pref,
    source_request_query: str | None,
) -> AdminSupplierPreferenceItem:
    return AdminSupplierPreferenceItem(
        id=pref.id,
        email=pref.email,
        status=pref.status,
        categories=list(pref.categories or []),
        region=pref.region,
        consent_accepted_at=pref.consent_accepted_at,
        consent_ip=pref.consent_ip,
        terms_accepted_at=pref.terms_accepted_at,
        terms_version=pref.terms_version,
        privacy_version=pref.privacy_version,
        consent_user_agent=pref.consent_user_agent,
        agree_marketing=pref.agree_marketing,
        marketing_consent_at=pref.marketing_consent_at,
        marketing_consent_version=pref.marketing_consent_version,
        source_request_id=pref.source_request_id,
        source_request_query=source_request_query,
        subscribed_at=pref.subscribed_at,
        unsubscribed_at=pref.unsubscribed_at,
        created_at=pref.created_at,
    )


@router.get(
    "/supplier-preferences",
    response_model=AdminSupplierPreferencePage,
    summary="List supplier RFQ email preferences",
)
async def list_supplier_preferences(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    status_filter: Annotated[
        SupplierEmailPreferenceStatus | None, Query(alias="status")
    ] = None,
) -> AdminSupplierPreferencePage:
    rows, total = await SupplierEmailPreferenceDAO.list_page(
        session,
        page=page,
        size=size,
        status=status_filter,
    )
    return AdminSupplierPreferencePage(
        items=[
            _supplier_preference_item(pref, source_query)
            for pref, source_query in rows
        ],
        page=page,
        size=size,
        total=total,
    )


@router.post(
    "/cooperation/leads/{lead_id}/approve",
    response_model=CooperationLeadResponse,
    summary="Approve cooperation lead and write verified supplier",
)
async def approve_cooperation_lead(
    lead_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(get_admin)],
) -> CooperationLeadResponse:
    lead = await CooperationLeadDAO.get_by_id(session, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    if lead.status == CooperationLeadStatus.APPROVED.value:
        return _cooperation_lead_response(lead)
    if lead.status == CooperationLeadStatus.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Отклонённую заявку нельзя одобрить",
        )

    now = datetime.now(UTC)
    try:
        approved = await CooperationLeadDAO.approve(
            session,
            lead_id,
            admin_id=admin.id,
            approved_at=now,
        )
        if approved is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Заявка не найдена",
            )
        await VerifiedSupplierDAO.create_from_lead(
            session,
            company_name=approved.company,
            email=approved.email,
            phone=approved.phone,
            industry=approved.industry,
            contact_name=approved.name,
            comments=approved.comment,
            source_lead_id=approved.id,
            approved_by_admin_id=admin.id,
            agree_marketing=approved.agree_marketing,
            terms_accepted_at=approved.terms_accepted_at,
            terms_version=approved.terms_version,
            privacy_version=approved.privacy_version,
            consent_ip=approved.ip_address,
            consent_user_agent=approved.consent_user_agent,
            marketing_consent_at=approved.marketing_consent_at,
            marketing_consent_version=approved.marketing_consent_version,
        )
        await session.commit()
        await session.refresh(approved)
    except HTTPException:
        raise
    except Exception:
        await session.rollback()
        raise

    return _cooperation_lead_response(approved)


@router.post(
    "/cooperation/leads/{lead_id}/cancel",
    response_model=CooperationLeadResponse,
    summary="Cancel a cooperation invitation lead",
)
async def cancel_cooperation_lead(
    lead_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(get_admin)],
) -> CooperationLeadResponse:
    lead = await CooperationLeadDAO.get_by_id(session, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    if lead.status == CooperationLeadStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Одобренную заявку нельзя отклонить",
        )
    if lead.status == CooperationLeadStatus.CANCELLED.value:
        return _cooperation_lead_response(lead)

    cancelled = await CooperationLeadDAO.cancel(
        session,
        lead_id,
        admin_id=admin.id,
        cancelled_at=datetime.now(UTC),
    )
    if cancelled is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Заявка не найдена",
        )
    return _cooperation_lead_response(cancelled)


@router.get(
    "/cooperation/verified-suppliers",
    response_model=VerifiedSupplierPageResponse,
    summary="List verified suppliers approved via cooperation",
)
async def list_verified_suppliers(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> VerifiedSupplierPageResponse:
    rows, total = await VerifiedSupplierDAO.list_page(
        session, page=page, size=size
    )
    return VerifiedSupplierPageResponse(
        items=[
            VerifiedSupplierResponse(
                id=row.id,
                company_name=row.company_name,
                email=row.email,
                phone=row.phone,
                industry=row.industry,
                contact_name=row.contact_name,
                comments=row.comments,
                source=row.source,
                source_lead_id=row.source_lead_id,
                created_at=row.created_at,
            )
            for row in rows
        ],
        page=page,
        size=size,
        total=total,
    )


@router.get(
    "/personal-data/purposes",
    response_model=list[PersonalDataPurposeResponse],
    summary="List personal-data processing purposes",
)
async def list_personal_data_purposes(
    _admin: Annotated[User, Depends(get_admin)],
) -> list[PersonalDataPurposeResponse]:
    return [
        PersonalDataPurposeResponse(
            purpose_number=row.purpose_number,
            purpose=row.purpose,
            subjects=row.subjects,
            data_list=row.data_list,
            legal_basis=row.legal_basis,
            retention_text=row.retention_text,
            retention_days_after_user_deletion=(
                row.retention_days_after_user_deletion
            ),
            cleanup_supported=row.cleanup_supported,
            cleanup_task_name=row.cleanup_task_name,
            cleanup_description=row.cleanup_description,
        )
        for row in PERSONAL_DATA_PURPOSES
    ]


@router.get(
    "/personal-data/deleted-users",
    response_model=DeletedUserRetentionPage,
    summary="List deleted users with retention countdowns",
)
async def list_deleted_users_for_retention(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> DeletedUserRetentionPage:
    now = datetime.now(UTC)
    users = await list_deleted_users(session)
    items: list[DeletedUserRetentionItem] = []
    for user in users:
        if user.deleted_at is None:
            continue
        purpose_rows: list[DeletedUserPurposeCountdown] = []
        for purpose in PERSONAL_DATA_PURPOSES:
            if (
                not purpose.cleanup_supported
                or purpose.retention_days_after_user_deletion is None
            ):
                continue
            days_left = days_until_cleanup(
                user.deleted_at,
                purpose.retention_days_after_user_deletion,
                now=now,
            )
            purpose_rows.append(
                DeletedUserPurposeCountdown(
                    purpose_number=purpose.purpose_number,
                    retention_days=purpose.retention_days_after_user_deletion,
                    days_until_cleanup=days_left,
                    ready=purpose_ready(
                        user.deleted_at,
                        purpose.retention_days_after_user_deletion,
                        now=now,
                    ),
                )
            )
        items.append(
            DeletedUserRetentionItem(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                deleted_at=user.deleted_at,
                deleted_reason=user.deleted_reason,
                days_since_deleted=days_since(user.deleted_at, now=now),
                nearest_cleanup_days=nearest_cleanup_days(
                    user.deleted_at, now=now
                ),
                purposes=purpose_rows,
            )
        )
    return DeletedUserRetentionPage(items=items, total=len(items))


@router.get(
    "/personal-data/cleanup-runs",
    response_model=list[PersonalDataCleanupRunResponse],
    summary="List recent personal-data cleanup runs",
)
async def list_personal_data_cleanup_runs(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[PersonalDataCleanupRunResponse]:
    rows = await PersonalDataCleanupRunDAO.list_recent(session, limit=limit)
    return [
        PersonalDataCleanupRunResponse(
            id=row.id,
            purpose_number=row.purpose_number,
            status=row.status,
            requested_by_admin_id=row.requested_by_admin_id,
            celery_task_id=row.celery_task_id,
            started_at=row.started_at,
            finished_at=row.finished_at,
            eligible_users=row.eligible_users,
            affected_records=row.affected_records,
            error=row.error,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post(
    "/personal-data/cleanup/{purpose_number}",
    response_model=PersonalDataCleanupEnqueueResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue personal-data cleanup for a purpose",
)
async def enqueue_personal_data_cleanup(
    purpose_number: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(get_admin)],
) -> PersonalDataCleanupEnqueueResponse:
    purpose = get_purpose(purpose_number)
    if purpose is None or not purpose.cleanup_supported:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Очистка для этого пункта реестра не поддерживается",
        )
    task = PURPOSE_TASKS.get(purpose_number)
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Задача очистки не найдена",
        )

    run = await PersonalDataCleanupRunDAO.create(
        session,
        purpose_number=purpose_number,
        status="queued",
        requested_by_admin_id=admin.id,
        eligible_users=0,
        affected_records=0,
    )
    async_result = task.delay(str(run.id))  # type: ignore[attr-defined]
    updated = await PersonalDataCleanupRunDAO.update_fields(
        session,
        run.id,
        celery_task_id=async_result.id,
    )
    return PersonalDataCleanupEnqueueResponse(
        run_id=run.id,
        purpose_number=purpose_number,
        status=(updated.status if updated else "queued"),
        celery_task_id=async_result.id,
        message=(
            f"Задача очистки пункта {purpose_number} поставлена в очередь"
        ),
    )
