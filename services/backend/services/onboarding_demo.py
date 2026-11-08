"""Sample request of the onboarding tour.

A new user sees real search results, then a sample request built from the
same query: six fictional suppliers ("Поставщик А" … "Поставщик Е") and their
letters. The letters are written here from templates; everything after that
is the real service — the same feed, the same AI analysis, the same
comparison table. Nothing is sent outside and nothing counts towards limits:
the request is marked ``is_demo``.

Supplier roles (stored in ``Supplier.comments`` as ``demo:<role>``):

* full     — complete offer
* gaps     — offer without delivery time and warranty; answers the
             «Запросить недостающее» letter with the missing data
* pricey   — complete offer, higher price, asks a question at the end
* auto     — out-of-office auto reply
* refusal  — cannot supply
* silent   — no answer yet
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.db.models import (
    EmailMessage,
    Request,
    RequestSupplier,
    Supplier,
    User,
)
from backend.enums import (
    EmailMessageDirection,
    RequestStatus,
    RequestSupplierStatus,
    SupplierSource,
)
from backend.utils.email_content import MessageKind

DEMO_REQUIREMENTS = [
    "Цена за единицу без НДС",
    "Общая стоимость без НДС",
    "Сроки поставки",
    "Условия оплаты",
    "Условия поставки",
    "Гарантия",
]

DEMO_ROLE_PREFIX = "demo:"
FOLLOW_UP_DELAY_SECONDS = 20


@dataclass(frozen=True)
class DemoSupplier:
    role: str
    name: str
    mailbox: str
    contact: str


DEMO_SUPPLIERS = [
    DemoSupplier("full", "Поставщик А", "sales", "Ирина, отдел продаж"),
    DemoSupplier("gaps", "Поставщик Б", "info", "Алексей, менеджер"),
    DemoSupplier("pricey", "Поставщик В", "opt", "Отдел оптовых продаж"),
    DemoSupplier("auto", "Поставщик Г", "office", ""),
    DemoSupplier("refusal", "Поставщик Д", "zakaz", "Сергей"),
    DemoSupplier("silent", "Поставщик Е", "mail", ""),
]


def _letter(role: str, product: str, contact: str) -> str | None:
    """Text of the supplier's first answer, or None for silence."""
    sign = f"\n\nС уважением,\n{contact}" if contact else ""
    if role == "full":
        return (
            "Добрый день!\n\n"
            f"Благодарим за запрос. Предлагаем: {product}.\n"
            "Цена за единицу — 98,50 руб. без НДС.\n"
            "Общая стоимость партии 100 ед. — 9 850,00 руб. без НДС.\n"
            "Сроки поставки — 3 рабочих дня с момента оплаты, товар в наличии.\n"
            "Условия оплаты — 50 % предоплата, 50 % по факту поставки.\n"
            "Условия поставки — доставка до вашего склада за наш счёт.\n"
            "Гарантия — 12 месяцев." + sign
        )
    if role == "gaps":
        return (
            "Здравствуйте!\n\n"
            f"По вашему запросу ({product}) можем предложить цену "
            "94,00 руб. за единицу без НДС, партия 100 ед. — "
            "9 400,00 руб. без НДС.\n"
            "Оплата — 100 % предоплата.\n"
            "Доставка — самовывоз со склада или транспортной компанией "
            "за счёт покупателя." + sign
        )
    if role == "pricey":
        return (
            "Добрый день!\n\n"
            f"Направляем коммерческое предложение: {product}.\n"
            "Цена за единицу — 104,20 руб. без НДС, партия 100 ед. — "
            "10 420,00 руб. без НДС.\n"
            "Срок поставки — 7 рабочих дней.\n"
            "Оплата — отсрочка 14 дней.\n"
            "Доставка — включена в стоимость.\n"
            "Гарантия — 24 месяца.\n\n"
            "Подскажите, пожалуйста, нужна ли разгрузка на месте?" + sign
        )
    if role == "auto":
        return (
            "Здравствуйте! Я в отпуске до конца месяца и не отвечаю на "
            "письма. По срочным вопросам пишите в общий отдел продаж."
        )
    if role == "refusal":
        return (
            "Добрый день.\n\n"
            "Спасибо за запрос, но предложить эту позицию сейчас не можем — "
            "её нет в наличии и у производителя." + sign
        )
    return None


