import io
import uuid
import zipfile
from dataclasses import asdict
from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import (
    get_config_instance,
    get_current_user,
    get_request_or_404,
    get_session,
)
from backend.api.responses.schemas import (
    ComparisonResponse,
    ComparisonSupplier,
    CustomEmailPayload,
    EmailMessageResponse,
    ForwardPayload,
    LetterSummaryOut,
    Message,
    RefreshAllResponse,
    ReplyPayload,
    StarPayload,
    SummaryFactOut,
    ThreadAttachment,
    ThreadSummary,
)
from backend.api.subscriptions.enforcement import ensure_can_send_emails
from backend.api.user_requests.router import (
    _resolve_and_validate_attachment_path,
)
from backend.celery_app.tasks.email_tasks import (
    send_custom_email,
    send_forward,
    send_reply,
)
from backend.core.config import Config
from backend.db.dao import (
    EmailMessageDAO,
    RequestSupplierDAO,
)
from backend.db.models import Request, User
from backend.enums import TZAnalysisRunStatus
from backend.schemas.analysis import EmailAnalysisResult
from backend.services.analysis.email_queue import queue_email_analysis
from backend.services.correspondence import MessageView, build_thread
from backend.services.onboarding_demo import (
    deliver_due_follow_ups,
    record_demo_outgoing,
)
from backend.utils.comparison_price import (
    DELIVERY_TOTAL_ALIASES,
    POSITION_PRICE_PREFIX,
    apply_delivery_total,
    is_position_price_requirement,
    is_price_requirement,
    resolve_numeric_value,
)
from backend.utils.email_content import MessageKind
from backend.utils.price_units import (
    PriceCell,
    compare_prices,
    parse_request_quantity,
    percent_vs_min,
    position_quantities,
)
from backend.utils.xlsx_export import (
    build_comparison_workbook,
    workbook_to_bytes,
)

router = APIRouter(prefix="/requests", tags=["Responses"])

STATUS_LABELS = {
    "met": "Выполнено",
    "partial": "Частично",
    "missing": "Не закрыто",
    "not_found": "Не упомянуто",
}


def _requirements_list(request: Request) -> list[str]:
    params = request.additional_params
    if not params or not isinstance(params, list):
        return []
    return [str(p).strip() for p in params if str(p).strip()]


def _match_units_from_analysis(raw: dict | None) -> dict[str, str | None]:
    """Unit the supplier quoted each price for («м», «бухта 100 м»)."""
    if not raw:
        return {}
    units: dict[str, str | None] = {}
    for match in raw.get("matches") or []:
        if not isinstance(match, dict):
            continue
        req = str(match.get("requirement") or "").strip()
        unit = match.get("unit")
        if req:
            units[req] = (
                str(unit).strip() if unit and str(unit).strip() else None
            )
    return units


UNIT_PRICE_REQUIREMENT = "Цена за единицу без НДС"
DESCRIPTION_REQUIREMENT = "Описание товара"
TOTAL_WITHOUT_VAT_REQUIREMENT = "Общая стоимость без НДС"


