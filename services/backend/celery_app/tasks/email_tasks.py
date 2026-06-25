import email
import email.message
import email.utils
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
from typing import NamedTuple

from bs4 import BeautifulSoup
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.celery_app.celery_config import app
from backend.celery_app.utils import async_task, get_db_manager
from backend.core import get_config
from backend.db.dao import (
    EmailMessageDAO,
    RequestDAO,
    RequestSupplierDAO,
    UserAdminDAO,
)
from backend.enums import (
    EmailMessageDirection,
    RequestStatus,
    RequestSupplierStatus,
)
from backend.services.analysis.email_queue import queue_email_analysis
from backend.utils.email_utils import (
    build_outbound_subject,
    build_request_email_body,
    build_threading_headers,
    make_message_id,
    normalize_message_id,
    resolve_reply_subject,
)
from backend.utils.short_id import generate_tid
from backend.utils.user_email_credentials import (
    ImapCredentials,
    SmtpCredentials,
    resolve_imap_credentials,
    resolve_smtp_credentials,
    smtp_connection,
)

config = get_config()

TRACKING_ID_RE = re.compile(r"\[TID-([A-Za-z0-9]{6,12})\]", re.IGNORECASE)


class SendResult(NamedTuple):
    rs_id: uuid.UUID
    status: RequestSupplierStatus
    message_id: str | None
    tracking_id: str | None
    subject: str | None
    body_for_msg: str | None


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


_CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
}


def _attachment_filename(part: email.message.Message) -> str | None:
    filename = part.get_filename()
    if filename:
        return _decode_header_value(filename)
    content_type = part.get_content_type()
    if content_type.startswith("image/"):
        ext = _CONTENT_TYPE_EXT.get(content_type, ".png")
        return f"inline_image{ext}"
    return None


def _ensure_attachment_filename(
    filename: str, content_type: str | None
) -> str:
    path = Path(filename)
    if path.suffix:
        return path.name.replace("..", "_") or "attachment.bin"
    ext = _CONTENT_TYPE_EXT.get(content_type or "", ".bin")
    stem = path.stem or "attachment"
    return f"{stem}{ext}".replace("..", "_")


def _extract_attachments(msg: email.message.Message) -> list[dict]:
    attachments: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for part in msg.walk():
        content_disposition = (part.get("Content-Disposition") or "").lower()
        content_type = part.get_content_type()
        data = part.get_payload(decode=True)
        if not data:
            continue

        is_attachment = "attachment" in content_disposition
        is_inline_image = content_type.startswith("image/") and (
            "inline" in content_disposition or part.get("Content-ID")
        )
        if not is_attachment and not is_inline_image:
            continue

        filename = _attachment_filename(part)
        if not filename:
            continue
        filename = _ensure_attachment_filename(filename, content_type)
        dedupe_key = (filename, len(data))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        attachments.append(
            {
                "filename": filename,
                "content_type": content_type,
                "size": len(data),
                "path": None,
                "data": data,
            }
        )
    return attachments


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
                    "Failed to read attachment",
                    path=str(p),
                    error=str(exc),
                )
        else:
            logger.warning("Attachment missing", path=str(p))
    return data_list


def _send_mime(
    msg: email.message.Message,
    recipient: str,
    smtp_creds: SmtpCredentials,
) -> None:
    with smtp_connection(smtp_creds) as smtp:
        smtp.sendmail(smtp_creds.user, recipient, msg.as_string())


async def _mark_rs_status(
    session: AsyncSession,
    rs_id: uuid.UUID,
    status: RequestSupplierStatus,
    sent_at: datetime | None = None,
    smtp_message_id: str | None = None,
    tracking_id: str | None = None,
    body_text: str | None = None,
) -> None:
    values: dict = {"sent_status": status.value}
    if sent_at is not None:
        values["sent_at"] = sent_at
    if smtp_message_id is not None:
        values["smtp_message_id"] = smtp_message_id
    if tracking_id is not None:
        values["tracking_id"] = tracking_id
    if body_text is not None:
        values["body_text"] = body_text
    await RequestSupplierDAO.update_fields(session, rs_id, **values)


@app.task(name="mail.reply", bind=True, max_retries=3, default_retry_delay=60)
@async_task
async def send_reply(
    self, rs_id: str, body: str, attachment_paths: list[str] | None = None
) -> dict:
    db_manager = get_db_manager()
    rs_uuid = uuid.UUID(rs_id)

    async with db_manager.session() as session:
        rs = await RequestSupplierDAO.get_by_id(session, rs_uuid)
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
    smtp_creds = resolve_smtp_credentials(user, config)

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

    msg["From"] = f"{user.company_name or 'TenderOptima'} <{smtp_creds.user}>"
    msg["To"] = recipient

    async with db_manager.session() as session:
        thread = await EmailMessageDAO.get_thread_by_request_supplier_id(
            session, rs_uuid
        )

    subject = resolve_reply_subject(request, rs.tracking_id, thread)
    msg["Subject"] = subject

    in_reply_to, references = build_threading_headers(
        thread, rs.smtp_message_id
    )
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references

    outbound_message_id = make_message_id(smtp_creds.user)
    msg["Message-ID"] = outbound_message_id

    try:
        _send_mime(msg, recipient, smtp_creds)
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
            message_id=outbound_message_id,
            in_reply_to=in_reply_to,
            subject=subject,
            raw_body=body,
            attachments=att_data or None,
            received_at=datetime.now(UTC),
        )
        await _mark_rs_status(
            session,
            rs.id,
            RequestSupplierStatus.REPLIED,
        )

    return {
        "status": "sent",
        "rs_id": rs_id,
        "message_id": outbound_message_id,
    }


