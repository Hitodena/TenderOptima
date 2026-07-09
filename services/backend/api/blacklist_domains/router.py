import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.blacklist_domains.schemas import (
    BlacklistCreate,
    BlacklistResponse,
)
from backend.api.deps import get_current_user, get_session
from backend.db.dao import BlacklistedDomainDAO
from backend.db.models import User

router = APIRouter(prefix="/blacklist", tags=["Blacklisted Domains"])


@router.get(
    "/",
    response_model=list[BlacklistResponse],
    summary="List all blacklisted domains for the current user",
    responses={
        200: {
            "description": "List of blacklisted domains belonging to the authenticated user"  # noqa: E501
        },
        401: {"description": "Missing or invalid authentication credentials"},
    },
)
async def get_blacklist(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[BlacklistResponse]:
    """
    Returns user-specific and global blacklisted domains visible to the user.
    """
    items = await BlacklistedDomainDAO.get_domains_set(
        session, current_user.id
    )
    return [BlacklistResponse.model_validate(i) for i in items]


@router.post(
    "/",
    response_model=BlacklistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new domain to the blacklist",
    responses={
        201: {"description": "Domain successfully added to the blacklist"},
        401: {"description": "Missing or invalid authentication credentials"},
        403: {
            "description": "Only admins can create global blacklist entries"
        },
        422: {"description": "Validation error in request payload"},
    },
)
async def add_to_blacklist(
    body: BlacklistCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BlacklistResponse:
    """
    Adds a domain to the blacklist.
    Global entries require admin privileges.
    """
    if body.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create global blacklist entries",
        )

    instance = await BlacklistedDomainDAO.create(
        session,
        domain=body.domain.lower().strip(),
        reason=body.reason,
        is_global=body.is_global,
        added_by_user_id=current_user.id,
    )
    return BlacklistResponse.model_validate(instance)


@router.delete(
    "/{domain_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a domain from the blacklist",
    responses={
        204: {"description": "Domain successfully removed from the blacklist"},
        401: {"description": "Missing or invalid authentication credentials"},
        404: {
            "description": "Domain not found or not allowed for the current user"  # noqa: E501
        },
    },
)
async def remove_from_blacklist(
    domain_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """
    Deletes a blacklist entry owned by the user or a global entry when admin.
    """
    deleted = await BlacklistedDomainDAO.delete_by_id(
        session,
        domain_id,
        current_user.id,
        is_admin=current_user.is_admin,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found"
        )
