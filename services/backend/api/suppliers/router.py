import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_request_or_404, get_session
from backend.api.subscriptions.enforcement import ensure_module_1_access
from backend.api.suppliers.schemas import (
    BulkToggleSuppliersRequest,
    BulkToggleSuppliersResponse,
    RequestSupplierResponse,
    SupplierCreate,
    SupplierMainEmailUpdate,
    SupplierRemoveResponse,
    SupplierResponse,
)
from backend.db.dao import RequestDAO, RequestSupplierDAO, SupplierDAO
from backend.db.models import User
from backend.enums import RequestSupplierStatus

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])
request_suppliers_router = APIRouter(prefix="/requests", tags=["Suppliers"])


@router.post(
    "/",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create/register a new supplier (optionally attach to a request)",
    responses={
        200: {
            "description": "Existing supplier reused and attached to the provided request"
        },
        201: {
            "description": "New supplier created (and attached to request if request_id provided)"
        },
        401: {"description": "Missing or invalid authentication credentials"},
        404: {
            "description": "Request not found or does not belong to current user"
        },
        409: {
            "description": "Supplier with this domain already exists (when called without request_id)"
        },
        422: {"description": "Validation error in request payload"},
    },
)
async def create_supplier(
    body: SupplierCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierResponse:
    """Creates a new supplier (or reuses existing domain).

    If request_id provided: attach by creating RequestSupplier (pending).
    Dup domain: 409 only if no request_id (preserves explicit create).
    With request_id, existing suppliers are reused+attached for the
    frontend "add to current request" flow.
    """
    normalized_domain = body.domain.lower().strip() if body.domain else None
    normalized_email = body.email.lower().strip()
    extra_emails: list[str] | None = None
    if body.extra_emails:
        extra_emails = [
            email.lower().strip()
            for email in body.extra_emails
            if email and email.lower().strip() != normalized_email
        ]
        extra_emails = extra_emails or None

    existing = await SupplierDAO.get_by_domain(session, normalized_domain)
    is_new = False
    if existing:
        supplier = existing
    else:
        supplier = await SupplierDAO.create(
            session,
            domain=normalized_domain,
            company_name=body.company_name,
            main_email=normalized_email,
            extra_emails=extra_emails,
            phone=body.phone.strip() if body.phone else None,
            from_source=body.source,
            added_by_user_id=current_user.id,
        )
        is_new = True

    if body.request_id is not None:
        await ensure_module_1_access(session, current_user)
        request = await RequestDAO.get_by_id(session, body.request_id)
        if not request or request.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Request not found or does not belong to you",
            )

        existing_rs = await RequestSupplierDAO.get_by_request_and_supplier(
            session, request_id=body.request_id, supplier_id=supplier.id
        )
        if not existing_rs:
            await RequestSupplierDAO.create(
                session,
                request_id=body.request_id,
                supplier_id=supplier.id,
                sent_to_email=normalized_email,
                sent_status=RequestSupplierStatus.PENDING,
                is_enabled=body.is_enabled,
            )

    if not is_new and body.request_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supplier with this domain already exists",
        )

    return SupplierResponse.model_validate(supplier)


@router.patch(
    "/{supplier_id}/email",
    response_model=SupplierResponse,
    summary="Update supplier's main email",
    responses={
        200: {"description": "Main email updated successfully"},
        400: {"description": "Email not found in supplier's email list"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {"description": "Supplier not found"},
        422: {"description": "Validation error in request payload"},
    },
)
async def update_supplier_main_email(
    supplier_id: uuid.UUID,
    body: SupplierMainEmailUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierResponse:
    """Updates the supplier's main email address.

    The new main_email must exist in either the current main_email or extra_emails
    to prevent adding arbitrary emails outside the parsed list.
    """
    supplier = await SupplierDAO.get_by_id(session, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found",
        )

    if supplier.added_by_user and supplier.added_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found or does not added by you",
        )

    normalized_email = body.main_email.lower().strip()
    all_emails = [supplier.main_email.lower()] + [
        e.lower() for e in (supplier.extra_emails or [])
    ]

    if normalized_email not in all_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not found in supplier's email list",
        )

    updated = await SupplierDAO.update_fields(
        session, supplier_id, main_email=normalized_email
    )
    return SupplierResponse.model_validate(updated)


@request_suppliers_router.get(
    "/{request_id}/suppliers",
    response_model=list[RequestSupplierResponse],
    summary="List suppliers for a request",
)
async def list_request_suppliers(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[RequestSupplierResponse]:
    """List request-supplier links for an owned request with nested supplier data."""
    await get_request_or_404(request_id, session, current_user)
    suppliers = await RequestSupplierDAO.get_by_request(session, request_id)
    return [
        RequestSupplierResponse(
            id=rs.id,
            supplier=SupplierResponse.model_validate(rs.supplier),
            sent_status=RequestSupplierStatus(rs.sent_status),
            is_enabled=rs.is_enabled,
            sent_at=rs.sent_at,
        )
        for rs in suppliers
    ]


@request_suppliers_router.patch(
    "/{request_id}/suppliers/enabled",
    response_model=BulkToggleSuppliersResponse,
    summary="Bulk toggle supplier enabled status for a request",
)
async def toggle_suppliers_bulk(
    request_id: uuid.UUID,
    body: BulkToggleSuppliersRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BulkToggleSuppliersResponse:
    """Enable or disable multiple request-supplier rows in one transaction."""
    await get_request_or_404(request_id, session, current_user)
    await ensure_module_1_access(session, current_user)
    updated = await RequestSupplierDAO.set_enabled_bulk(
        session, request_id, body.ids, body.is_enabled
    )
    if updated == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No matching request suppliers found",
        )
    return BulkToggleSuppliersResponse(updated=updated)


@request_suppliers_router.delete(
    "/{request_id}/suppliers/{request_supplier_id}",
    response_model=SupplierRemoveResponse,
    summary="Remove a supplier from a request",
)
async def remove_supplier_from_request(
    request_id: uuid.UUID,
    request_supplier_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierRemoveResponse:
    """Remove a supplier link from the request without deleting the supplier row."""
    await get_request_or_404(request_id, session, current_user)
    rs = await RequestSupplierDAO.get_by_id(session, request_supplier_id)
    if not rs or rs.request_id != request_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier link not found",
        )
    deleted = await RequestSupplierDAO.delete(session, request_supplier_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier link not found",
        )
    return SupplierRemoveResponse(id=request_supplier_id)