@app.task(
    name="mail.send_custom", bind=True, max_retries=3, default_retry_delay=60
)
@async_task
async def send_custom_email(
    self,
    rs_id: str,
    subject: str,
    body: str,
    attachment_paths: list[str] | None = None,
) -> dict:
    """Send a custom subject/body email in an existing supplier thread."""
    db_manager = get_db_manager()
    rs_uuid = uuid.UUID(rs_id)

    async with db_manager.session() as session:
        rs = await RequestSupplierDAO.get_by_id(session, rs_uuid)
        if not rs:
            logger.error(
                "RequestSupplier not found for custom email", rs_id=rs_id
            )
            return {"status": "error", "reason": "rs_not_found"}

    supplier = rs.supplier
    recipient = rs.sent_to_email or supplier.main_email
    if not recipient:
        logger.warning("No recipient for custom email", rs_id=rs_id)
        return {"status": "error", "reason": "no_recipient"}

    user = rs.request.user
    request = rs.request
    smtp_creds = resolve_smtp_credentials(user, config)
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

    msg["From"] = f"{user.company_name or 'TenderOptima'} <{smtp_creds.user}>"
    msg["To"] = recipient

    async with db_manager.session() as session:
        thread = await EmailMessageDAO.get_thread_by_request_supplier_id(
            session, rs_uuid
        )

    resolved_subject = resolve_reply_subject(request, rs.tracking_id, thread)
    msg["Subject"] = resolved_subject

    in_reply_to, references = build_threading_headers(
        thread, rs.smtp_message_id
    )
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
    if references:
        msg["References"] = references

    outbound_message_id = make_message_id(smtp_creds.user)
    msg["Message-ID"] = outbound_message_id

    try:
        _send_mime(msg, recipient, smtp_creds)
        logger.info(
            "Custom email sent via SMTP",
            rs_id=rs_id,
            recipient=recipient,
        )
    except smtplib.SMTPException as exc:
        logger.exception(
            "SMTP send failed for custom email", rs_id=rs_id, error=str(exc)
        )
        raise self.retry(exc=exc) from exc  # type: ignore[attr-defined]

    async with db_manager.session() as session:
        await EmailMessageDAO.create(
            session,
            request_supplier_id=rs.id,
            direction=EmailMessageDirection.OUTGOING,
            message_id=outbound_message_id,
            in_reply_to=in_reply_to,
            subject=resolved_subject,
            raw_body=body,
            attachments=att_data or None,
            received_at=datetime.now(UTC),
        )
        await _mark_rs_status(
            session,
            rs.id,
            RequestSupplierStatus.REPLIED,
        )

    return {
        "status": "sent",
        "rs_id": rs_id,
        "message_id": outbound_message_id,
        "subject": resolved_subject,
    }


@app.task(name="mail.send", bind=True, max_retries=3, default_retry_delay=60)
@async_task
async def send_emails(self, request_id: str) -> dict:
    logger.info("Starting sending emails", request_id=request_id)
    db_manager = get_db_manager()

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

        user = request.user
        smtp_creds = resolve_smtp_credentials(user, config)

    sent = 0
    failed = 0
    results: list[SendResult] = []
    attachment_data = _prepare_attachments(request.attachment_paths)

    try:
        with smtp_connection(smtp_creds) as smtp:
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
                        SendResult(
                            rs.id,
                            RequestSupplierStatus.FAILED,
                            None,
                            None,
                            None,
                            None,
                        )
                    )
                    failed += 1
                    continue

                user = rs.request.user
                rs_tracking_id = generate_tid()
                plain_body = build_request_email_body(request, user)
                outbound_subject = build_outbound_subject(
                    request,
                    rs_tracking_id,
                )

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
                    f"{user.company_name or 'TenderOptima'} <{smtp_creds.user}>"
                )
                msg["To"] = recipient
                msg["Subject"] = outbound_subject
                outbound_message_id = make_message_id(smtp_creds.user)
                msg["Message-ID"] = outbound_message_id

                try:
                    smtp.sendmail(
                        smtp_creds.user,
                        recipient,
                        msg.as_string(),
                    )
                    results.append(
                        SendResult(
                            rs.id,
                            RequestSupplierStatus.SENT,
                            outbound_message_id,
                            rs_tracking_id,
                            msg["Subject"],
                            plain_body,
                        )
                    )
                    sent += 1
                    logger.info(
                        "Email sent",
                        domain=supplier.domain,
                        recipient=recipient,
                    )
                except smtplib.SMTPException as exc:
                    logger.error(
                        "Failed to send email",
                        domain=supplier.domain,
                        error=str(exc),
                    )
                    results.append(
                        SendResult(
                            rs.id,
                            RequestSupplierStatus.FAILED,
                            None,
                            None,
                            None,
                            None,
                        )
                    )
                    failed += 1
    except smtplib.SMTPException as exc:
        logger.exception("SMTP connection failed", error=str(exc))
        raise self.retry(exc=exc) from exc  # noqa: B904

    async with db_manager.session() as session:
        for result in results:
            await _mark_rs_status(
                session,
                result.rs_id,
                result.status,
                sent_at=datetime.now(UTC)
                if result.status == RequestSupplierStatus.SENT
                else None,
                smtp_message_id=normalize_message_id(result.message_id),
                tracking_id=result.tracking_id,
                body_text=result.body_for_msg,
            )
            if (
                result.status == RequestSupplierStatus.SENT
                and result.message_id
                and result.body_for_msg
            ):
                await EmailMessageDAO.create(
                    session,
                    request_supplier_id=result.rs_id,
                    direction=EmailMessageDirection.OUTGOING,
                    message_id=normalize_message_id(result.message_id),
                    in_reply_to=None,
                    subject=result.subject,
                    raw_body=result.body_for_msg,
                    attachments=attachment_data or None,
                    received_at=datetime.now(UTC),
                )

        await RequestDAO.update_fields(
            session,
            uuid.UUID(request_id),
            status=RequestStatus.COMPLETED.value,
        )

    logger.info(
        "send_emails done", request_id=request_id, sent=sent, failed=failed
    )
    return {"sent": sent, "failed": failed}


