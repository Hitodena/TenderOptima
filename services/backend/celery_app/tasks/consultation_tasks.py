"""Notifications for new landing page consultation leads."""

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

_ROLE_LABELS = {
    "procurement_manager": "Менеджер по закупкам",
    "tender_specialist": "Специалист тендерного отдела",
    "tech_specialist": "Технический специалист",
    "director": "Руководитель / директор",
    "other": "Другое",
}
_REQUEST_TYPE_LABELS = {"demo": "Демонстрация", "trial": "Пробный доступ"}


def _send(smtp_creds, subject: str, body: str, recipient: str) -> None:
    message = MIMEText(body, "plain", "utf-8")
    message["From"] = smtp_creds.user
    message["To"] = recipient
    message["Subject"] = subject
    with smtp_connection(smtp_creds) as server:
        server.sendmail(smtp_creds.user, [recipient], message.as_string())


async def _system_smtp_credentials():
    db_manager = get_db_manager()
    async with db_manager.session() as session:
        return await resolve_system_smtp_credentials(session, config)


@app.task(
    name="consultation.notify_admin",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
@async_task
async def notify_admin_new_consultation(
    self,
    consultation_id: str,
    name: str,
    company: str,
    email: str,
    phone: str,
    role: str,
    request_type: str,
    comment: str | None,
    agree_marketing: bool,
) -> dict:
    """Alert the platform admin through the explicit system account."""
    if not config.admin_alert_email:
        return {"status": "skipped", "reason": "no_admin_email"}
    try:
        smtp_creds = await _system_smtp_credentials()
    except MailAccountUnavailableError as exc:
        return {"status": "skipped", "reason": exc.reason}
    type_label = _REQUEST_TYPE_LABELS.get(request_type, request_type)
    subject = f"TenderOptima: новая заявка ({type_label}) — {name}"
    body = (
        "Поступила новая заявка с сайта.\n\n"
        f"Тип: {type_label}\nИмя: {name}\nКомпания: {company}\n"
        f"Email: {email}\nТелефон: {phone}\n"
        f"Роль: {_ROLE_LABELS.get(role, role)}\n"
        f"Комментарий: {comment or '—'}\n"
        f"Информационные сообщения: {'да' if agree_marketing else 'нет'}\n"
    )
    try:
        await asyncio.to_thread(
            _send, smtp_creds, subject, body, config.admin_alert_email
        )
    except smtplib.SMTPException as exc:
        logger.exception("Consultation admin alert failed", error=str(exc))
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]
    return {"status": "sent", "consultation_id": consultation_id}


@app.task(
    name="consultation.send_autoreply",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
@async_task
async def send_consultation_autoreply(
    self,
    consultation_id: str,
    name: str,
    email: str,
    request_type: str,
) -> dict:
    """Confirm a consultation request through the explicit system account."""
    try:
        smtp_creds = await _system_smtp_credentials()
    except MailAccountUnavailableError as exc:
        return {"status": "skipped", "reason": exc.reason}
    is_trial = request_type == "trial"
    subject = (
        "TenderOptima: заявка на пробный доступ получена"
        if is_trial
        else "TenderOptima: заявка на демонстрацию получена"
    )
    body = (
        f"Здравствуйте, {name}!\n\n"
        + (
            "Мы получили вашу заявку на пробный доступ к TenderOptima. "
            "Менеджер свяжется с вами в ближайшее рабочее время.\n\n"
            if is_trial
            else "Мы получили вашу заявку на демонстрацию TenderOptima. "
            "Наш менеджер свяжется с вами в ближайшее рабочее время.\n\n"
        )
        + "Если у вас срочный вопрос, напишите нам на support@tenderoptima.by.\n\n"
        "— Команда TenderOptima"
    )
    try:
        await asyncio.to_thread(_send, smtp_creds, subject, body, email)
    except smtplib.SMTPException as exc:
        logger.exception("Consultation autoreply failed", error=str(exc))
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]
    return {"status": "sent", "consultation_id": consultation_id}