def _apply_price_checks(
    request: Request,
    price_requirements: list[str],
    suppliers_rows: list[ComparisonSupplier],
    currencies_by_rs: dict[str, dict[str, str | None]],
    units_by_rs: dict[str, dict[str, str | None]],
) -> dict[str, str | None]:
    """Rank only prices that are the same thing; explain the rest.

    Sets ``numeric_values`` of price rows to the comparable value (None when
    a price cannot be compared), ``percent_vs_min`` and ``price_notes``.
    Returns the unit each price row is compared in.
    """
    region = request.delivery_region
    request_text = "\n".join(
        part for part in (request.query, request.description) if part
    )
    whole_quantity = (
        None
        if request.is_multi_position
        else parse_request_quantity(request_text)
    )
    per_position = position_quantities(request.description)
    units_out: dict[str, str | None] = {}
    for supplier in suppliers_rows:
        supplier.percent_vs_min = {}
        supplier.price_notes = {}

    for req in price_requirements:
        unit_price = (
            req == UNIT_PRICE_REQUIREMENT or is_position_price_requirement(req)
        )
        if req == UNIT_PRICE_REQUIREMENT:
            quantity = whole_quantity
        elif is_position_price_requirement(req):
            title = req.strip()[len(POSITION_PRICE_PREFIX) :].strip()
            quantity = per_position.get(title)
        else:
            quantity = None
        cells: dict[str, PriceCell] = {}
        for supplier in suppliers_rows:
            # «Описание товара» not met: the price is for something else
            description_status = supplier.statuses.get(DESCRIPTION_REQUIREMENT)
            other_product = (
                (
                    supplier.explanations.get(DESCRIPTION_REQUIREMENT)
                    or "см. «Описание товара»"
                )
                if description_status in {"partial", "missing"}
                else None
            )
            currencies = currencies_by_rs.get(supplier.rs_id, {})
            units = units_by_rs.get(supplier.rs_id, {})
            # the supplier's own total checks the unit of a single-position price
            with_total = req == UNIT_PRICE_REQUIREMENT
            cells[supplier.rs_id] = PriceCell(
                numeric=supplier.numeric_values.get(req),
                offer_value=supplier.values.get(req),
                currency=currencies.get(req),
                unit=units.get(req),
                total_without_vat=(
                    supplier.numeric_values.get(TOTAL_WITHOUT_VAT_REQUIREMENT)
                    if with_total
                    else None
                ),
                total_currency=(
                    currencies.get(TOTAL_WITHOUT_VAT_REQUIREMENT)
                    if with_total
                    else None
                ),
                total_offer_value=(
                    supplier.values.get(TOTAL_WITHOUT_VAT_REQUIREMENT)
                    if with_total
                    else None
                ),
                other_product=other_product,
            )
        row = compare_prices(
            cells,
            unit_price=unit_price,
            without_vat="без ндс" in req.lower()
            or req.strip() in DELIVERY_TOTAL_ALIASES
            or is_position_price_requirement(req),
            region=region,
            request_quantity=quantity,
        )
        percents = percent_vs_min(row)
        units_out[req] = row.reference_unit
        for supplier in suppliers_rows:
            verdict = row.verdicts.get(supplier.rs_id)
            supplier.numeric_values[req] = (
                verdict.normalized if verdict and verdict.comparable else None
            )
            supplier.percent_vs_min[req] = percents.get(supplier.rs_id)
            supplier.price_notes[req] = verdict.note if verdict else None
    return units_out


def _match_maps_from_analysis(
    raw: dict | None,
) -> tuple[
    dict[str, str | None],
    dict[str, str | None],
    dict[str, str | None],
    dict[str, str | None],
    dict[str, float | None],
    dict[str, str | None],
    dict[str, str | None],
    dict[str, str | None],
]:
    if not raw:
        return {}, {}, {}, {}, {}, {}, {}, {}
    try:
        result = EmailAnalysisResult(**raw)
    except Exception:
        return {}, {}, {}, {}, {}, {}, {}, {}
    values: dict[str, str | None] = {}
    statuses: dict[str, str | None] = {}
    explanations: dict[str, str | None] = {}
    corrected_from: dict[str, str | None] = {}
    numeric_values: dict[str, float | None] = {}
    currencies: dict[str, str | None] = {}
    value_origins: dict[str, str | None] = {}
    source_message_ids: dict[str, str | None] = {}
    for match in result.matches:
        req = match.requirement.strip()
        values[req] = match.offer_value
        statuses[req] = match.status.value
        explanations[req] = match.explanation
        corrected_from[req] = match.corrected_from
        numeric_values[req] = resolve_numeric_value(
            req,
            match.offer_value,
            match.numeric_value,
        )
        currencies[req] = (
            match.currency.strip()
            if match.currency and match.currency.strip()
            else None
        )
        value_origins[req] = (
            match.value_origin.value if match.value_origin else None
        )
        source_message_ids[req] = match.source_message_id
    return (
        values,
        statuses,
        explanations,
        corrected_from,
        numeric_values,
        currencies,
        value_origins,
        source_message_ids,
    )


