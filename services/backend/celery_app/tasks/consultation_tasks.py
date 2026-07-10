"""Notifications for new landing page consultation leads."""

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

_ROLE_LABELS = {
    "procurement_manager": "Менеджер по закупкам",
    "tender_specialist": "Специалист тендерного отдела",
    "tech_specialist": "Технический специалист",
    "director": "Руководитель / директор",
    "other": "Другое",
}

_REQUEST_TYPE_LABELS = {
    "demo": "Демонстрация",
    "trial": "Пробный доступ",
}


def _send(subject: str, body: str, recipient: str) -> None:
    smtp_creds = resolve_smtp_credentials(None, config)
    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = smtp_creds.user
    msg["To"] = recipient
    msg["Subject"] = subject
    with smtp_connection(smtp_creds) as server:
        server.sendmail(smtp_creds.user, [recipient], msg.as_string())


@app.task(
    name="consultation.notify_admin",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def notify_admin_new_consultation(
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
    """Alert the platform admin about a new consultation lead."""
    if not config.admin_alert_email:
        logger.warning(
            "Consultation admin alert skipped: ADMIN_ALERT_EMAIL not configured",
            consultation_id=consultation_id,
        )
        return {"status": "skipped", "reason": "no_admin_email"}

    type_label = _REQUEST_TYPE_LABELS.get(request_type, request_type)
    subject = f"TenderOptima: новая заявка ({type_label}) — {name}"
    body = (
        "Поступила новая заявка с сайта.\n\n"
        f"Тип: {type_label}\n"
        f"Имя: {name}\n"
        f"Компания: {company}\n"
        f"Email: {email}\n"
        f"Телефон: {phone}\n"
        f"Роль: {_ROLE_LABELS.get(role, role)}\n"
        f"Комментарий: {comment or '—'}\n"
        f"Информационные сообщения: {'да' if agree_marketing else 'нет'}\n"
    )

    try:
        _send(subject, body, config.admin_alert_email)
    except smtplib.SMTPException as exc:
        logger.exception(
            "Consultation admin alert failed",
            consultation_id=consultation_id,
            error=str(exc),
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    logger.info(
        "Consultation admin alert sent",
        consultation_id=consultation_id,
        recipient=config.admin_alert_email,
    )
    return {"status": "sent"}


@app.task(
    name="consultation.send_autoreply",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def send_consultation_autoreply(
    self,
    consultation_id: str,
    name: str,
    email: str,
    request_type: str,
) -> dict:
    """Confirm receipt of the consultation request to the submitter."""
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
            "Менеджер свяжется с вами в ближайшее рабочее время, "
            "чтобы открыть тестовый период и помочь с первым запуском.\n\n"
            if is_trial
            else "Мы получили вашу заявку на демонстрацию TenderOptima. "
            "Наш менеджер свяжется с вами в ближайшее рабочее время.\n\n"
        )
        + "Если у вас срочный вопрос, напишите нам на "
        "support@tenderoptima.by.\n\n"
        "— Команда TenderOptima"
    )

    try:
        _send(subject, body, email)
    except smtplib.SMTPException as exc:
        logger.exception(
            "Consultation autoreply failed",
            consultation_id=consultation_id,
            error=str(exc),
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    logger.info(
        "Consultation autoreply sent",
        consultation_id=consultation_id,
        recipient=email,
    )
    return {"status": "sent"}
