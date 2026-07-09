"""Send billing documents via platform SMTP."""

import smtplib
import uuid
from datetime import UTC, datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.db.dao import SubscriptionBillingDocumentDAO
from backend.services.extraction.docx_to_pdf import convert_docx_to_pdf_file
from backend.utils.user_email_credentials import (
    resolve_smtp_credentials,
    smtp_connection,
)

config = get_config()


def _send_mime(msg, recipient: str, smtp_creds) -> None:
    with smtp_connection(smtp_creds) as server:
        server.sendmail(smtp_creds.user, [recipient], msg.as_string())


def _resolve_pdf_attachment(stored_path: str | None) -> Path | None:
    if not stored_path:
        return None
    path = Path(stored_path)
    if path.suffix.lower() == ".pdf" and path.is_file():
        return path
    if path.suffix.lower() == ".docx" and path.is_file():
        pdf_path = path.with_suffix(".pdf")
        if pdf_path.is_file():
            return pdf_path
        return convert_docx_to_pdf_file(path, pdf_path)
    docx_fallback = path.with_suffix(".docx")
    if docx_fallback.is_file():
        target = (
            path
            if path.suffix.lower() == ".pdf"
            else docx_fallback.with_suffix(".pdf")
        )
        if target.is_file():
            return target
        return convert_docx_to_pdf_file(docx_fallback, target)
    return None


def _attach_pdf(msg: MIMEMultipart, path: Path) -> None:
    part = MIMEBase("application", "pdf")
    part.set_payload(path.read_bytes())
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        f'attachment; filename="{path.with_suffix(".pdf").name}"',
    )
    msg.attach(part)


@app.task(
    name="billing.send_document_email",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
@async_task
async def send_billing_document_email(
    self,
    document_id: str,
    recipient: str,
) -> dict:
    """Send billing invoice and act PDF to the subscription owner."""
    db_manager = get_db_manager()
    doc_uuid = uuid.UUID(document_id)

    async with db_manager.session() as session:
        row = await SubscriptionBillingDocumentDAO.get_by_id(session, doc_uuid)
        if row is None:
            logger.error("Billing document not found", document_id=document_id)
            return {"status": "error", "reason": "not_found"}
        invoice_stored = row.invoice_docx_path
        act_stored = row.act_docx_path
        receipt_id = row.receipt_id
        period_start = row.period_start
        period_end = row.period_end

    attachments: list[Path] = []
    for stored in (invoice_stored, act_stored):
        pdf_path = _resolve_pdf_attachment(stored)
        if pdf_path is not None and pdf_path.is_file():
            attachments.append(pdf_path)

    if not attachments:
        logger.error("Billing PDF files missing", document_id=document_id)
        return {"status": "error", "reason": "file_missing"}

    smtp_creds = resolve_smtp_credentials(None, config)
    subject = f"Документы по подписке TenderOptima — {receipt_id}"
    body = (
        "Добрый день.\n\n"
        f"Во вложении счёт-фактура и акт сдачи-приёмки услуг "
        f"по подписке за период "
        f"{period_start.strftime('%d.%m.%Y')} — "
        f"{period_end.strftime('%d.%m.%Y')}.\n\n"
        "С уважением,\n"
        f"{config.billing_issuer_name}\n"
    )

    msg = MIMEMultipart()
    msg.attach(MIMEText(body, "plain", "utf-8"))
    for attachment in attachments:
        _attach_pdf(msg, attachment)
    msg["From"] = f"{config.billing_issuer_name} <{smtp_creds.user}>"
    msg["To"] = recipient
    msg["Subject"] = subject

    try:
        _send_mime(msg, recipient, smtp_creds)
    except smtplib.SMTPException as exc:
        logger.exception(
            "Billing email send failed",
            document_id=document_id,
            error=str(exc),
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    async with db_manager.session() as session:
        await SubscriptionBillingDocumentDAO.mark_sent(
            session,
            doc_uuid,
            recipient_email=recipient,
            sent_at=datetime.now(UTC),
        )

    logger.info(
        "Billing email sent",
        document_id=document_id,
        recipient=recipient,
        attachments=len(attachments),
    )
    return {
        "status": "sent",
        "document_id": document_id,
        "recipient": recipient,
    }
