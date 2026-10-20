"""Admin queries for user management."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import Subscription, User
from backend.enums import SubscriptionPlan
from backend.utils.subscription_catalog import catalog_for_plan
from backend.utils.subscription_usage import (
    SubscriptionUsage,
    SubscriptionUsageDAO,
    pages_analysis_remaining_for_user,
)


class SubscriptionDAO(BaseDAO[Subscription]):
    model = Subscription

    @classmethod
    async def get_by_user_id(
        cls, session: AsyncSession, user_id: uuid.UUID
    ) -> Subscription | None:
        stmt = select(cls.model).where(cls.model.user_id == user_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def get_by_bepaid_subscription_id(
        cls,
        session: AsyncSession,
        bepaid_subscription_id: str,
    ) -> Subscription | None:
        stmt = select(cls.model).where(
            cls.model.bepaid_subscription_id == bepaid_subscription_id
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    async def upsert_for_user(
        cls,
        session: AsyncSession,
        user_id: uuid.UUID,
        **values,
    ) -> Subscription:
        existing = await cls.get_by_user_id(session, user_id)
        if existing is None:
            plan = values.get("plan", SubscriptionPlan.STARTER.value)
            catalog = catalog_for_plan(plan, values.get("geo_code", "BY"))
            defaults = {
                "user_id": user_id,
                "plan": plan,
                "module_1_enabled": values.get("module_1_enabled", True),
                "module_2_enabled": values.get("module_2_enabled", False),
                "max_searches_per_month": values.get(
                    "max_searches_per_month", catalog.max_searches_per_month
                ),
                "max_emails_per_month": values.get(
                    "max_emails_per_month", catalog.max_emails_per_month
                ),
                "max_kp_processed_per_month": values.get(
                    "max_kp_processed_per_month",
                    catalog.max_kp_processed_per_month,
                ),
                "max_pages_analyzed_per_month": values.get(
                    "max_pages_analyzed_per_month",
                    catalog.max_pages_analyzed_per_month,
                ),
                "geo_code": values.get("geo_code", "BY"),
                "currency_code": values.get("currency_code", "BYN"),
                "price_module_1_monthly": values.get(
                    "price_module_1_monthly", catalog.price_module_1_monthly
                ),
                "price_module_2_monthly": values.get(
                    "price_module_2_monthly", catalog.price_module_2_monthly
                ),
                "price_bundle_monthly": values.get(
                    "price_bundle_monthly", catalog.price_bundle_monthly
                ),
                "is_active": values.get("is_active", True),
                "starts_at": values.get("starts_at"),
                "expires_at": values.get("expires_at"),
            }
            defaults.update(values)
            return await cls.create(session, **defaults)

        if values:
            plan = values.get("plan", existing.plan)
            geo_code = values.get("geo_code", existing.geo_code)
            plan_changed = "plan" in values and values["plan"] != existing.plan
            geo_changed = (
                "geo_code" in values
                and values["geo_code"] != existing.geo_code
            )
            if plan_changed or geo_changed:
                catalog = catalog_for_plan(plan, geo_code)
                catalog_defaults = {
                    "max_searches_per_month": catalog.max_searches_per_month,
                    "max_emails_per_month": catalog.max_emails_per_month,
                    "max_kp_processed_per_month": (
                        catalog.max_kp_processed_per_month
                    ),
                    "max_pages_analyzed_per_month": (
                        catalog.max_pages_analyzed_per_month
                    ),
                    "price_module_1_monthly": catalog.price_module_1_monthly,
                    "price_module_2_monthly": catalog.price_module_2_monthly,
                    "price_bundle_monthly": catalog.price_bundle_monthly,
                }
                # Keep explicitly provided overrides from the admin payload.
                for key, value in catalog_defaults.items():
                    if key not in values:
                        values[key] = value

            updated = await cls.update_fields(session, existing.id, **values)
            if updated is None:
                raise ValueError(f"Subscription {existing.id} not found")
            return updated
        return existing


class UserAdminDAO:
    """Admin queries for user management."""

    @staticmethod
    async def list_users(session: AsyncSession) -> list[User]:
        stmt = (
            select(User)
            .options(
                selectinload(User.subscription),
                selectinload(User.mail_account),
            )
            .order_by(User.created_at.desc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_with_subscription(
        session: AsyncSession, user_id: uuid.UUID
    ) -> User | None:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.subscription),
                selectinload(User.mail_account),
            )
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def usage_snapshot(
        session: AsyncSession,
        user_id: uuid.UUID,
    ) -> tuple[SubscriptionUsage, int | None]:
        usage = await SubscriptionUsageDAO.get_for_user(session, user_id)
        remaining = await pages_analysis_remaining_for_user(session, user_id)
        return usage, remaining