def _follow_up(role: str, contact: str) -> str | None:
    """Answer to the user's letter in the sample thread."""
    sign = f"\n\nС уважением,\n{contact}" if contact else ""
    if role == "gaps":
        return (
            "Добрый день!\n\n"
            "Дополняем предложение по вашим вопросам.\n"
            "Сроки поставки — 5 рабочих дней с момента оплаты, "
            "60 ед. на складе, остальное под заказ.\n"
            "Гарантия — 12 месяцев.\n"
            "Цена и остальные условия — без изменений: 94,00 руб. за единицу "
            "без НДС, партия 100 ед. — 9 400,00 руб. без НДС." + sign
        )
    if role in ("full", "pricey"):
        return (
            "Добрый день! Письмо получили, спасибо. Если нужно что-то ещё — пишите."
            + sign
        )
    return None


def demo_role(supplier: Supplier | None) -> str | None:
    comment = (supplier.comments or "") if supplier else ""
    if comment.startswith(DEMO_ROLE_PREFIX):
        return comment[len(DEMO_ROLE_PREFIX) :]
    return None


def _request_letter(product: str, region: str) -> str:
    return (
        "Добрый день!\n\n"
        f"Просим направить коммерческое предложение: {product}.\n"
        f"Регион поставки — {region}.\n"
        "В предложении укажите: цену за единицу и общую стоимость без НДС, "
        "сроки и условия поставки, условия оплаты, гарантию.\n\n"
        "Спасибо!"
    )


