"""Security-related Celery tasks (admin alerts)."""

import smtplib
from email.mime.text import MIMEText

from loguru import logger

from backend.celery_app.celery_config import app
from backend.core import get_config
from backend.utils.user_email_credentials import (
    resolve_smtp_credentials,
    smtp_connection,
)

config = get_config()


@app.task(
    name="security.send_login_lockout_alert",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_login_lockout_alert(
    self,
    user_email: str,
    lockout_level: int,
    locked_until_iso: str,
) -> dict:
    """Notify platform admin about repeated login lockouts for an account."""
    if not config.admin_alert_email:
        logger.warning(
            "Login lockout alert skipped: ADMIN_ALERT_EMAIL not configured",
            user_email=user_email,
        )
        return {"status": "skipped", "reason": "no_admin_email"}

    smtp_creds = resolve_smtp_credentials(None, config)
    subject = f"TenderOptima: блокировка входа — {user_email}"
    body = (
        "Обнаружена эскалация блокировки входа после повторных "
        "неудачных попыток авторизации.\n\n"
        f"Email пользователя: {user_email}\n"
        f"Уровень блокировки: {lockout_level}\n"
        f"Заблокирован до: {locked_until_iso}\n"
    )

    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = smtp_creds.user
    msg["To"] = config.admin_alert_email
    msg["Subject"] = subject

    try:
        with smtp_connection(smtp_creds) as server:
            server.sendmail(
                smtp_creds.user,
                [config.admin_alert_email],
                msg.as_string(),
            )
    except smtplib.SMTPException as exc:
        logger.exception(
            "Login lockout alert email failed",
            user_email=user_email,
            error=str(exc),
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    logger.info(
        "Login lockout alert sent",
        user_email=user_email,
        recipient=config.admin_alert_email,
    )
    return {"status": "sent", "user_email": user_email}
