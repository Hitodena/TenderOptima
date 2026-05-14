from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.dao.user_dao import UserDAO
from app.services.db_service import db_manager
from app.utils.jwt_utils import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


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
