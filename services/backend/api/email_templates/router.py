import uuid
from typing import Annotated

from backend.api.deps import get_current_user, get_session
from backend.api.email_templates.schemas import (
    EmailTemplateCreate,
    EmailTemplateResponse,
    EmailTemplateUpdate,
)
from backend.db.dao import EmailTemplateDAO
from backend.db.models import User
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/email-templates", tags=["Email Templates"])


def _can_modify(template, user: User) -> bool:
    if template.is_global:
        return user.is_admin
    return template.user_id == user.id


@router.get(
    "/",
    response_model=list[EmailTemplateResponse],
    summary="List email templates available to the current user",
)
async def list_email_templates(
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EmailTemplateResponse]:
    items = await EmailTemplateDAO.list_for_user(session, current_user.id)
    return [EmailTemplateResponse.model_validate(item) for item in items]


@router.post(
    "/",
    response_model=EmailTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an email template",
)
async def create_email_template(
    body: EmailTemplateCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmailTemplateResponse:
    if body.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create global templates",
        )

    instance = await EmailTemplateDAO.create(
        session,
        user_id=None if body.is_global else current_user.id,
        title=body.title.strip(),
        subject=body.subject.strip(),
        body=body.body.strip(),
        is_global=body.is_global,
    )
    return EmailTemplateResponse.model_validate(instance)


@router.patch(
    "/{template_id}",
    response_model=EmailTemplateResponse,
    summary="Update an email template",
)
async def update_email_template(
    template_id: uuid.UUID,
    body: EmailTemplateUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmailTemplateResponse:
    template = await EmailTemplateDAO.get_by_id(session, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    if not _can_modify(template, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to modify this template",
        )

    values = body.model_dump(exclude_unset=True)
    if not values:
        return EmailTemplateResponse.model_validate(template)

    updated = await EmailTemplateDAO.update_fields(
        session, template_id, **values
    )
    return EmailTemplateResponse.model_validate(updated)


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an email template",
)
async def delete_email_template(
    template_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    template = await EmailTemplateDAO.get_by_id(session, template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )
    if not _can_modify(template, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this template",
        )
    await EmailTemplateDAO.delete(session, template_id)
