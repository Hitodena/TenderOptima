from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_session
from app.db.dao import UserDAO
from app.db.models import User
from app.utils.jwt_utils import create_access_token
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    company_name: str | None = None


@router.post("/register")
async def register(
    request: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
):
    existing_user = await UserDAO.get_by_email(session, request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    hashed_password = hash_password(request.password)
    user = await UserDAO.create(
        session,
        email=request.email,
        hashed_password=hashed_password,
        full_name=request.full_name,
        company_name=request.company_name,
    )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/token")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[AsyncSession, Depends(get_session)],
):
    user = await UserDAO.get_by_email(session, form_data.username)
    if not user or not verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def get_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return {"email": current_user.email, "full_name": current_user.full_name}
