"""API endpoints for centralized, verified SMTP/IMAP mail accounts."""

import asyncio
import time
import uuid
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_admin, get_current_user, get_session
from backend.db.dao import MailAccountDAO, MailAccountDuplicateError
from backend.db.models import MailAccount, User
from backend.enums import MailAccountSource
from backend.schemas.mail_account import (
    MailAccountAssignmentUpdate,
    MailAccountBulkVerificationResponse,
    MailAccountCreate,
    MailAccountResponse,
    MailAccountUpdate,
    MailAccountVerificationResponse,
    MyMailAccountResponse,
)
from backend.services.mail_account_verification import (
    MailAccountVerification,
    verify_new_mail_account,
    verify_saved_mail_account,
    verify_updated_mail_account,
)

admin_router = APIRouter(prefix="/admin/mail-accounts", tags=["Mail accounts"])
auth_router = APIRouter(prefix="/auth/me/mail-account", tags=["Mail accounts"])

_bulk_verification_lock = asyncio.Lock()
_account_verification_locks: defaultdict[uuid.UUID, asyncio.Lock] = (
    defaultdict(asyncio.Lock)
)


def _account_response(account: MailAccount) -> MailAccountResponse:
    """Serialize mailbox metadata while excluding all credentials."""
    state = inspect(account)
    creator = (
        None
        if "created_by_user" in state.unloaded
        else account.created_by_user
    )
    return MailAccountResponse(
        id=account.id,
        email=account.email,
        source=MailAccountSource(account.source),
        created_by_user_id=account.created_by_user_id,
        created_by_user_email=creator.email if creator else None,
        smtp_host=account.smtp_host,
        smtp_port=account.smtp_port,
        imap_host=account.imap_host,
        imap_port=account.imap_port,
        smtp_available=account.smtp_available,
        imap_available=account.imap_available,
        availability=account.availability,
        last_checked_at=account.last_checked_at,
        last_error=account.last_error,
        created_at=account.created_at,
        assigned_user_count=(
            0
            if "assigned_users" in state.unloaded
            else len(account.assigned_users)
        ),
    )


def _verification_response(
    account: MailAccount,
) -> MailAccountVerificationResponse:
    return MailAccountVerificationResponse(
        mail_account_id=account.id,
        smtp_available=account.smtp_available,
        imap_available=account.imap_available,
        availability=account.availability,
        last_checked_at=account.last_checked_at,
        last_error=account.last_error,
    )


async def _verify_saved_and_persist(
    session: AsyncSession,
    account: MailAccount,
) -> MailAccount:
    """Serialize checks per account and persist each result independently."""
    lock = _account_verification_locks[account.id]
    async with lock:
        result = await asyncio.to_thread(verify_saved_mail_account, account)
        return await MailAccountDAO.update_verification(
            session,
            account,
            smtp_available=result.smtp_available,
            imap_available=result.imap_available,
            last_error=result.last_error,
        )


async def _create_account(
    *,
    payload: MailAccountCreate,
    source: MailAccountSource,
    creator_id: uuid.UUID | None,
    session: AsyncSession,
) -> MailAccountResponse:
    existing = await MailAccountDAO.get_by_email(session, str(payload.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mail account with this email already exists",
        )

    result = await asyncio.to_thread(verify_new_mail_account, payload)
    if not result.availability:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": (
                    "SMTP/IMAP verification failed; account was not saved "
                    f"(SMTP: {'OK' if result.smtp_available else 'failed'}, "
                    f"IMAP: {'OK' if result.imap_available else 'failed'})"
                ),
                "smtp_available": result.smtp_available,
                "imap_available": result.imap_available,
            },
        )

    try:
        account = await MailAccountDAO.create_mail_account(
            session,
            email=str(payload.email),
            source=source,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
            password=payload.password,
            created_by_user_id=creator_id,
            smtp_available=result.smtp_available,
            imap_available=result.imap_available,
            last_error=result.last_error,
        )
    except MailAccountDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mail account with this email already exists",
        ) from exc
    return _account_response(account)


