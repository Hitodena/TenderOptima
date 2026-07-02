"""Subscription billing profile, document generation, and email delivery."""

import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.billing.schemas import (
    BillingDocumentLineItem,
    BillingDocumentResponse,
    BillingGenerateRequest,
    BillingGenerateResponse,
    BillingProfileResponse,
    BillingProfileUpdate,
)
from backend.api.deps import get_current_user, get_session
from backend.celery_app.tasks.billing_tasks import send_billing_document_email
from backend.core.config import get_config
from backend.db.dao import (
    SubscriptionBillingDocumentDAO,
    SubscriptionBillingProfileDAO,
    SubscriptionDAO,
)
from backend.db.models import User
from backend.db.models.subscription_billing import SubscriptionBillingProfile
from backend.services.billing.doc_generator import (
    issuer_from_config,
    write_billing_documents,
)
from backend.services.billing.extract_profile import (
    extract_billing_profile_fields,
)
from backend.services.billing.subscription_lines import (
    build_subscription_quote,
)

router = APIRouter(prefix="/billing", tags=["Billing"])

config = get_config()

REQUIRED_PROFILE_FIELDS = (
    "organization_form",
    "inn",
    "organization_name",
    "ogrn",
    "legal_address",
    "bank_name",
    "settlement_account",
)


def _profile_to_response(
    profile: SubscriptionBillingProfile | None,
) -> BillingProfileResponse:
    if profile is None:
        return BillingProfileResponse()
    return BillingProfileResponse.model_validate(profile)


def _document_to_response(row) -> BillingDocumentResponse:
    items = [
        BillingDocumentLineItem(**item)
        for item in (row.line_items or [])
        if isinstance(item, dict)
    ]
    return BillingDocumentResponse(
        id=row.id,
        receipt_id=row.receipt_id,
        plan=row.plan,
        period_start=row.period_start,
        period_end=row.period_end,
        currency_code=row.currency_code,
        total_amount=row.total_amount,
        line_items=items,
        email_status=row.email_status,
        sent_at=row.sent_at,
        recipient_email=row.recipient_email,
        created_at=row.created_at,
    )


def _validate_profile(profile: SubscriptionBillingProfile) -> None:
    missing = [
        field
        for field in REQUIRED_PROFILE_FIELDS
        if not getattr(profile, field, None)
    ]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fill required billing fields: {', '.join(missing)}",
        )


def _billing_storage_dir(user_id: uuid.UUID) -> Path:
    return Path(config.upload_dir) / "billing" / str(user_id)


@router.get(
    "/profile",
    response_model=BillingProfileResponse,
    summary="Get billing requisites for current user",
)
async def get_billing_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BillingProfileResponse:
    profile = await SubscriptionBillingProfileDAO.get_by_user_id(
        session, current_user.id
    )
    return _profile_to_response(profile)


@router.put(
    "/profile",
    response_model=BillingProfileResponse,
    summary="Save billing requisites",
)
async def save_billing_profile(
    body: BillingProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BillingProfileResponse:
    payload = body.model_dump(exclude_unset=True)
    profile = await SubscriptionBillingProfileDAO.upsert_for_user(
        session,
        current_user.id,
        **payload,
    )
    return _profile_to_response(profile)


@router.post(
    "/profile/extract",
    response_model=BillingProfileResponse,
    summary="Extract billing requisites from text and uploaded files",
)
async def extract_billing_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    free_text: Annotated[str, Form()] = "",
    files: Annotated[list[UploadFile] | None, File()] = None,
) -> BillingProfileResponse:
    upload_dir = _billing_storage_dir(current_user.id) / "extract"
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: list[Path] = []
    for upload in files or []:
        if not upload.filename:
            continue
        dest = upload_dir / upload.filename
        content = await upload.read()
        dest.write_bytes(content)
        saved_paths.append(dest)

    extracted = await extract_billing_profile_fields(
        free_text=free_text,
        file_paths=saved_paths,
    )
    existing = await SubscriptionBillingProfileDAO.get_by_user_id(
        session, current_user.id
    )
    merged = {
        **(_profile_to_response(existing).model_dump() if existing else {}),
        **extracted.model_dump(exclude_none=True),
    }
    profile = await SubscriptionBillingProfileDAO.upsert_for_user(
        session,
        current_user.id,
        **merged,
    )
    return _profile_to_response(profile)


