"""Subscription billing profile, document generation, and email delivery."""

import json
import secrets
import uuid
from pathlib import Path
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.billing.schemas import (
    BillingDocumentLineItem,
    BillingDocumentResponse,
    BillingGenerateRequest,
    BillingGenerateResponse,
    BillingProfileResponse,
    BillingProfileUpdate,
    PaymentCheckoutRequest,
    PaymentCheckoutResponse,
    PaymentStatusResponse,
)
from backend.api.deps import get_current_user, get_session
from backend.celery_app.tasks.billing_tasks import send_billing_document_email
from backend.core.config import get_config
from backend.db.dao import (
    SubscriptionBillingDocumentDAO,
    SubscriptionBillingProfileDAO,
    SubscriptionDAO,
    SubscriptionPaymentDAO,
)
from backend.db.models import User
from backend.db.models.subscription_billing import SubscriptionBillingProfile
from backend.enums import (
    SubscriptionPaymentMethod,
    SubscriptionPaymentStatus,
)
from backend.services.billing.bepaid import (
    BePaidError,
    amount_to_minor,
    create_checkout,
    extract_webhook_fields,
    map_webhook_status,
    verify_webhook_basic_auth,
    verify_webhook_signature,
)
from backend.services.billing.doc_generator import (
    issuer_from_config,
    write_billing_documents,
)
from backend.services.billing.extract_profile import (
    extract_billing_profile_fields,
)
from backend.services.billing.payment_activation import (
    activate_subscription_after_payment,
)
from backend.services.billing.subscription_lines import (
    build_subscription_quote,
)

router = APIRouter(prefix="/billing", tags=["Billing"])

config = get_config()
_webhook_basic = HTTPBasic(auto_error=False)

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
    summary="Generate invoice/act PDF for current subscription",
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
    invoice_path = storage_dir / f"{quote.receipt_id}-invoice.pdf"
    act_path = storage_dir / f"{quote.receipt_id}-act.pdf"
    try:
        write_billing_documents(
            quote=quote,
            service_recipient=profile,
            env_party=issuer_from_config(config),
            invoice_path=invoice_path,
            act_path=act_path,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

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


def _resolve_billing_pdf_path(stored_path: str) -> Path | None:
    """Return a PDF path for download, converting legacy DOCX on demand."""
    from backend.services.extraction.docx_to_pdf import (
        convert_docx_to_pdf_file,
    )

    path = Path(stored_path)
    if path.suffix.lower() == ".pdf" and path.is_file():
        return path
    if path.suffix.lower() == ".docx" and path.is_file():
        pdf_path = path.with_suffix(".pdf")
        if pdf_path.is_file():
            return pdf_path
        return convert_docx_to_pdf_file(path, pdf_path)
    # Stored path may already point at a missing PDF while DOCX still exists.
    docx_fallback = path.with_suffix(".docx")
    if docx_fallback.is_file():
        if path.suffix.lower() == ".pdf":
            return convert_docx_to_pdf_file(docx_fallback, path)
        return convert_docx_to_pdf_file(
            docx_fallback, docx_fallback.with_suffix(".pdf")
        )
    return None


@router.get(
    "/documents/{document_id}/download",
    summary="Download generated billing PDF",
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
    path = _resolve_billing_pdf_path(stored_path)
    if path is None or not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to prepare PDF document",
        )
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=path.with_suffix(".pdf").name,
    )


