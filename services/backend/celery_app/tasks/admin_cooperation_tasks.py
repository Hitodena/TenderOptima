"""Admin outreach: cooperation proposals to suppliers who previously replied."""

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
from backend.core import get_config
from backend.db.dao import SupplierDAO
from backend.db.models import Request, RequestSupplier
from backend.enums import RequestSupplierStatus
from backend.utils.user_email_credentials import (
    SmtpCredentials,
    resolve_smtp_credentials,
)

config = get_config()


def _apply_placeholders(
    template: str,
    *,
    company_name: str,
    query: str,
) -> str:
    return template.replace("{company_name}", company_name).replace(
        "{query}", query
    )


def _resolve_send_credentials(
    smtp_host: str | None,
    smtp_user: str | None,
    smtp_password: str | None,
) -> SmtpCredentials:
    """Use per-send SMTP override when complete, else global .env credentials."""
    host = (smtp_host or "").strip()
    user = (smtp_user or "").strip()
    password = smtp_password if smtp_password is not None else ""
    if host and user and password:
        return SmtpCredentials(
            host=host,
            port=config.smtp_port,
            user=user,
            password=password,
        )
    defaults = resolve_smtp_credentials(None, config)
    return SmtpCredentials(
        host=host or defaults.host,
        port=defaults.port,
        user=user or defaults.user,
        password=password or defaults.password,
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
    attachment_paths: list[str] | None = None,
    smtp_host: str | None = None,
    smtp_user: str | None = None,
    smtp_password: str | None = None,
) -> dict:
    """Send personalized cooperation emails to selected suppliers."""
    smtp_creds = _resolve_send_credentials(smtp_host, smtp_user, smtp_password)
    att_data = _prepare_attachments(attachment_paths)
    db_manager = get_db_manager()

    uuids = [uuid.UUID(sid) for sid in supplier_ids]
    async with db_manager.session() as session:
        suppliers = []
        for sid in uuids:
            supplier = await SupplierDAO.get_by_id(session, sid)
            if supplier is not None:
                suppliers.append(supplier)

        queries_by_supplier: dict[uuid.UUID, list[str]] = {
            s.id: [] for s in suppliers
        }
        if suppliers:
            replied = RequestSupplierStatus.REPLIED.value
            q_stmt = (
                select(RequestSupplier.supplier_id, Request.query)
                .join(Request, Request.id == RequestSupplier.request_id)
                .where(
                    RequestSupplier.supplier_id.in_([s.id for s in suppliers]),
                    RequestSupplier.sent_status == replied,
                )
                .distinct()
            )
            for supplier_id, query_text in (
                await session.execute(q_stmt)
            ).all():
                bucket = queries_by_supplier.setdefault(supplier_id, [])
                if query_text and query_text not in bucket:
                    bucket.append(query_text)

    sent = 0
    failed: list[dict] = []

    for supplier in suppliers:
        recipient = supplier.main_email
        if not recipient:
            failed.append(
                {
                    "supplier_id": str(supplier.id),
                    "reason": "no_recipient",
                }
            )
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

        if att_data:
            msg = MIMEMultipart()
            msg.attach(MIMEText(personalized_body, "plain", "utf-8"))
            for att in att_data:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(att["data"])
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{att["filename"]}"',
                )
                msg.attach(part)
        else:
            msg = MIMEText(personalized_body, "plain", "utf-8")

        msg["From"] = smtp_creds.user
        msg["To"] = recipient
        msg["Subject"] = personalized_subject

        try:
            _send_mime(msg, recipient, smtp_creds)
            sent += 1
            logger.info(
                "Cooperation proposal sent",
                supplier_id=str(supplier.id),
                recipient=recipient,
            )
        except (smtplib.SMTPException, UnicodeEncodeError, ValueError) as exc:
            logger.exception(
                "Cooperation proposal SMTP failed",
                supplier_id=str(supplier.id),
                error=str(exc),
            )
            failed.append(
                {
                    "supplier_id": str(supplier.id),
                    "reason": str(exc),
                }
            )

    return {
        "status": "done",
        "sent": sent,
        "failed": failed,
        "total": len(suppliers),
    }