async def _latest_analyzed_incoming(session, rs_id: uuid.UUID):
    messages = await EmailMessageDAO.get_incoming_with_analysis_by_request_supplier_id(
        session, rs_id
    )
    for message in messages:
        analysis = message.analysis
        if (
            analysis
            and analysis.status == TZAnalysisRunStatus.ACTIVE.value
            and analysis.raw_llm_response
        ):
            return message
    return None


async def _build_comparison(
    session: AsyncSession,
    request: Request,
) -> ComparisonResponse:
    requirements = _requirements_list(request)
    price_requirements = [r for r in requirements if is_price_requirement(r)]
    # Prefer unit price, then total without VAT, then delivery total.
    preferred_price_order = (
        "Цена за единицу без НДС",
        "Общая стоимость без НДС",
        "Общая цена поставки без НДС",
        "Общая цена поставки",
    )
    for preferred in preferred_price_order:
        if preferred in price_requirements:
            price_requirements = [preferred] + [
                r for r in price_requirements if r != preferred
            ]
            break
    suppliers_rows: list[ComparisonSupplier] = []
    currencies_by_rs: dict[str, dict[str, str | None]] = {}
    units_by_rs: dict[str, dict[str, str | None]] = {}
    enabled = await RequestSupplierDAO.get_enabled_by_request(
        session, request.id
    )
    for rs in enabled:
        if not rs.supplier:
            continue
        analyzed = await _latest_analyzed_incoming(session, rs.id)
        values: dict[str, str | None] = {req: None for req in requirements}
        previous_values: dict[str, str | None] = {
            req: None for req in requirements
        }
        statuses: dict[str, str | None] = {req: None for req in requirements}
        explanations: dict[str, str | None] = {
            req: None for req in requirements
        }
        corrected_from: dict[str, str | None] = {
            req: None for req in requirements
        }
        numeric_values: dict[str, float | None] = {
            req: None for req in requirements
        }
        currencies: dict[str, str | None] = {req: None for req in requirements}
        value_origins: dict[str, str | None] = {
            req: None for req in requirements
        }
        source_message_ids: dict[str, str | None] = {
            req: None for req in requirements
        }
        column_source_message_id: str | None = None
        if analyzed and analyzed.analysis:
            analysis = analyzed.analysis
            column_source_message_id = str(analyzed.id)
            (
                match_values,
                match_statuses,
                match_explanations,
                match_corrected,
                match_numeric,
                match_currencies,
                match_origins,
                match_source_ids,
            ) = _match_maps_from_analysis(analysis.raw_llm_response)
            units_by_rs[str(rs.id)] = _match_units_from_analysis(
                analysis.raw_llm_response
            )
            prev = analysis.previous_parameters
            prev_map = prev if isinstance(prev, dict) else {}
            for req in requirements:
                if req in match_values:
                    values[req] = match_values[req]
                if req in match_statuses:
                    statuses[req] = match_statuses[req]
                if req in match_explanations:
                    explanations[req] = match_explanations[req]
                if req in match_corrected:
                    corrected_from[req] = match_corrected[req]
                if req in match_numeric:
                    numeric_values[req] = match_numeric[req]
                if req in match_currencies:
                    currencies[req] = match_currencies[req]
                if req in match_origins:
                    value_origins[req] = match_origins[req]
                if req in match_source_ids and match_source_ids[req]:
                    source_message_ids[req] = match_source_ids[req]
                else:
                    source_message_ids[req] = column_source_message_id
                if req in prev_map and prev_map[req] is not None:
                    previous_values[req] = str(prev_map[req])
        apply_delivery_total(
            requirements,
            numeric_values,
            values,
            currencies,
        )
        has_extracted = any(
            value is not None and str(value).strip()
            for value in values.values()
        )
        if not has_extracted:
            continue
        currencies_by_rs[str(rs.id)] = currencies
        suppliers_rows.append(
            ComparisonSupplier(
                rs_id=str(rs.id),
                company_name=rs.supplier.company_name,
                main_email=rs.supplier.main_email,
                is_winner=bool(rs.is_winner),
                source_message_id=column_source_message_id,
                values=values,
                previous_values=previous_values,
                explanations=explanations,
                corrected_from=corrected_from,
                statuses=statuses,
                numeric_values=numeric_values,
                value_origins=value_origins,
                source_message_ids=source_message_ids,
            )
        )

    price_units = _apply_price_checks(
        request,
        price_requirements,
        suppliers_rows,
        currencies_by_rs,
        units_by_rs,
    )

    return ComparisonResponse(
        requirements=requirements,
        price_requirements=price_requirements,
        price_units=price_units,
        suppliers=suppliers_rows,
    )