@router.get(
    "/documents",
    response_model=list[BillingDocumentResponse],
    summary="List generated billing documents",
)
async def list_billing_documents(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BillingDocumentResponse]:
    rows = await SubscriptionBillingDocumentDAO.list_for_user(
        session, current_user.id
    )
    return [_document_to_response(row) for row in rows]


@router.post(
    "/documents/generate",
    response_model=BillingGenerateResponse,
    summary="Generate invoice/act DOCX for current subscription",
)
async def generate_billing_document(
    body: BillingGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BillingGenerateResponse:
    subscription = await SubscriptionDAO.get_by_user_id(
        session, current_user.id
    )
    if subscription is None or not subscription.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active subscription required",
        )
    profile = await SubscriptionBillingProfileDAO.get_by_user_id(
        session, current_user.id
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Billing profile is not configured",
        )
    _validate_profile(profile)

    try:
        quote = build_subscription_quote(
            subscription,
            year=body.period_year,
            month=body.period_month,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    existing = await SubscriptionBillingDocumentDAO.get_by_receipt(
        session,
        current_user.id,
        quote.receipt_id,
    )

    storage_dir = _billing_storage_dir(current_user.id)
    invoice_path = storage_dir / f"{quote.receipt_id}-invoice.docx"
    act_path = storage_dir / f"{quote.receipt_id}-act.docx"
    write_billing_documents(
        quote=quote,
        service_recipient=profile,
        env_party=issuer_from_config(config),
        invoice_path=invoice_path,
        act_path=act_path,
    )

    document_fields = {
        "plan": quote.plan,
        "period_start": quote.period_start,
        "period_end": quote.period_end,
        "currency_code": quote.currency_code,
        "total_amount": quote.total_amount,
        "line_items": quote.line_items_dict(),
        "invoice_docx_path": str(invoice_path),
        "act_docx_path": str(act_path),
        "email_status": "pending",
        "sent_at": None,
        "recipient_email": None,
    }

    if existing is not None:
        document = await SubscriptionBillingDocumentDAO.update_fields(
            session,
            existing.id,
            **document_fields,
        )
        if document is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )
        logger.info(
            "Billing document regenerated",
            document_id=str(document.id),
            receipt_id=quote.receipt_id,
        )
    else:
        document = await SubscriptionBillingDocumentDAO.create(
            session,
            user_id=current_user.id,
            subscription_id=subscription.id,
            receipt_id=quote.receipt_id,
            **document_fields,
        )

    email_queued = False
    if body.send_email:
        recipient = current_user.contact_email or current_user.email
        send_billing_document_email.delay(str(document.id), recipient)  # type: ignore[attr-defined]
        email_queued = True
        logger.info(
            "Billing email queued",
            document_id=str(document.id),
            recipient=recipient,
        )

    return BillingGenerateResponse(
        document=_document_to_response(document),
        email_queued=email_queued,
    )


@router.get(
    "/documents/{document_id}/download",
    summary="Download generated billing DOCX",
)
async def download_billing_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    doc_type: Annotated[
        Literal["invoice", "act"],
        Query(alias="type", description="Document type to download"),
    ] = "invoice",
) -> FileResponse:
    row = await SubscriptionBillingDocumentDAO.get_for_user(
        session, current_user.id, document_id
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    stored_path = (
        row.invoice_docx_path if doc_type == "invoice" else row.act_docx_path
    )
    if not stored_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found",
        )
    path = Path(stored_path)
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file missing",
        )
    return FileResponse(
        path,
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ),
        filename=path.name,
    )
