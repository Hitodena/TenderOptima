import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_admin, get_current_user, get_session
from backend.api.news.schemas import (
    AdminNewsResponse,
    NewsCreate,
    NewsReadAcknowledgement,
    NewsResponse,
    NewsUpdate,
)
from backend.db.models import News, NewsRead, User

admin_router = APIRouter(prefix="/admin/news", tags=["Admin news"])
user_router = APIRouter(prefix="/news", tags=["News"])


@admin_router.get("", response_model=list[AdminNewsResponse])
async def list_news_for_admin(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[AdminNewsResponse]:
    """List active and archived announcements with acknowledgement counts."""
    statement = (
        select(News, func.count(NewsRead.user_id).label("read_count"))
        .outerjoin(NewsRead, NewsRead.news_id == News.id)
        .group_by(News.id)
        .order_by(News.created_at.desc())
    )
    rows = (await session.execute(statement)).all()
    return [
        AdminNewsResponse(
            **NewsResponse.model_validate(news).model_dump(),
            read_count=read_count,
        )
        for news, read_count in rows
    ]


@admin_router.post(
    "",
    response_model=NewsResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_news(
    body: NewsCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    admin: Annotated[User, Depends(get_admin)],
) -> NewsResponse:
    """Publish an announcement immediately to all users."""
    news = News(
        title=body.title,
        content=body.content,
        module_name=body.module_name or None,
        severity=body.severity,
        is_active=True,
        created_by_admin_id=admin.id,
    )
    session.add(news)
    await session.commit()
    await session.refresh(news)
    return NewsResponse.model_validate(news)


@admin_router.patch("/{news_id}", response_model=NewsResponse)
async def update_news(
    news_id: uuid.UUID,
    body: NewsUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> NewsResponse:
    """Edit an announcement or deactivate/reactivate it."""
    news = await session.get(News, news_id)
    if news is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found",
        )

    changes = body.model_dump(exclude_unset=True)
    if "module_name" in changes:
        module_name = changes["module_name"]
        news.module_name = module_name or None
    for field in ("title", "content", "severity", "is_active"):
        value = changes.get(field)
        if value is not None:
            setattr(news, field, value)

    await session.commit()
    await session.refresh(news)
    return NewsResponse.model_validate(news)


@user_router.get("/unread", response_model=list[NewsResponse])
async def list_unread_news(
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> list[NewsResponse]:
    """Return active announcements not yet acknowledged by this user."""
    statement = (
        select(News)
        .outerjoin(
            NewsRead,
            (NewsRead.news_id == News.id) & (NewsRead.user_id == user.id),
        )
        .where(News.is_active.is_(True), NewsRead.user_id.is_(None))
        .order_by(News.created_at.desc())
    )
    rows = (await session.scalars(statement)).all()
    return [NewsResponse.model_validate(news) for news in rows]


@user_router.post(
    "/{news_id}/read",
    response_model=NewsReadAcknowledgement,
)
async def acknowledge_news(
    news_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> NewsReadAcknowledgement:
    """Persist an idempotent read receipt for the authenticated user."""
    news = await session.scalar(
        select(News.id).where(
            News.id == news_id,
            News.is_active.is_(True),
        )
    )
    if news is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News not found",
        )

    receipt = await session.get(NewsRead, (news_id, user.id))
    if receipt is None:
        session.add(NewsRead(news_id=news_id, user_id=user.id))
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            # A concurrent acknowledgement may have inserted the same key.
            receipt = await session.get(NewsRead, (news_id, user.id))
            if receipt is None:
                raise

    return NewsReadAcknowledgement()
