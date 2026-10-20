"""Security-related Celery tasks (admin alerts)."""

import asyncio
import smtplib
from email.mime.text import MIMEText

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.services.mail_account_delivery import (
    resolve_system_smtp_credentials,
)
from backend.utils.user_email_credentials import (
    MailAccountUnavailableError,
    smtp_connection,
)

config = get_config()


def _send_alert(smtp_creds, recipient: str, subject: str, body: str) -> None:
    message = MIMEText(body, "plain", "utf-8")
    message["From"] = smtp_creds.user
    message["To"] = recipient
    message["Subject"] = subject
    with smtp_connection(smtp_creds) as server:
        server.sendmail(smtp_creds.user, [recipient], message.as_string())


@app.task(
    name="security.send_login_lockout_alert",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
@async_task
async def send_login_lockout_alert(
    self,
    user_email: str,
    lockout_level: int,
    locked_until_iso: str,
) -> dict:
    """Notify platform admin through the explicit system mail account."""
    if not config.admin_alert_email:
        return {"status": "skipped", "reason": "no_admin_email"}
    db_manager = get_db_manager()
    async with db_manager.session() as session:
        try:
            smtp_creds = await resolve_system_smtp_credentials(session, config)
        except MailAccountUnavailableError as exc:
            logger.warning("Login lockout alert skipped", reason=exc.reason)
            return {"status": "skipped", "reason": exc.reason}

    subject = f"TenderOptima: блокировка входа — {user_email}"
    body = (
        "Обнаружена эскалация блокировки входа после повторных "
        "неудачных попыток авторизации.\n\n"
        f"Email пользователя: {user_email}\n"
        f"Уровень блокировки: {lockout_level}\n"
        f"Заблокирован до: {locked_until_iso}\n"
    )
    try:
        await asyncio.to_thread(
            _send_alert, smtp_creds, config.admin_alert_email, subject, body
        )
    except smtplib.SMTPException as exc:
        logger.exception("Login lockout alert email failed", error=str(exc))
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]
    return {"status": "sent", "user_email": user_email}
