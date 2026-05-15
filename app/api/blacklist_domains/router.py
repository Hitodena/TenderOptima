import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.blacklist_domains.schemas import BlacklistCreate, BlacklistRead
from app.api.deps import get_current_user, get_session
from app.db.dao import (
    BlacklistedDomainDAO,
)
from app.db.models import User

router = APIRouter(prefix="/blacklist", tags=["Blacklisted Domains"])


@router.get("/", response_model=list[BlacklistRead])
async def get_blacklist(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[BlacklistRead]:
    items = await BlacklistedDomainDAO.get_domains_set(
        session, current_user.id
    )
    return [BlacklistRead.model_validate(i) for i in items]


@router.post(
    "/", response_model=BlacklistRead, status_code=status.HTTP_201_CREATED
)
async def add_to_blacklist(
    body: BlacklistCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BlacklistRead:
    instance = await BlacklistedDomainDAO.create(
        session,
        domain=body.domain.lower().strip(),
        reason=body.reason,
        added_by_user_id=current_user.id,
    )
    return BlacklistRead.model_validate(instance)


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_blacklist(
    domain_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    deleted = await BlacklistedDomainDAO.delete(
        session, domain_id, current_user.id
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Domain not found"
        )
