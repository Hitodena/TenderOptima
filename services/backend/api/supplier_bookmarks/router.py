import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_session
from backend.api.supplier_bookmarks.schemas import (
    SupplierBookmarkItemCreate,
    SupplierBookmarkItemResponse,
    SupplierBookmarkItemUpdate,
    SupplierBookmarkListCreate,
    SupplierBookmarkListResponse,
    SupplierBookmarkListUpdate,
)
from backend.db.dao import SupplierBookmarkItemDAO, SupplierBookmarkListDAO
from backend.db.models import User
from backend.db.models.supplier_bookmark import SupplierBookmarkList

router = APIRouter(prefix="/supplier-bookmarks", tags=["Supplier Bookmarks"])


def _can_modify_list(bookmark_list: SupplierBookmarkList, user: User) -> bool:
    if bookmark_list.is_global:
        return user.is_admin
    return bookmark_list.user_id == user.id


def _list_response(
    bookmark_list: SupplierBookmarkList,
) -> SupplierBookmarkListResponse:
    return SupplierBookmarkListResponse.model_validate(bookmark_list)


@router.get(
    "/",
    response_model=list[SupplierBookmarkListResponse],
    summary="List supplier bookmark collections available to the current user",
)
async def list_supplier_bookmarks(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[SupplierBookmarkListResponse]:
    items = await SupplierBookmarkListDAO.list_for_user(
        session, current_user.id
    )
    return [_list_response(item) for item in items]


@router.post(
    "/",
    response_model=SupplierBookmarkListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a supplier bookmark collection",
)
async def create_supplier_bookmark_list(
    body: SupplierBookmarkListCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierBookmarkListResponse:
    if body.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create global supplier bookmark lists",
        )

    instance = await SupplierBookmarkListDAO.create(
        session,
        user_id=None if body.is_global else current_user.id,
        title=body.title.strip(),
        is_global=body.is_global,
    )
    reloaded = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, instance.id, current_user.id
    )
    if reloaded is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load created bookmark list",
        )
    return _list_response(reloaded)


@router.patch(
    "/{list_id}",
    response_model=SupplierBookmarkListResponse,
    summary="Update a supplier bookmark collection",
)
async def update_supplier_bookmark_list(
    list_id: uuid.UUID,
    body: SupplierBookmarkListUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierBookmarkListResponse:
    bookmark_list = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    if not _can_modify_list(bookmark_list, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this bookmark list",
        )

    values = body.model_dump(exclude_unset=True)
    if not values:
        return _list_response(bookmark_list)

    await SupplierBookmarkListDAO.update_fields(session, list_id, **values)
    reloaded = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if reloaded is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    return _list_response(reloaded)


@router.delete(
    "/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a supplier bookmark collection",
)
async def delete_supplier_bookmark_list(
    list_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    bookmark_list = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    if not _can_modify_list(bookmark_list, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this bookmark list",
        )
    await SupplierBookmarkListDAO.delete(session, list_id)


@router.post(
    "/{list_id}/items",
    response_model=SupplierBookmarkItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a supplier to a bookmark collection",
)
async def create_supplier_bookmark_item(
    list_id: uuid.UUID,
    body: SupplierBookmarkItemCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierBookmarkItemResponse:
    bookmark_list = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    if not _can_modify_list(bookmark_list, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this bookmark list",
        )

    normalized_domain = body.domain.lower().strip() if body.domain else None
    normalized_phone = body.phone.strip() if body.phone else None
    instance = await SupplierBookmarkItemDAO.create(
        session,
        list_id=list_id,
        company_name=body.company_name.strip(),
        email=str(body.email).lower().strip(),
        domain=normalized_domain,
        phone=normalized_phone,
        notes=body.notes,
    )
    return SupplierBookmarkItemResponse.model_validate(instance)


@router.patch(
    "/{list_id}/items/{item_id}",
    response_model=SupplierBookmarkItemResponse,
    summary="Update a supplier inside a bookmark collection",
)
async def update_supplier_bookmark_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    body: SupplierBookmarkItemUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> SupplierBookmarkItemResponse:
    bookmark_list = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    if not _can_modify_list(bookmark_list, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this bookmark list",
        )

    item = await SupplierBookmarkItemDAO.get_by_id_in_list(
        session, item_id, list_id
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark item not found",
        )

    values = body.model_dump(exclude_unset=True)
    if "email" in values and values["email"]:
        values["email"] = str(values["email"]).lower().strip()
    if "domain" in values and values["domain"]:
        values["domain"] = values["domain"].lower().strip()
    if "phone" in values and values["phone"]:
        values["phone"] = values["phone"].strip()

    if not values:
        return SupplierBookmarkItemResponse.model_validate(item)

    updated = await SupplierBookmarkItemDAO.update_fields(
        session, item_id, **values
    )
    return SupplierBookmarkItemResponse.model_validate(updated)


@router.delete(
    "/{list_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a supplier from a bookmark collection",
)
async def delete_supplier_bookmark_item(
    list_id: uuid.UUID,
    item_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    bookmark_list = await SupplierBookmarkListDAO.get_by_id_for_user(
        session, list_id, current_user.id
    )
    if not bookmark_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark list not found",
        )
    if not _can_modify_list(bookmark_list, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this bookmark list",
        )

    item = await SupplierBookmarkItemDAO.get_by_id_in_list(
        session, item_id, list_id
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bookmark item not found",
        )
    await SupplierBookmarkItemDAO.delete(session, item_id)
