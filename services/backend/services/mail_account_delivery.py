"""Credential resolution for explicit persisted mailbox choices."""

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import Config
from backend.db.dao import MailAccountDAO
from backend.enums import MailAccountSource
from backend.utils.user_email_credentials import (
    MailAccountUnavailableError,
    SmtpCredentials,
    resolve_smtp_credentials,
)


async def resolve_system_smtp_credentials(
    session: AsyncSession,
    config: Config,
) -> SmtpCredentials:
    """Resolve only the explicitly configured central system mailbox."""
    account_id = config.system_mail_account_id
    if account_id is None:
        raise MailAccountUnavailableError("system_mail_account_not_configured")
    account = await MailAccountDAO.get_by_id(session, account_id)
    if account is None or account.source != MailAccountSource.ADMIN.value:
        raise MailAccountUnavailableError("system_mail_account_invalid")
    return resolve_smtp_credentials(account)
