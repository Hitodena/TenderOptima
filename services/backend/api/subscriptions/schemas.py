import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from backend.enums import SubscriptionPlan
from pydantic import BaseModel, ConfigDict, Field


class SubscriptionResponse(BaseModel):
    """Resolved subscription view for the current user."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plan: SubscriptionPlan
    module_1_enabled: bool
    module_2_enabled: bool
    max_searches_per_month: int | None
    max_emails_per_month: int | None
    max_kp_processed_per_month: int | None
    max_pages_analyzed_per_month: int | None
    max_tz_kp_upload_bytes: int | None
    geo_code: str
    currency_code: str
    price_module_1_monthly: Decimal | None
    price_module_2_monthly: Decimal | None
    price_bundle_monthly: Decimal | None
    is_active: bool
    expires_at: datetime | None = None
    searches_used_this_month: int = 0
    emails_sent_this_month: int = 0
    kp_processed_this_month: int = 0
    pages_analyzed_this_month: int = 0
    pages_analysis_remaining: int | None = None


class SubscriptionUpdate(BaseModel):
    """Admin payload for updating a user subscription."""

    model_config = ConfigDict(str_strip_whitespace=True)

    plan: Annotated[SubscriptionPlan | None, Field(default=None)] = None
    module_1_enabled: bool | None = None
    module_2_enabled: bool | None = None
    max_searches_per_month: int | None = None
    max_emails_per_month: int | None = None
    max_kp_processed_per_month: int | None = None
    max_pages_analyzed_per_month: int | None = None
    geo_code: str | None = None
    currency_code: str | None = None
    price_module_1_monthly: Decimal | None = None
    price_module_2_monthly: Decimal | None = None
    price_bundle_monthly: Decimal | None = None
    is_active: bool | None = None
    expires_at: datetime | None = None
