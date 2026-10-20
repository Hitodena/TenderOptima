"""Admin outreach sent through an explicitly selected admin mail account."""

from __future__ import annotations

import smtplib
import uuid
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from loguru import logger
from sqlalchemy import select

from backend.celery_app.celery_config import app
from backend.celery_app.tasks.email_tasks import (
    _prepare_attachments,
    _send_mime,
)
from backend.celery_app.utils import async_task, get_db_manager
from backend.db.dao import MailAccountDAO, SupplierDAO
from backend.db.models import Request, RequestSupplier
from backend.enums import MailAccountSource, RequestSupplierStatus
from backend.utils.user_email_credentials import (
    MailAccountUnavailableError,
    resolve_smtp_credentials,
)


def _apply_placeholders(
    template: str,
    *,
    company_name: str,
    query: str,
) -> str:
    return template.replace("{company_name}", company_name).replace(
        "{query}", query
    )


@app.task(
    name="admin.send_cooperation",
    bind=True,
    max_retries=1,
    default_retry_delay=30,
)
@async_task
async def send_cooperation_proposals(
    self,
    supplier_ids: list[str],
    subject: str,
    body: str,
    attachment_paths: list[str] | None,
    mail_account_id: str,
) -> dict:
    """Send personalized cooperation emails through one verified admin account."""
    db_manager = get_db_manager()
    try:
        account_uuid = uuid.UUID(mail_account_id)
    except ValueError:
        return {"status": "error", "reason": "mail_account_not_found"}

    async with db_manager.session() as session:
        account = await MailAccountDAO.get_by_id(session, account_uuid)
        if account is None or account.source != MailAccountSource.ADMIN.value:
            return {"status": "error", "reason": "mail_account_not_available"}
        try:
            smtp_creds = resolve_smtp_credentials(account)
        except MailAccountUnavailableError as exc:
            return {"status": "error", "reason": exc.reason}

        suppliers = []
        for supplier_id in [uuid.UUID(sid) for sid in supplier_ids]:
            supplier = await SupplierDAO.get_by_id(session, supplier_id)
            if supplier is not None:
                suppliers.append(supplier)

        queries_by_supplier: dict[uuid.UUID, list[str]] = {
            supplier.id: [] for supplier in suppliers
        }
        if suppliers:
            replied = RequestSupplierStatus.REPLIED.value
            q_stmt = (
                select(RequestSupplier.supplier_id, Request.query)
                .join(Request, Request.id == RequestSupplier.request_id)
                .where(
                    RequestSupplier.supplier_id.in_(
                        [supplier.id for supplier in suppliers]
                    ),
                    RequestSupplier.sent_status == replied,
                )
                .distinct()
            )
            for supplier_id, query_text in (await session.execute(q_stmt)).all():
                bucket = queries_by_supplier.setdefault(supplier_id, [])
                if query_text and query_text not in bucket:
                    bucket.append(query_text)

    sent = 0
    failed: list[dict] = []
    attachment_data = _prepare_attachments(attachment_paths)
    for supplier in suppliers:
        recipient = supplier.main_email
        if not recipient:
            failed.append({"supplier_id": str(supplier.id), "reason": "no_recipient"})
            continue

        query_text = "; ".join(queries_by_supplier.get(supplier.id, []))
        personalized_subject = _apply_placeholders(
            subject,
            company_name=supplier.company_name,
            query=query_text,
        )
        personalized_body = _apply_placeholders(
            body,
            company_name=supplier.company_name,
            query=query_text,
        )
        if attachment_data:
            message = MIMEMultipart()
            message.attach(MIMEText(personalized_body, "plain", "utf-8"))
            for attachment in attachment_data:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment["data"])
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{attachment["filename"]}"',
                )
                message.attach(part)
        else:
            message = MIMEText(personalized_body, "plain", "utf-8")
        message["From"] = smtp_creds.user
        message["To"] = recipient
        message["Subject"] = personalized_subject

        try:
            _send_mime(message, recipient, smtp_creds)
            sent += 1
            logger.info(
                "Cooperation proposal sent",
                supplier_id=str(supplier.id),
                recipient=recipient,
                mail_account_id=mail_account_id,
            )
        except (smtplib.SMTPException, UnicodeEncodeError, ValueError) as exc:
            logger.exception(
                "Cooperation proposal SMTP failed",
                supplier_id=str(supplier.id),
                error=str(exc),
            )
            failed.append({"supplier_id": str(supplier.id), "reason": "smtp"})

    return {"status": "done", "sent": sent, "failed": failed, "total": len(suppliers)}
