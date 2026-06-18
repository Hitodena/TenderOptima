import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models.supplier_bookmark import (
    SupplierBookmarkItem,
    SupplierBookmarkList,
)


class SupplierBookmarkListDAO(BaseDAO[SupplierBookmarkList]):
    model = SupplierBookmarkList

    @classmethod
    async def list_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> list[SupplierBookmarkList]:
        stmt = (
            select(SupplierBookmarkList)
            .options(selectinload(SupplierBookmarkList.items))
            .where(
                or_(
                    SupplierBookmarkList.user_id == user_id,
                    SupplierBookmarkList.is_global.is_(True),
                )
            )
            .order_by(
                SupplierBookmarkList.is_global.desc(),
                SupplierBookmarkList.created_at.desc(),
            )
        )
        result = await session.execute(stmt)
        return list(result.scalars().unique().all())

    @classmethod
    async def get_by_id_for_user(
        cls,
        session: AsyncSession,
        list_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> SupplierBookmarkList | None:
        stmt = (
            select(SupplierBookmarkList)
            .options(selectinload(SupplierBookmarkList.items))
            .where(
                SupplierBookmarkList.id == list_id,
                or_(
                    SupplierBookmarkList.user_id == user_id,
                    SupplierBookmarkList.is_global.is_(True),
                ),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()


class SupplierBookmarkItemDAO(BaseDAO[SupplierBookmarkItem]):
    model = SupplierBookmarkItem

    @classmethod
    async def get_by_id_in_list(
        cls,
        session: AsyncSession,
        item_id: uuid.UUID,
        list_id: uuid.UUID,
    ) -> SupplierBookmarkItem | None:
        stmt = select(SupplierBookmarkItem).where(
            SupplierBookmarkItem.id == item_id,
            SupplierBookmarkItem.list_id == list_id,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()
