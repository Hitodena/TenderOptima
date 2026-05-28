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
from email import encoders
from email.header import decode_header
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from bs4 import BeautifulSoup
from loguru import logger

from backend.celery_app.celery_config import app
from backend.celery_app.context import WorkerContext
from backend.core import get_config
from backend.db.dao import EmailMessageDAO, RequestDAO, RequestSupplierDAO
from backend.enums import (
    EmailMessageDirection,
    RequestStatus,
    RequestSupplierStatus,
)
from backend.utils.email_utils import (
    build_request_email_body,
    build_request_email_subject,
)
from backend.utils.short_id import generate_tid

config = get_config()

TRACKING_ID_RE = re.compile(r"\[TID-([A-Za-z0-9]{6,12})\]", re.IGNORECASE)


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
    """Extract attachments including raw data (for internal saving during poll)."""
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
                    "data": data,
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


def _prepare_attachments(attachment_paths: list[str] | None) -> list[dict]:
    """Load attachment files into dicts with filename+data (strips uuid_ prefix if present)."""
    if not attachment_paths:
        return []
    data_list: list[dict] = []
    for p_str in attachment_paths:
        p = Path(p_str)
        if p.is_file():
            try:
                raw = p.read_bytes()
                filename = p.name
                if "_" in filename:
                    pref, rest = filename.split("_", 1)
                    if len(pref) == 32 and all(
                        c in "0123456789abcdefABCDEF" for c in pref
                    ):
                        filename = rest
                data_list.append({"filename": filename, "data": raw})
            except Exception as exc:
                logger.warning(
                    "Failed to read attachment for reply",
                    path=str(p),
                    error=str(exc),
                )
        else:
            logger.warning("Attachment missing for reply", path=str(p))
    return data_list


def _send_mime(msg: email.message.Message, recipient: str) -> None:
    """Connect, auth, send one message, quit. Raises on SMTP error (caller retries)."""
    smtp = smtplib.SMTP(config.smtp_host, config.smtp_port)
    try:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(config.smtp_user, config.smtp_password)
        smtp.sendmail(config.smtp_user, recipient, msg.as_string())
    finally:
        try:
            smtp.quit()
        except Exception:
            pass