@app.task(name="mail.poll", bind=True, max_retries=3, default_retry_delay=120)
@async_task
async def poll_imap(self) -> dict:
    logger.info("Starting IMAP poll")
    db_manager = get_db_manager()
    total_processed = 0
    total_skipped = 0

    async with db_manager.session() as session:
        imap_users = await UserAdminDAO.list_imap_configured_users(session)

    mailboxes: list[tuple[str, ImapCredentials]] = []
    seen_mailbox_keys: set[tuple[str, str]] = set()
    for user in imap_users:
        creds = resolve_imap_credentials(user, config)
        key = (creds.host, creds.user)
        if key in seen_mailbox_keys:
            continue
        seen_mailbox_keys.add(key)
        mailboxes.append((str(user.id), creds))

    if not mailboxes:
        global_creds = resolve_imap_credentials(None, config)
        mailboxes.append(("global", global_creds))

    for mailbox_label, imap_creds in mailboxes:
        try:
            imap = imaplib.IMAP4_SSL(imap_creds.host, imap_creds.port)
            imap.login(imap_creds.user, imap_creds.password)
            imap.select("INBOX")
        except imaplib.IMAP4.error as exc:
            logger.exception(
                "IMAP connection failed",
                mailbox=mailbox_label,
                error=str(exc),
            )
            continue

        processed = 0
        skipped = 0
        try:
            status_code, message_ids = imap.search(None, "UNSEEN")
            if status_code != "OK" or not message_ids[0]:
                logger.info("No unseen messages", mailbox=mailbox_label)
                continue

            uid_list = message_ids[0].split()
            logger.info(
                "Unseen messages found",
                mailbox=mailbox_label,
                count=len(uid_list),
            )

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
                            "message_id": normalize_message_id(
                                msg.get("Message-ID")
                            ),
                            "in_reply_to": normalize_message_id(
                                msg.get("In-Reply-To")
                            ),
                        }
                    )

                except Exception as exc:
                    logger.exception(
                        "Failed to parse message",
                        imap_id=uid_str,
                        error=str(exc),
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
                        raw_attachments: list[dict] = (
                            item.get("attachments") or []
                        )
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
                                        "content_type": att.get(
                                            "content_type"
                                        ),
                                        "size": att.get("size"),
                                        "path": None,
                                    }
                                    for att in raw_attachments
                                ]
                            else:
                                for att in raw_attachments:
                                    raw_filename = (
                                        att.get("filename") or "attachment.bin"
                                    )
                                    content_type = att.get("content_type")
                                    safe_filename = (
                                        _ensure_attachment_filename(
                                            str(raw_filename),
                                            content_type,
                                        )
                                    )
                                    data: bytes | None = att.get("data")
                                    if data:
                                        unique_filename = f"{uuid.uuid4().hex}_{safe_filename}"
                                        file_path = (
                                            supplier_dir / unique_filename
                                        )
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

                        email_msg = await EmailMessageDAO.create(
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
                        request = await RequestDAO.get_by_id(
                            session, rs.request_id
                        )
                        if request:
                            await queue_email_analysis(
                                session,
                                email_msg.id,
                                request,
                                reanalyze=False,
                            )
                        await _mark_rs_status(
                            session, rs.id, RequestSupplierStatus.REPLIED
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

        total_processed += processed
        total_skipped += skipped

    logger.info(
        "IMAP poll done",
        processed=total_processed,
        skipped=total_skipped,
    )
    return {"processed": total_processed, "skipped": total_skipped}
