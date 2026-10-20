"""Data access for centralized mail accounts."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.dao.base_dao import BaseDAO
from backend.db.models import MailAccount, User
from backend.enums import MailAccountSource
from backend.utils.secret_encryption import store_secret


class MailAccountDuplicateError(ValueError):
    """A mailbox with the requested canonical email already exists."""


class MailAccountDAO(BaseDAO[MailAccount]):
    """Centralized mailbox persistence that never logs plaintext secrets."""

    model = MailAccount

    @staticmethod
    def normalize_email(email: str) -> str:
        return email.strip().lower()

    @classmethod
    async def get_by_email(
        cls, session: AsyncSession, email: str
    ) -> MailAccount | None:
        stmt = select(cls.model).where(
            func.lower(cls.model.email) == cls.normalize_email(email)
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    @classmethod
    async def get_with_relations(
        cls, session: AsyncSession, account_id: uuid.UUID
    ) -> MailAccount | None:
        stmt = (
            select(cls.model)
            .where(cls.model.id == account_id)
            .options(
                selectinload(cls.model.created_by_user),
                selectinload(cls.model.assigned_users),
            )
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    @classmethod
    async def list_all(cls, session: AsyncSession) -> list[MailAccount]:
        stmt = (
            select(cls.model)
            .options(
                selectinload(cls.model.created_by_user),
                selectinload(cls.model.assigned_users),
            )
            .order_by(cls.model.created_at.desc())
        )
        return list((await session.execute(stmt)).unique().scalars().all())

    @classmethod
    async def delete_mail_account(
        cls, session: AsyncSession, account_id: uuid.UUID
    ) -> bool:
        """Delete an account; database SET NULL FKs preserve related records."""
        account = await session.get(cls.model, account_id)
        if account is None:
            return False
        await session.delete(account)
        await session.commit()
        logger.info("Mail account deleted", account_id=str(account_id))
        return True

    @classmethod
    async def list_assignable_admin(
        cls, session: AsyncSession
    ) -> list[MailAccount]:
        stmt = (
            select(cls.model)
            .where(cls.model.source == MailAccountSource.ADMIN.value)
            .options(selectinload(cls.model.assigned_users))
            .order_by(func.lower(cls.model.email))
        )
        return list((await session.execute(stmt)).scalars().all())

    @classmethod
    async def create_mail_account(
        cls,
        session: AsyncSession,
        *,
        email: str,
        source: MailAccountSource,
        smtp_host: str,
        smtp_port: int,
        imap_host: str,
        imap_port: int,
        password: str,
        created_by_user_id: uuid.UUID | None,
        smtp_available: bool,
        imap_available: bool,
        last_error: str | None,
    ) -> MailAccount:
        """Persist a verified mailbox while keeping password out of logs."""
        normalized_email = cls.normalize_email(email)
        account = cls.model(
            email=normalized_email,
            source=source.value,
            created_by_user_id=created_by_user_id,
            smtp_host=smtp_host.strip(),
            smtp_port=smtp_port,
            smtp_user=normalized_email,
            smtp_password=store_secret(password),
            imap_host=imap_host.strip(),
            imap_port=imap_port,
            imap_user=normalized_email,
            imap_password=store_secret(password),
            smtp_available=smtp_available,
            imap_available=imap_available,
            availability=smtp_available and imap_available,
            last_checked_at=datetime.now(UTC),
            last_error=last_error,
        )
        session.add(account)
        try:
            await session.flush()
            await session.refresh(account)
            await session.commit()
        except IntegrityError as exc:
            await session.rollback()
            logger.info(
                "Mail account duplicate rejected",
                email=normalized_email,
                source=source.value,
            )
            raise MailAccountDuplicateError(normalized_email) from exc
        logger.info(
            "Mail account created",
            account_id=str(account.id),
            email=normalized_email,
            source=source.value,
        )
        return account

    @classmethod
    async def update_verification(
        cls,
        session: AsyncSession,
        account: MailAccount,
        *,
        smtp_available: bool,
        imap_available: bool,
        last_error: str | None,
    ) -> MailAccount:
        account.smtp_available = smtp_available
        account.imap_available = imap_available
        account.availability = smtp_available and imap_available
        account.last_checked_at = datetime.now(UTC)
        account.last_error = last_error
        session.add(account)
        await session.flush()
        await session.refresh(account)
        await session.commit()
        logger.info(
            "Mail account verification updated",
            account_id=str(account.id),
            availability=account.availability,
        )
        return account

    @classmethod
    async def assign_admin_account(
        cls,
        session: AsyncSession,
        *,
        user_id: uuid.UUID,
        account_id: uuid.UUID | None,
    ) -> User:
        user = await session.get(User, user_id)
        if user is None:
            raise LookupError("user_not_found")
        if account_id is None:
            user.mail_account_id = None
        else:
            account = await session.get(cls.model, account_id)
            if account is None:
                raise LookupError("mail_account_not_found")
            if account.source != MailAccountSource.ADMIN.value:
                raise PermissionError("custom_account_assignment_forbidden")
            user.mail_account_id = account.id
        session.add(user)
        await session.flush()
        await session.refresh(user)
        await session.commit()
        return user

    @classmethod
    async def assign_custom_account_to_owner(
        cls,
        session: AsyncSession,
        *,
        user: User,
        account_id: uuid.UUID,
    ) -> User:
        account = await session.get(cls.model, account_id)
        if account is None:
            raise LookupError("mail_account_not_found")
        if (
            account.source != MailAccountSource.CUSTOM.value
            or account.created_by_user_id != user.id
        ):
            raise PermissionError("custom_account_owner_required")
        user.mail_account_id = account.id
        session.add(user)
        await session.flush()
        await session.refresh(user)
        await session.commit()
        return user

    @classmethod
    async def list_imap_mailboxes(
        cls, session: AsyncSession
    ) -> list[MailAccount]:
        """Return distinct assigned mailboxes; each physical account is polled once."""
        stmt = (
            select(cls.model)
            .join(User, User.mail_account_id == cls.model.id)
            .where(
                cls.model.imap_host.is_not(None),
                cls.model.imap_user.is_not(None),
                cls.model.imap_password.is_not(None),
            )
            .options(selectinload(cls.model.assigned_users))
            .distinct()
        )
        return list((await session.execute(stmt)).unique().scalars().all())