@router.get(
    "/{request_id}/responses",
    response_model=list[EmailMessageResponse],
    summary="List supplier responses for a request",
)
async def list_responses(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EmailMessageResponse]:
    """Return all supplier email messages linked to the request."""
    await get_request_or_404(request_id, session, current_user)
    responses = await EmailMessageDAO.get_by_request(session, request_id)
    return [EmailMessageResponse.from_orm_with_supplier(r) for r in responses]


@router.get(
    "/{request_id}/threads",
    response_model=list[ThreadSummary],
    summary="List email threads for a request",
)
async def list_threads(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[ThreadSummary]:
    """Return thread summaries for suppliers that have at least one message."""
    request = await get_request_or_404(request_id, session, current_user)
    if request.is_demo:
        for message in await deliver_due_follow_ups(session, request):
            await queue_email_analysis(
                session, message.id, request, reanalyze=False
            )
    rows = await EmailMessageDAO.get_threads_summary(session, request_id)
    return [ThreadSummary.from_row(row) for row in rows]


@router.get(
    "/{request_id}/suppliers/{rs_id}/messages",
    response_model=list[Message],
    summary="Full chronological thread for one supplier",
)
async def list_thread_messages(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[Message]:
    """Return the full message thread for one request-supplier link."""
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    await get_request_or_404(request_id, session, current_user)
    messages = await EmailMessageDAO.get_thread_by_request_supplier_id(
        session, rs_id, with_analysis=True
    )
    return [_message_out(view) for view in build_thread(messages)]


def _message_out(view: MessageView) -> Message:
    summary = None
    if view.summary is not None:
        summary = LetterSummaryOut(
            status=view.summary.status,
            facts=[
                SummaryFactOut(
                    requirement=f.requirement,
                    value=f.value,
                    status=f.status,
                    previous=f.previous,
                    changed=f.changed,
                )
                for f in view.summary.facts
            ],
            met=view.summary.met,
            total=view.summary.total,
            changed=view.summary.changed,
            unread_files=view.summary.unread_files,
        )
    return Message(
        id=view.id,
        direction=view.direction,
        subject=view.subject,
        raw_body=view.raw_body,
        attachments=[ThreadAttachment(**asdict(a)) for a in view.attachments]
        or None,
        received_at=view.received_at,
        kind=view.kind,
        body_text=view.body_text,
        quoted_text=view.quoted_text,
        to_email=view.to_email,
        from_email=view.from_email,
        is_decline=view.is_decline,
        summary=summary,
    )


@router.post(
    "/{request_id}/suppliers/{rs_id}/mark-read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark supplier thread as read",
)
async def mark_supplier_thread_read(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Record that the user opened and read the supplier email thread."""
    await get_request_or_404(request_id, session, current_user)
    updated = await RequestSupplierDAO.mark_thread_read(
        session,
        request_id,
        rs_id,
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{request_id}/suppliers/{rs_id}/star",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Put or take off the star on a supplier thread",
)
async def set_supplier_thread_star(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: StarPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """The buyer's own mark on a thread; changes nothing for the supplier."""
    await get_request_or_404(request_id, session, current_user)
    updated = await RequestSupplierDAO.set_starred(
        session, request_id, rs_id, payload.starred
    )
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


async def _store_demo_letter(
    rs,
    *,
    subject: str | None,
    body: str,
    session: AsyncSession,
) -> dict:
    """Sample request: keep the letter in the thread, send nothing.

    The sample supplier's answer is delivered by the feed refresh after a
    short pause (see deliver_due_follow_ups).
    """
    await record_demo_outgoing(session, rs, subject=subject, body=body)
    return {"status": "queued", "rs_id": str(rs.id), "demo": True}


@router.post(
    "/{request_id}/suppliers/{rs_id}/reply",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue an outgoing reply in the thread",
)
async def post_reply(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: ReplyPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send a reply in an existing supplier thread."""
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )
    await get_request_or_404(request_id, session, current_user)

    if not payload.body or not payload.body.strip():
        raise HTTPException(
            status_code=400, detail="Reply body cannot be empty"
        )

    if rs.request.is_demo:
        return await _store_demo_letter(
            rs, subject=None, body=payload.body.strip(), session=session
        )

    await ensure_can_send_emails(session, current_user, pending_count=1)

    send_reply.delay(
        str(rs_id),
        payload.body,
        payload.attachment_paths,
    )  # type: ignore
    return {"status": "queued", "rs_id": str(rs_id)}


ZIP_MAX_BYTES = 200 * 1024 * 1024


async def _thread_for_user(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: AsyncSession,
    current_user: User,
):
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found for this request",
        )
    await get_request_or_404(request_id, session, current_user)
    return rs


def _zip_name(used: set[str], received_at, filename: str) -> str:
    """Unique name inside the archive: date prefix, then a counter."""
    prefix = received_at.strftime("%Y-%m-%d") if received_at else "без даты"
    base = f"{prefix} {filename}"
    name = base
    n = 2
    while name.lower() in used:
        stem, dot, ext = base.rpartition(".")
        name = f"{stem} ({n}).{ext}" if dot else f"{base} ({n})"
        n += 1
    used.add(name.lower())
    return name


@router.get(
    "/{request_id}/suppliers/{rs_id}/attachments.zip",
    summary="All files of one supplier thread as a ZIP archive",
)
async def download_thread_attachments(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
    config: Annotated[Config, Depends(get_config_instance)],
    message_id: Annotated[
        uuid.UUID | None,
        Query(description="Only the files of this letter"),
    ] = None,
) -> Response:
    rs = await _thread_for_user(request_id, rs_id, session, current_user)
    messages = await EmailMessageDAO.get_thread_by_request_supplier_id(
        session, rs_id
    )
    if message_id is not None:
        messages = [m for m in messages if m.id == message_id]
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found in this thread",
            )

    files: list[tuple[str, Path]] = []
    used: set[str] = set()
    total = 0
    for message in messages:
        if (
            message.kind
        ):  # robot notices and forwards carry copies, not new files
            continue
        for att in message.attachments or []:
            if not isinstance(att, dict) or not att.get("path"):
                continue
            candidate = _resolve_and_validate_attachment_path(
                str(att["path"]), config.upload_dir
            )
            if candidate is None:
                continue
            total += candidate.stat().st_size
            if total > ZIP_MAX_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Files are too large for one archive; download them one by one",
                )
            name = _zip_name(
                used,
                message.received_at,
                str(att.get("filename") or candidate.name),
            )
            files.append((name, candidate))
    if not files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No downloadable files in this thread",
        )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, path in files:
            archive.write(path, arcname=name)
    company = rs.supplier.company_name if rs.supplier else "поставщик"
    archive_name = f"Файлы — {company}.zip"
    ascii_fallback = "attachments.zip"
    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_fallback}"; '
                f"filename*=UTF-8''{quote(archive_name)}"
            )
        },
    )


@router.post(
    "/{request_id}/suppliers/{rs_id}/messages/{message_id}/forward",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Forward one supplier letter to a colleague",
)
async def forward_message(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    message_id: uuid.UUID,
    payload: ForwardPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Send a copy of a supplier letter from the user's mailbox.

    The copy is a sent email and counts towards the monthly email limit.
    """
    rs = await _thread_for_user(request_id, rs_id, session, current_user)
    message = await EmailMessageDAO.get_by_id(session, message_id)
    if not message or message.request_supplier_id != rs_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found in this thread",
        )
    if message.kind in (
        MessageKind.FORWARD.value,
        MessageKind.COLLEAGUE_REPLY.value,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A forward cannot be forwarded again",
        )
    if rs.request.is_demo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Это пример: пересылать его письма нельзя",
        )
    await ensure_can_send_emails(session, current_user, pending_count=1)
    send_forward.delay(  # type: ignore[attr-defined]
        str(message_id),
        str(payload.to_email),
        (payload.comment or "").strip(),
        payload.include_attachments,
    )
    return {"status": "queued", "message_id": str(message_id)}


async def _queue_custom_supplier_email(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: AsyncSession,
    current_user: User,
) -> dict:
    rs = await RequestSupplierDAO.get_by_id(session, rs_id)
    if not rs or str(rs.request_id) != str(request_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request supplier not found",
        )
    await get_request_or_404(request_id, session, current_user)

    if not payload.subject.strip() or not payload.body.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subject and body cannot be empty",
        )

    if rs.request.is_demo:
        return await _store_demo_letter(
            rs,
            subject=payload.subject.strip(),
            body=payload.body.strip(),
            session=session,
        )

    await ensure_can_send_emails(session, current_user, pending_count=1)

    send_custom_email.delay(  # type: ignore[attr-defined]
        str(rs_id),
        payload.subject.strip(),
        payload.body.strip(),
        payload.attachment_paths,
    )
    return {"status": "queued", "rs_id": str(rs_id)}


@router.post(
    "/{request_id}/suppliers/{rs_id}/improvement-request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue improvement request email to supplier",
)
async def post_improvement_request(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send an improvement request in the thread."""
    return await _queue_custom_supplier_email(
        request_id, rs_id, payload, session, current_user
    )


@router.post(
    "/{request_id}/suppliers/{rs_id}/winner-notification",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue winner notification email to supplier",
)
async def post_winner_notification(
    request_id: uuid.UUID,
    rs_id: uuid.UUID,
    payload: CustomEmailPayload,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Queue Celery task to send a winner notification in the thread."""
    result = await _queue_custom_supplier_email(
        request_id, rs_id, payload, session, current_user
    )
    await RequestSupplierDAO.set_winner(session, request_id, rs_id)
    return result


@router.delete(
    "/{request_id}/winner",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear confirmed winner for the request",
)
async def delete_winner(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Allow choosing another winner after clearing the current selection."""
    await get_request_or_404(request_id, session, current_user)
    await RequestSupplierDAO.clear_winner(session, request_id)


@router.get(
    "/{request_id}/analysis/comparison",
    response_model=ComparisonResponse,
    summary="Compare supplier responses by request requirements",
)
async def get_analysis_comparison(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> ComparisonResponse:
    request = await get_request_or_404(request_id, session, current_user)
    return await _build_comparison(session, request)


@router.get(
    "/{request_id}/analysis/comparison.xlsx",
    summary="Export supplier comparison as XLSX",
)
async def export_analysis_comparison_xlsx(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> Response:
    request = await get_request_or_404(request_id, session, current_user)
    comparison = await _build_comparison(session, request)

    wb = build_comparison_workbook(
        requirements=comparison.requirements,
        suppliers=comparison.suppliers,
        status_labels=STATUS_LABELS,
    )

    filename = f"request_{request_id}_comparison.xlsx"
    return Response(
        content=workbook_to_bytes(wb),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/{request_id}/analysis/refresh-all",
    response_model=RefreshAllResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Queue analysis for all unanalyzed incoming messages",
)
async def refresh_all_analysis(
    request_id: uuid.UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> RefreshAllResponse:
    request = await get_request_or_404(request_id, session, current_user)
    if not _requirements_list(request):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В запросе нет обязательных параметров — сравнивать нечего",
        )

    enabled = await RequestSupplierDAO.get_enabled_by_request(
        session, request_id
    )
    queued = 0
    for rs in enabled:
        latest = (
            await EmailMessageDAO.get_latest_incoming_by_request_supplier_id(
                session, rs.id
            )
        )
        if not latest:
            continue

        if await queue_email_analysis(
            session, latest.id, request, reanalyze=False
        ):
            queued += 1

    logger.info(
        "Bulk email analysis queued",
        request_id=str(request_id),
        queued=queued,
    )
    return RefreshAllResponse(queued=queued)