def _payment_to_status(row) -> PaymentStatusResponse:
    return PaymentStatusResponse(
        id=row.id,
        tracking_id=row.tracking_id,
        method=SubscriptionPaymentMethod(row.method),
        amount=row.amount,
        currency_code=row.currency_code,
        status=SubscriptionPaymentStatus(row.status),
        receipt_id=row.receipt_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.post(
    "/payments/checkout",
    response_model=PaymentCheckoutResponse,
    summary="Create bePaid checkout for current subscription",
)
async def create_payment_checkout(
    body: PaymentCheckoutRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PaymentCheckoutResponse:
    if not config.bepaid_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Online payments are not configured",
        )

    subscription = await SubscriptionDAO.get_by_user_id(
        session, current_user.id
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is required",
        )

    try:
        quote = build_subscription_quote(subscription)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    amount_minor = amount_to_minor(quote.total_amount)
    tracking_id = secrets.token_hex(12)
    payment = await SubscriptionPaymentDAO.create(
        session,
        user_id=current_user.id,
        subscription_id=subscription.id,
        tracking_id=tracking_id,
        method=body.method.value,
        amount=quote.total_amount,
        amount_minor=amount_minor,
        currency_code=quote.currency_code,
        status=SubscriptionPaymentStatus.PENDING.value,
        receipt_id=quote.receipt_id,
    )

    description = (
        f"Подписка TenderOptima {quote.plan_title} ({quote.receipt_id})"
    )
    customer_email = current_user.contact_email or current_user.email

    try:
        checkout = await create_checkout(
            config=config,
            method=body.method,
            amount_minor=amount_minor,
            currency_code=quote.currency_code,
            description=description,
            tracking_id=tracking_id,
            customer_email=customer_email,
            payment_id=str(payment.id),
        )
    except BePaidError as exc:
        await SubscriptionPaymentDAO.update_fields(
            session,
            payment.id,
            status=SubscriptionPaymentStatus.FAILED.value,
        )
        logger.warning(
            "bePaid checkout creation failed",
            payment_id=str(payment.id),
            error=str(exc),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create payment session",
        ) from exc

    payment = await SubscriptionPaymentDAO.update_fields(
        session,
        payment.id,
        bepaid_token=checkout.token,
        redirect_url=checkout.redirect_url,
    )
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    logger.info(
        "bePaid checkout created",
        payment_id=str(payment.id),
        method=body.method.value,
        amount_minor=amount_minor,
    )
    return PaymentCheckoutResponse(
        payment_id=payment.id,
        redirect_url=checkout.redirect_url,
        tracking_id=tracking_id,
        amount=quote.total_amount,
        currency_code=quote.currency_code,
        method=body.method,
    )


@router.get(
    "/payments/latest",
    response_model=PaymentStatusResponse | None,
    summary="Latest successful online payment for current user",
)
async def get_latest_successful_payment(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PaymentStatusResponse | None:
    row = await SubscriptionPaymentDAO.get_latest_successful_for_user(
        session, current_user.id
    )
    if row is None:
        return None
    return _payment_to_status(row)


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentStatusResponse,
    summary="Get online payment status for current user",
)
async def get_payment_status(
    payment_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PaymentStatusResponse:
    row = await SubscriptionPaymentDAO.get_for_user(
        session, current_user.id, payment_id
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )
    return _payment_to_status(row)


@router.post(
    "/payments/webhook",
    status_code=status.HTTP_200_OK,
    summary="bePaid payment notification webhook",
    include_in_schema=False,
)
async def bepaid_payment_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
    credentials: Annotated[
        HTTPBasicCredentials | None, Depends(_webhook_basic)
    ] = None,
    content_signature: Annotated[
        str | None, Header(alias="Content-Signature")
    ] = None,
) -> dict[str, str]:
    raw_body = await request.body()
    signature_ok = verify_webhook_signature(
        public_key=config.bepaid_shop_public_rsa_key,
        signature_header=content_signature,
        raw_body=raw_body,
    )
    basic_ok = verify_webhook_basic_auth(
        config=config,
        username=credentials.username if credentials else None,
        password=credentials.password if credentials else None,
    )
    if not signature_ok and not basic_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    try:
        payload = json.loads(raw_body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload",
        )

    fields = extract_webhook_fields(payload)
    tracking_id = fields.get("tracking_id")
    if not tracking_id or not isinstance(tracking_id, str):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tracking_id is required",
        )

    payment = await SubscriptionPaymentDAO.get_by_tracking_id(
        session, tracking_id
    )
    if payment is None:
        logger.warning(
            "bePaid webhook for unknown tracking_id",
            tracking_id=tracking_id,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Idempotent success — already applied.
    if payment.status == SubscriptionPaymentStatus.SUCCESSFUL.value:
        return {"status": "ok"}

    amount = fields.get("amount")
    currency = fields.get("currency")
    if amount is not None and int(amount) != payment.amount_minor:
        logger.warning(
            "bePaid webhook amount mismatch",
            tracking_id=tracking_id,
            expected=payment.amount_minor,
            got=amount,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount mismatch",
        )
    if (
        currency is not None
        and str(currency).upper() != payment.currency_code.upper()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Currency mismatch",
        )

    webhook_test = fields.get("test")
    if webhook_test is not None and bool(webhook_test) != config.bepaid_test:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test flag mismatch",
        )

    mapped = map_webhook_status(
        status=str(fields.get("status") or ""),
        expired=bool(fields.get("expired")),
    )
    if mapped is None:
        logger.info(
            "bePaid webhook ignored status",
            tracking_id=tracking_id,
            status=fields.get("status"),
        )
        await SubscriptionPaymentDAO.update_fields(
            session,
            payment.id,
            raw_notification=payload,
            bepaid_uid=fields.get("uid") or payment.bepaid_uid,
        )
        return {"status": "ok"}

    update_kwargs: dict = {
        "status": mapped,
        "raw_notification": payload,
    }
    if fields.get("uid"):
        update_kwargs["bepaid_uid"] = str(fields["uid"])

    updated = await SubscriptionPaymentDAO.update_fields(
        session, payment.id, **update_kwargs
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    if mapped == SubscriptionPaymentStatus.SUCCESSFUL.value:
        subscription = await SubscriptionDAO.get_by_user_id(
            session, payment.user_id
        )
        if subscription is None:
            logger.error(
                "Payment successful but subscription missing",
                payment_id=str(payment.id),
            )
        else:
            await activate_subscription_after_payment(
                session,
                user_id=payment.user_id,
                subscription=subscription,
            )

    logger.info(
        "bePaid webhook processed",
        tracking_id=tracking_id,
        status=mapped,
    )
    return {"status": "ok"}
