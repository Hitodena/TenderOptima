import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import Config, get_config
from backend.db.dao import RequestDAO
from backend.db.dao.user_dao import UserDAO
from backend.db.models import Request, User
from backend.services.db_service import db_manager
from backend.utils.jwt_utils import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token", auto_error=False
)


async def get_session() -> AsyncGenerator[AsyncSession]:
    """Get session from DatabaseSessionManager"""
    async with db_manager.session() as session:
        yield session


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str, Depends(oauth2_scheme)],
):
    """Extract and validate the current user from JWT token."""
    payload = decode_access_token(token)
    email: str | None = payload.get("sub")

    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await UserDAO.get_by_email(session, email)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return user


def get_config_instance() -> Config:
    """Get config instance"""
    return get_config()


async def get_request_or_404(
    request_id: uuid.UUID,
    session: AsyncSession,
    current_user: User,
) -> Request:
    """Load request owned by current user or raise 404."""
    request = await RequestDAO.get_by_id(session, request_id)
    if not request or request.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )
    return request


async def get_current_user_optional(
    session: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
) -> User | None:
    """Return the current user from JWT or None if missing/invalid."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        email: str | None = payload.get("sub")
        if not email:
            return None
        return await UserDAO.get_by_email(session, email)
    except Exception:
        return None


async def get_admin(user: Annotated[User, Depends(get_current_user)]):
    """Check if current user is admin"""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Required admin status",
        )

    return user
