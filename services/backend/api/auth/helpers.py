from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth.schemas import UserResponse
from backend.api.subscriptions.helpers import subscription_to_response
from backend.db.dao import SubscriptionDAO
from backend.db.models import User
from backend.utils.subscription_usage import SubscriptionUsageDAO


async def user_to_response(
    session: AsyncSession,
    user: User,
) -> UserResponse:
    subscription = await SubscriptionDAO.get_by_user_id(session, user.id)
    usage = None
    if subscription is not None:
        usage = await SubscriptionUsageDAO.get_for_user(session, user.id)
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_name=user.company_name,
        phone=user.phone,
        contact_email=user.contact_email,
        business_info=user.business_info,
        agree_terms=user.agree_terms,
        consent_revoked_at=user.consent_revoked_at,
        deleted_at=user.deleted_at,
        is_admin=user.is_admin,
        subscription=subscription_to_response(
            subscription,
            usage=usage,
        ),
    )
