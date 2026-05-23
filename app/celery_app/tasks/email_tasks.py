import asyncio
import email
import email.message
import email.utils
import functools
import imaplib
import re
import smtplib
import uuid
from datetime import UTC, datetime
from email.header import decode_header
from email.mime.text import MIMEText

from bs4 import BeautifulSoup
from loguru import logger

from app.celery_app.celery_config import app
from app.celery_app.context import WorkerContext
from app.core.config import get_config
from app.db.dao import RequestDAO, RequestSupplierDAO, SupplierResponseDAO
from app.enums import RequestStatus, RequestSupplierStatus

config = get_config()

TRACKING_ID_RE = re.compile(r"\[TID-([0-9a-f-]{36})\]", re.IGNORECASE)


def _decode_header_value(value: str) -> str:
    parts = decode_header(value)
    decoded = []
    for part, charset in parts:
        if isinstance(part, bytes):
            decoded.append(part.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def _extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                charset = part.get_content_charset() or "utf-8"
                return part.get_payload(decode=True).decode(  # type: ignore
                    charset, errors="replace"
                )
    else:
        charset = msg.get_content_charset() or "utf-8"
        return msg.get_payload(decode=True).decode(charset, errors="replace")  # type: ignore
    return ""


def _extract_attachments(msg: email.message.Message) -> list[dict]:
    attachments = []
    for part in msg.walk():
        if "attachment" in part.get("Content-Disposition", ""):
            filename = part.get_filename()
            if filename:
                filename = _decode_header_value(filename)
            data = part.get_payload(decode=True)
            attachments.append(
                {
                    "filename": filename,
                    "content_type": part.get_content_type(),
                    "size": len(data) if data else 0,
                    "path": None,
                }
            )
    return attachments


def _get_db_manager():
    ctx = WorkerContext._instance
    if ctx is None or ctx.db_manager is None:
        raise RuntimeError("WorkerContext is not initialized")
    return ctx.db_manager


def _async_task(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(func(*args, **kwargs))

    return wrapper


def _parse_email_body(raw_body: str) -> str:
    if "<html>" in raw_body.lower() or "<div>" in raw_body.lower():
        soup = BeautifulSoup(raw_body, "lxml")
        text = soup.get_text(separator="\n", strip=True)
    else:
        text = raw_body

    lines = text.split("\n")
    lines = [line for line in lines if not line.strip().startswith(">")]

    return "\n".join(lines)


@app.task(name="mail.send", bind=True, max_retries=3, default_retry_delay=60)
@_async_task
async def send_emails(self, request_id: str) -> dict:
    logger.info("Starting sending emails", request_id=request_id)
    db_manager = _get_db_manager()

    async with db_manager.session() as session:
        request = await RequestDAO.get_by_id(session, uuid.UUID(request_id))
        if not request:
            logger.error("Request not found", request_id=request_id)
            return {"sent": 0, "failed": 0, "error": "request_not_found"}

        pending = await RequestSupplierDAO.get_pending_by_request(
            session, request.id
        )
        if not pending:
            logger.warning("No pending suppliers", request_id=request_id)
            return {"sent": 0, "failed": 0}

    sent = 0
    failed = 0
    results: list[tuple] = []

    try:
        smtp = smtplib.SMTP_SSL(config.smtp_host, config.smtp_port)
        smtp.login(config.smtp_user, config.smtp_password)
    except smtplib.SMTPException as exc:
        logger.exception("SMTP connection failed", error=str(exc))
        raise self.retry(exc=exc)  # noqa: B904

    try:
        for rs in pending:
            supplier = rs.supplier
            recipient = rs.sent_to_email or supplier.email

            if not recipient:
                logger.warning(
                    "Supplier has no email, skipping",
                    supplier_id=str(supplier.id),
                    domain=supplier.domain,
                )
                results.append((rs.id, RequestSupplierStatus.FAILED))
                failed += 1
                continue

            supplier_name = supplier.company_name or ""
            greeting = (
                f"Обращаемся к вам, {supplier_name}, с запросом коммерческого предложения."  # noqa: E501
                if supplier_name
                else "Обращаемся к вам с запросом коммерческого предложения."
            )
            user = rs.request.user
            desc_block = (
                f"\nОписание:\n{request.description}\n"
                if request.description
                else ""
            )
            region_block = (
                f"Регион поставки: {request.delivery_region or '—'}\n"
            )
            custom_block = ""
            if request.additional_params and request.additional_params.get(
                "custom_params"
            ):  # noqa: E501
                for p in request.additional_params["custom_params"]:
                    custom_block += (
                        f"{p.get('label', '')}: {p.get('value', '')}\n"
                    )
            if custom_block:
                custom_block = "Дополнительные параметры:\n" + custom_block

            plain_body = (
                f"Запрос коммерческого предложения — {request.query}\n\n"
                "Добрый день,\n\n"
                f"{greeting} Просим ознакомиться с техническими требованиями и направить ответ на данное письмо.\n\n"  # noqa: E501
                f"Наименование / запрос: {request.query}\n"
                f"{desc_block}"
                f"{region_block}"
                f"{custom_block}\n"
                "Пожалуйста, укажите цену за единицу, доступное количество, срок поставки, условия оплаты и иные существенные условия.\n"  # noqa: E501
                "Прикрепите прайс-лист или коммерческое предложение (PDF / Excel).\n"  # noqa: E501
                "Не изменяйте тему письма — она содержит идентификатор запроса для автоматической обработки.\n\n"  # noqa: E501
                "С уважением,\n"
                f"{user.full_name or user.company_name or 'Менеджер по закупкам'}\n"  # noqa: E501
                f"{(user.company_name + chr(10)) if user.company_name else ''}"  # noqa: E501
                f"{user.email}"
            )

            msg = MIMEText(plain_body, "plain", "utf-8")
            msg["From"] = (
                f"{user.company_name or 'TenderOptima'} <{config.smtp_user}>"
            )
            msg["To"] = recipient
            msg["Subject"] = (
                f"[TID-{request.tracking_id}] "
                f"Запрос коммерческого предложения — {request.query}"
            )

            try:
                smtp.sendmail(config.smtp_user, recipient, msg.as_string())
                results.append(
                    (rs.id, RequestSupplierStatus.SENT, msg["Message-ID"])
                )
                sent += 1
                logger.info(
                    "Email sent", domain=supplier.domain, recipient=recipient
                )
            except smtplib.SMTPException as exc:
                logger.error(
                    "Failed to send email",
                    domain=supplier.domain,
                    error=str(exc),
                )
                results.append((rs.id, RequestSupplierStatus.FAILED))
                failed += 1
    finally:
        smtp.quit()

    async with db_manager.session() as session:
        for rs_id, status, message_id in results:
            rs = await RequestSupplierDAO.get_supplier_by_id(session, rs_id)
            if rs:
                await RequestSupplierDAO.mark_status(
                    session,
                    rs,
                    status,
                    sent_at=datetime.now(UTC),
                    smtp_message_id=message_id,
                )

        await RequestDAO.update_status(
            session, uuid.UUID(request_id), RequestStatus.COMPLETED
        )

    logger.info(
        "send_emails done", request_id=request_id, sent=sent, failed=failed
    )
    return {"sent": sent, "failed": failed}


@app.task(name="mail.poll", bind=True, max_retries=3, default_retry_delay=120)
@_async_task
async def poll_imap(self) -> dict:
    logger.info("Starting IMAP poll")
    processed = 0
    skipped = 0
    db_manager = _get_db_manager()

    try:
        imap = imaplib.IMAP4_SSL(config.imap_host, config.imap_port)
        imap.login(config.imap_user, config.imap_password)
        imap.select("INBOX")
    except imaplib.IMAP4.error as exc:
        logger.exception("IMAP connection failed", error=str(exc))
        raise self.retry(exc=exc)  # noqa: B904

    try:
        status, message_ids = imap.search(None, "UNSEEN")
        if status != "OK" or not message_ids[0]:
            logger.info("No unseen messages")
            return {"processed": 0, "skipped": 0}

        uid_list = message_ids[0].split()
        logger.info("Unseen messages found", count=len(uid_list))

        parsed: list[dict] = []
        seen_uids: list = []

        for uid in uid_list:
            uid_str = uid.decode()
            try:
                _, msg_data = imap.fetch(uid, "(RFC822)")
                msg = email.message_from_bytes(msg_data[0][1])  # type: ignore

                subject = _decode_header_value(msg.get("Subject", ""))
                match = TRACKING_ID_RE.search(subject)
                if not match:
                    logger.debug(
                        "No TID in subject, skipping", subject=subject
                    )
                    skipped += 1
                    continue

                body = _extract_body(msg)
                attachments = _extract_attachments(msg)

                try:
                    received_at = email.utils.parsedate_to_datetime(
                        msg.get("Date")
                    )
                except Exception:
                    received_at = datetime.now(UTC)

                parsed.append(
                    {
                        "uid": uid,
                        "uid_str": uid_str,
                        "tracking_id": uuid.UUID(match.group(1)),
                        "subject": subject,
                        "body": body,
                        "attachments": attachments,
                        "received_at": received_at,
                    }
                )

            except Exception as exc:
                logger.exception(
                    "Failed to parse message", imap_id=uid_str, error=str(exc)
                )
                skipped += 1
                continue

        async with db_manager.session() as session:
            for item in parsed:
                try:
                    rs = await RequestSupplierDAO.get_by_tracking_id(
                        session, item["tracking_id"]
                    )
                    if not rs:
                        logger.warning(
                            "RequestSupplier not found for TID",
                            tracking_id=str(item["tracking_id"]),
                        )
                        skipped += 1
                        continue

                    if rs.response is not None:
                        logger.debug(
                            "Response already exists, skipping",
                            rs_id=str(rs.id),
                        )
                        skipped += 1
                        continue

                    email_body_text = _parse_email_body(item["body"])

                    await SupplierResponseDAO.create(
                        session,
                        request_supplier_id=rs.id,
                        imap_id=item["uid_str"],
                        subject=item["subject"],
                        raw_body=email_body_text,
                        attachments=item["attachments"],
                        extracted_text=item["body"],
                        received_at=item["received_at"],
                    )
                    await RequestSupplierDAO.mark_status(
                        session, rs, RequestSupplierStatus.REPLIED
                    )
                    seen_uids.append(item["uid"])

                    processed += 1
                    logger.info(
                        "Reply processed",
                        tracking_id=str(item["tracking_id"]),
                        rs_id=str(rs.id),
                        attachments=len(item["attachments"]),
                    )

                except Exception as exc:
                    logger.exception(
                        "Failed to save message",
                        imap_id=item["uid_str"],
                        error=str(exc),
                    )
                    skipped += 1
                    continue

        for uid in seen_uids:
            imap.store(uid, "+FLAGS", "\\Seen")

    finally:
        try:
            imap.close()
            imap.logout()
        except Exception:
            pass

    logger.info("IMAP poll done", processed=processed, skipped=skipped)
    return {"processed": processed, "skipped": skipped}