@auth_router.get("", response_model=MyMailAccountResponse)
async def get_my_mail_account(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MyMailAccountResponse:
    """Return the current assignment without exposing mail credentials."""
    account = None
    if current_user.mail_account_id:
        account = await MailAccountDAO.get_with_relations(
            session, current_user.mail_account_id
        )
    return MyMailAccountResponse(
        account=_account_response(account) if account else None,
        current_sender_email=account.email if account else None,
    )


@auth_router.post("", response_model=MailAccountResponse, status_code=201)
async def create_my_custom_mail_account(
    payload: MailAccountCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> MailAccountResponse:
    """Verify, create, and assign a user-owned custom mailbox."""
    account = await _create_account(
        payload=payload,
        source=MailAccountSource.CUSTOM,
        creator_id=current_user.id,
        session=session,
    )
    await MailAccountDAO.assign_custom_account_to_owner(
        session,
        user=current_user,
        account_id=account.id,
    )
    return account


@admin_router.get("", response_model=list[MailAccountResponse])
async def list_mail_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[MailAccountResponse]:
    accounts = await MailAccountDAO.list_all(session)
    return [_account_response(account) for account in accounts]


@admin_router.get("/assignable", response_model=list[MailAccountResponse])
async def list_assignable_mail_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> list[MailAccountResponse]:
    """Return only admin-origin mailboxes for user assignment dropdowns."""
    accounts = await MailAccountDAO.list_assignable_admin(session)
    return [_account_response(account) for account in accounts]


@admin_router.post("", response_model=MailAccountResponse, status_code=201)
async def create_admin_mail_account(
    payload: MailAccountCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> MailAccountResponse:
    """Verify before creating a reusable administrative mailbox."""
    return await _create_account(
        payload=payload,
        source=MailAccountSource.ADMIN,
        creator_id=None,
        session=session,
    )


@admin_router.put("/{account_id}", response_model=MailAccountResponse)
async def update_admin_mail_account(
    account_id: uuid.UUID,
    payload: MailAccountUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> MailAccountResponse:
    """Edit a reusable admin mailbox after verifying the submitted settings."""
    account = await MailAccountDAO.get_with_relations(session, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Mail account not found")
    if account.source != MailAccountSource.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrative mail accounts can be edited here",
        )

    existing = await MailAccountDAO.get_by_email(session, str(payload.email))
    if existing is not None and existing.id != account.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mail account with this email already exists",
        )

    result = await asyncio.to_thread(
        verify_updated_mail_account, account, payload
    )
    if not result.availability:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": (
                    "SMTP/IMAP verification failed; account was not updated "
                    f"(SMTP: {'OK' if result.smtp_available else 'failed'}, "
                    f"IMAP: {'OK' if result.imap_available else 'failed'})"
                ),
                "smtp_available": result.smtp_available,
                "imap_available": result.imap_available,
            },
        )

    try:
        updated = await MailAccountDAO.update_admin_mail_account(
            session,
            account,
            payload=payload,
            smtp_available=result.smtp_available,
            imap_available=result.imap_available,
            last_error=result.last_error,
        )
    except MailAccountDuplicateError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mail account with this email already exists",
        ) from exc
    return _account_response(updated)


@admin_router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mail_account(
    account_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> None:
    """Delete a mailbox; user assignments are cleared and message history kept."""
    deleted = await MailAccountDAO.delete_mail_account(session, account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Mail account not found")


@admin_router.post(
    "/{account_id}/verify",
    response_model=MailAccountVerificationResponse,
)
async def verify_mail_account(
    account_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> MailAccountVerificationResponse:
    account = await MailAccountDAO.get_by_id(session, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Mail account not found")
    updated = await _verify_saved_and_persist(session, account)
    return _verification_response(updated)


@admin_router.post(
    "/verify-all",
    response_model=MailAccountBulkVerificationResponse,
)
async def verify_all_mail_accounts(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> MailAccountBulkVerificationResponse:
    """Verify all mailboxes serially with a backend-enforced one-second cadence."""
    if _bulk_verification_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A bulk mail-account verification is already running",
        )

    async with _bulk_verification_lock:
        accounts = await MailAccountDAO.list_all(session)
        results: list[MailAccountVerificationResponse] = []
        previous_started_at: float | None = None
        for account in accounts:
            if previous_started_at is not None:
                delay = 1 - (time.monotonic() - previous_started_at)
                if delay > 0:
                    await asyncio.sleep(delay)
            previous_started_at = time.monotonic()
            try:
                updated = await _verify_saved_and_persist(session, account)
            except Exception:
                result = MailAccountVerification(
                    smtp_available=False,
                    imap_available=False,
                    last_error="Mail account verification failed",
                )
                updated = await MailAccountDAO.update_verification(
                    session,
                    account,
                    smtp_available=result.smtp_available,
                    imap_available=result.imap_available,
                    last_error=result.last_error,
                )
            results.append(_verification_response(updated))
    return MailAccountBulkVerificationResponse(items=results)


@admin_router.patch("/users/{user_id}", response_model=MyMailAccountResponse)
async def assign_user_mail_account(
    user_id: uuid.UUID,
    payload: MailAccountAssignmentUpdate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[User, Depends(get_admin)],
) -> MyMailAccountResponse:
    """Assign only an admin account or explicitly clear an assignment."""
    try:
        user = await MailAccountDAO.assign_admin_account(
            session,
            user_id=user_id,
            account_id=payload.mail_account_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Custom mail accounts cannot be assigned to other users",
        ) from exc
    account = None
    if user.mail_account_id:
        account = await MailAccountDAO.get_with_relations(
            session, user.mail_account_id
        )
    return MyMailAccountResponse(
        account=_account_response(account) if account else None,
        current_sender_email=account.email if account else None,
    )