@app.task(name="mail.reply", bind=True, max_retries=3, default_retry_delay=60)
@_async_task
async def send_reply(
    self, rs_id: str, body: str, attachment_paths: list[str] | None = None
) -> dict:
    """Send a reply in an existing thread. Creates outgoing EmailMessage row. Uses last incoming message's Message-ID for In-Reply-To when available."""
    db_manager = _get_db_manager()
    rs_uuid = uuid.UUID(rs_id)

    async with db_manager.session() as session:
        rs = await RequestSupplierDAO.get_supplier_by_id(session, rs_uuid)
        if not rs:
            logger.error("RequestSupplier not found for reply", rs_id=rs_id)
            return {"status": "error", "reason": "rs_not_found"}

    supplier = rs.supplier
    recipient = rs.sent_to_email or supplier.main_email
    if not recipient:
        logger.warning("No recipient for reply", rs_id=rs_id)
        return {"status": "error", "reason": "no_recipient"}

    user = rs.request.user
    request = rs.request

    att_data = _prepare_attachments(attachment_paths)
    if att_data:
        msg = MIMEMultipart()
        msg.attach(MIMEText(body, "plain", "utf-8"))
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
        msg = MIMEText(body, "plain", "utf-8")

    msg["From"] = f"{user.company_name or 'TenderOptima'} <{config.smtp_user}>"
    msg["To"] = recipient
    subject = f"Re: {request.query} [TID-{rs.tracking_id}]"
    msg["Subject"] = subject

    in_reply_to = rs.smtp_message_id
    async with db_manager.session() as session:
        thread = await EmailMessageDAO.get_thread(session, rs_uuid)
        for m in reversed(thread):  # latest first
            if m.message_id:
                in_reply_to = m.message_id
                break
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to

    if not msg.get("Message-ID"):
        msg["Message-ID"] = email.utils.make_msgid(
            domain=config.smtp_host or "localhost"
        )

    try:
        _send_mime(msg, recipient)
        logger.info("Reply sent via SMTP", rs_id=rs_id, recipient=recipient)
    except smtplib.SMTPException as exc:
        logger.exception(
            "SMTP send failed for reply", rs_id=rs_id, error=str(exc)
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    async with db_manager.session() as session:
        await EmailMessageDAO.create(
            session,
            request_supplier_id=rs.id,
            direction=EmailMessageDirection.OUTGOING,
            message_id=msg["Message-ID"],
            in_reply_to=in_reply_to,
            subject=subject,
            raw_body=body,
            attachments=att_data or None,
            received_at=datetime.now(UTC),
        )
        # keep status as REPLIED
        await RequestSupplierDAO.mark_status(
            session, rs, RequestSupplierStatus.REPLIED
        )

    return {"status": "sent", "rs_id": rs_id, "message_id": msg["Message-ID"]}


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
    plain_body = ""
    attachment_data: list[dict] = []
    if request.attachment_paths:
        for p_str in request.attachment_paths:
            p = Path(p_str)
            if p.is_file():
                try:
                    data = p.read_bytes()
                    filename = p.name
                    if "_" in filename:
                        pref, rest = filename.split("_", 1)
                        if len(pref) == 32 and all(
                            c in "0123456789abcdefABCDEF" for c in pref
                        ):
                            filename = rest
                    attachment_data.append(
                        {"filename": filename, "data": data}
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to read attachment",
                        path=str(p),
                        error=str(exc),
                    )
            else:
                logger.warning(
                    "Attachment missing", path=str(p), request_id=request_id
                )

    try:
        smtp = smtplib.SMTP(config.smtp_host, config.smtp_port)
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()

        smtp.login(config.smtp_user, config.smtp_password)
    except smtplib.SMTPException as exc:
        logger.exception("SMTP connection failed", error=str(exc))
        raise self.retry(exc=exc)  # noqa: B904

    try:
        for rs in pending:
            supplier = rs.supplier
            recipient = rs.sent_to_email or supplier.main_email

            if not recipient:
                logger.warning(
                    "Supplier has no email, skipping",
                    supplier_id=str(supplier.id),
                    domain=supplier.domain,
                )
                results.append(
                    (rs.id, RequestSupplierStatus.FAILED, None, None)
                )
                failed += 1
                continue

            user = rs.request.user
            rs_tracking_id = generate_tid()
            plain_body = build_request_email_body(request, user)
            base_subject = build_request_email_subject(request)

            if attachment_data:
                msg = MIMEMultipart()
                msg.attach(MIMEText(plain_body, "plain", "utf-8"))
                for att in attachment_data:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(att["data"])
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f'attachment; filename="{att["filename"]}"',
                    )
                    msg.attach(part)
            else:
                msg = MIMEText(plain_body, "plain", "utf-8")
            msg["From"] = (
                f"{user.company_name or 'TenderOptima'} <{config.smtp_user}>"
            )
            msg["To"] = recipient
            msg["Subject"] = f"{base_subject} [TID-{rs_tracking_id}] "

            try:
                smtp.sendmail(config.smtp_user, recipient, msg.as_string())
                results.append(
                    (
                        rs.id,
                        RequestSupplierStatus.SENT,
                        msg["Message-ID"],
                        rs_tracking_id,
                        msg["Subject"],
                        plain_body,
                    )
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
                results.append(
                    (
                        rs.id,
                        RequestSupplierStatus.FAILED,
                        None,
                        None,
                        None,
                        None,
                    )
                )
                failed += 1
    finally:
        smtp.quit()

    async with db_manager.session() as session:
        for (
            rs_id,
            status,
            message_id,
            rs_tracking_id,
            subject,
            body_for_msg,
        ) in results:
            rs = await RequestSupplierDAO.get_supplier_by_id(session, rs_id)
            if rs:
                await RequestSupplierDAO.mark_status(
                    session,
                    rs,
                    status,
                    sent_at=datetime.now(UTC),
                    smtp_message_id=message_id,
                )
                if body_for_msg:
                    await RequestSupplierDAO.update_body_text(
                        session, rs.id, body_for_msg
                    )
                if rs_tracking_id:
                    rs.tracking_id = rs_tracking_id

                if status == RequestSupplierStatus.SENT and message_id:
                    await EmailMessageDAO.create(
                        session,
                        request_supplier_id=rs.id,
                        direction=EmailMessageDirection.OUTGOING,
                        message_id=message_id,
                        in_reply_to=None,
                        subject=subject,
                        raw_body=body_for_msg,
                        attachments=attachment_data or None,
                        received_at=datetime.now(UTC),
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
                        "tracking_id": match.group(1),
                        "subject": subject,
                        "body": body,
                        "attachments": attachments,
                        "received_at": received_at,
                        "message_id": msg.get("Message-ID"),
                        "in_reply_to": msg.get("In-Reply-To"),
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

                    existing = await EmailMessageDAO.get_by_imap_id(
                        session, item["uid_str"]
                    )
                    if existing:
                        skipped += 1
                        continue

                    email_body_text = _parse_email_body(item["body"])

                    processed_attachments: list[dict] = []
                    raw_attachments: list[dict] = item.get("attachments") or []
                    if raw_attachments:
                        upload_dir = Path(config.upload_dir)
                        request_dir = upload_dir / str(rs.request_id)
                        supplier_dir = request_dir / f"supplier_{rs.id}"
                        try:
                            supplier_dir.mkdir(parents=True, exist_ok=True)
                        except PermissionError as exc:
                            logger.error(
                                "Permission denied creating attachment directory",
                                path=str(supplier_dir),
                                error=str(exc),
                            )
                            processed_attachments = [
                                {
                                    "filename": att.get("filename"),
                                    "content_type": att.get("content_type"),
                                    "size": att.get("size"),
                                    "path": None,
                                }
                                for att in raw_attachments
                            ]
                        else:
                            for att in raw_attachments:
                                filename = (
                                    att.get("filename") or "attachment.bin"
                                )
                                safe_filename = Path(
                                    str(filename)
                                ).name.replace("..", "_")
                                data: bytes | None = att.get("data")
                                if data:
                                    unique_filename = (
                                        f"{uuid.uuid4().hex}_{safe_filename}"
                                    )
                                    file_path = supplier_dir / unique_filename
                                    try:
                                        file_path.write_bytes(data)
                                        processed_attachments.append(
                                            {
                                                "filename": safe_filename,
                                                "content_type": att.get(
                                                    "content_type"
                                                ),
                                                "size": len(data),
                                                "path": str(file_path),
                                            }
                                        )
                                        logger.info(
                                            "Saved reply attachment",
                                            rs_id=str(rs.id),
                                            filename=safe_filename,
                                            path=str(file_path),
                                        )
                                    except Exception as exc:
                                        logger.exception(
                                            "Failed to write attachment file",
                                            filename=safe_filename,
                                            error=str(exc),
                                        )
                                        processed_attachments.append(
                                            {
                                                "filename": safe_filename,
                                                "content_type": att.get(
                                                    "content_type"
                                                ),
                                                "size": len(data),
                                                "path": None,
                                            }
                                        )
                                else:
                                    processed_attachments.append(
                                        {
                                            "filename": safe_filename,
                                            "content_type": att.get(
                                                "content_type"
                                            ),
                                            "size": att.get("size"),
                                            "path": None,
                                        }
                                    )

                    await EmailMessageDAO.create(
                        session,
                        request_supplier_id=rs.id,
                        direction=EmailMessageDirection.INCOMING,
                        message_id=item.get("message_id"),
                        in_reply_to=item.get("in_reply_to"),
                        imap_id=item["uid_str"],
                        subject=item["subject"],
                        raw_body=email_body_text,
                        attachments=processed_attachments or None,
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