async def get_user_demo_request(
    session: AsyncSession, user_id: uuid.UUID
) -> Request | None:
    stmt = (
        select(Request)
        .where(Request.user_id == user_id, Request.is_demo.is_(True))
        .order_by(Request.created_at.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def create_demo_request(
    session: AsyncSession,
    user: User,
    source: Request,
) -> tuple[Request, list[uuid.UUID]]:
    """Build the sample request for ``source``.

    Returns the request and the ids of incoming letters that need AI
    analysis. One sample per account: an existing one is returned as is.
    """
    existing = await get_user_demo_request(session, user.id)
    if existing is not None:
        return existing, []

    product = source.query.strip()
    region = source.delivery_region
    subject = f"Запрос коммерческого предложения — {product}"
    outgoing_body = _request_letter(product, region)
    now = datetime.now(UTC)
    sent_at = now - timedelta(hours=3)

    request = Request(
        user_id=user.id,
        query=product,
        delivery_region=region,
        description=product,
        additional_params=list(DEMO_REQUIREMENTS),
        email_subject=subject,
        email_message=outgoing_body,
        status=RequestStatus.COMPLETED.value,
        is_demo=True,
    )
    session.add(request)
    await session.flush()

    to_analyze: list[uuid.UUID] = []
    for index, spec in enumerate(DEMO_SUPPLIERS):
        token = uuid.uuid4().hex[:10]
        address = f"{spec.mailbox}-{token}@example.com"
        supplier = Supplier(
            company_name=spec.name,
            main_email=address,
            domain=None,
            from_source=SupplierSource.DEMO.value,
            comments=f"{DEMO_ROLE_PREFIX}{spec.role}",
            added_by_user_id=user.id,
        )
        session.add(supplier)
        await session.flush()

        answer = _letter(spec.role, product, spec.contact)
        rs = RequestSupplier(
            request_id=request.id,
            supplier_id=supplier.id,
            sent_to_email=address,
            sent_at=sent_at,
            body_text=outgoing_body,
            sent_status=(
                RequestSupplierStatus.REPLIED.value
                if answer and spec.role != "auto"
                else RequestSupplierStatus.SENT.value
            ),
            is_enabled=True,
        )
        session.add(rs)
        await session.flush()

        session.add(
            EmailMessage(
                request_supplier_id=rs.id,
                direction=EmailMessageDirection.OUTGOING.value,
                subject=subject,
                raw_body=outgoing_body,
                received_at=sent_at,
                to_email=address,
            )
        )
        if answer is None:
            continue
        incoming = EmailMessage(
            request_supplier_id=rs.id,
            direction=EmailMessageDirection.INCOMING.value,
            kind=MessageKind.AUTO_REPLY.value if spec.role == "auto" else None,
            subject=f"Re: {subject}",
            raw_body=answer,
            extracted_text=answer,
            received_at=sent_at + timedelta(minutes=40 + index * 17),
            from_email=address,
        )
        session.add(incoming)
        await session.flush()
        if spec.role != "auto":
            to_analyze.append(incoming.id)

    await session.commit()
    await session.refresh(request)
    logger.info(
        "Demo request created",
        request_id=str(request.id),
        user_id=str(user.id),
        letters=len(to_analyze),
    )
    return request, to_analyze


async def record_demo_outgoing(
    session: AsyncSession,
    rs: RequestSupplier,
    *,
    subject: str | None,
    body: str,
) -> EmailMessage:
    """Store the user's letter in a sample thread without sending it."""
    request = rs.request
    message = EmailMessage(
        request_supplier_id=rs.id,
        direction=EmailMessageDirection.OUTGOING.value,
        subject=subject or f"Re: {request.email_subject or request.query}",
        raw_body=body,
        received_at=datetime.now(UTC),
        to_email=rs.sent_to_email,
    )
    session.add(message)
    await session.commit()
    await session.refresh(message)
    return message


def follow_up_due(
    thread: list[EmailMessage], role: str | None, now: datetime
) -> bool:
    """Should the sample supplier answer now?

    A sample supplier answers only the user's first letter after the request
    letter (the demo is a tour, not a chat bot), once, and
    FOLLOW_UP_DELAY_SECONDS after it — so the tour shows a letter arriving.
    """
    if _follow_up(role or "", "") is None:
        return False
    ordered = sorted(
        thread,
        key=lambda m: m.received_at or datetime.min.replace(tzinfo=UTC),
    )
    outgoing = [
        m
        for m in ordered
        if m.direction == EmailMessageDirection.OUTGOING.value
    ]
    if len(outgoing) < 2:
        return False
    asked = outgoing[1]
    asked_at = asked.received_at
    if asked_at is None:
        return False
    if asked_at.tzinfo is None:
        asked_at = asked_at.replace(tzinfo=UTC)
    answered = any(
        m.direction == EmailMessageDirection.INCOMING.value
        and m.received_at is not None
        and (
            m.received_at
            if m.received_at.tzinfo
            else m.received_at.replace(tzinfo=UTC)
        )
        > asked_at
        for m in ordered
    )
    if answered:
        return False
    return (now - asked_at).total_seconds() >= FOLLOW_UP_DELAY_SECONDS


async def deliver_due_follow_ups(
    session: AsyncSession, request: Request
) -> list[EmailMessage]:
    """Store sample answers whose time has come.

    Called when the page refreshes the feed, so no delayed worker task is
    needed. Returns the new letters; the caller queues their AI analysis.
    """
    if not request.is_demo:
        return []
    stmt = (
        select(RequestSupplier)
        .where(RequestSupplier.request_id == request.id)
        .options(
            selectinload(RequestSupplier.supplier),
            selectinload(RequestSupplier.email_messages),
        )
    )
    rows = list((await session.execute(stmt)).scalars().all())
    now = datetime.now(UTC)
    delivered: list[EmailMessage] = []
    for rs in rows:
        role = demo_role(rs.supplier)
        if not follow_up_due(list(rs.email_messages), role, now):
            continue
        contact = next(
            (s.contact for s in DEMO_SUPPLIERS if s.role == role), ""
        )
        text = _follow_up(role or "", contact)
        if text is None:
            continue
        message = EmailMessage(
            request_supplier_id=rs.id,
            direction=EmailMessageDirection.INCOMING.value,
            subject=f"Re: {request.email_subject or request.query}",
            raw_body=text,
            extracted_text=text,
            received_at=now,
            from_email=rs.sent_to_email,
        )
        session.add(message)
        rs.sent_status = RequestSupplierStatus.REPLIED.value
        delivered.append(message)
    if delivered:
        await session.commit()
        for message in delivered:
            await session.refresh(message)
        logger.info(
            "Demo follow-ups delivered",
            request_id=str(request.id),
            count=len(delivered),
        )
    return delivered
