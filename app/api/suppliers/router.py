from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.api.suppliers.schemas import SupplierCreate, SupplierResponse
from app.db.dao import RequestDAO, RequestSupplierDAO, SupplierDAO
from app.db.models import User
from app.enums import RequestSupplierStatus

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post(
    "/",
    response_model=SupplierResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manually create/register a new supplier (optionally attach to a request)",  # noqa: E501
    responses={
        200: {
            "description": "Existing supplier reused and attached to the provided request"  # noqa: E501
        },
        201: {
            "description": "New supplier created (and attached to request if request_id provided)"  # noqa: E501
        },
        401: {"description": "Missing or invalid authentication credentials"},
        404: {
            "description": "Request not found or does not belong to current user"  # noqa: E501
        },
        409: {
            "description": "Supplier with this domain already exists (when called without request_id)"  # noqa: E501
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

    existing = await SupplierDAO.get_by_domain(session, normalized_domain)
    is_new = False
    if existing:
        supplier = existing
    else:
        supplier = await SupplierDAO.create(
            session,
            domain=normalized_domain,
            company_name=body.company_name,
            email=normalized_email,
            from_source=body.source,
            added_by_user_id=current_user.id,
        )
        is_new = True

    if body.request_id is not None:
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
                status=RequestSupplierStatus.PENDING,
            )

    if not is_new and body.request_id is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supplier with this domain already exists",
        )

    return SupplierResponse.model_validate(supplier)
