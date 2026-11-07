"""Mark delivery reports and auto replies that arrived before email_messages.kind.

Letters stored earlier have kind NULL, so an old "Undelivered Mail" shows as
a supplier answer. Headers were not stored, so only the sender and the
subject are checked (the same rules as at ingest, without the MIME part).

    python -m backend.scripts.backfill_message_kind            # dry run
    python -m backend.scripts.backfill_message_kind --apply    # write

A request-supplier whose only "answers" were failure reports gets status
"failed", the same as for a new failure report.
"""

import argparse
import asyncio
from collections import Counter

from loguru import logger
from sqlalchemy import select

from backend.core.config import get_config
from backend.db.models import EmailMessage, RequestSupplier
from backend.enums import EmailMessageDirection, RequestSupplierStatus
from backend.services.db_service import db_manager
from backend.utils.email_content import MessageKind, classify_message


async def backfill(apply: bool) -> Counter:
    config = get_config()
    db_manager.init(config.build_db_url())
    stats: Counter = Counter()
    try:
        async with db_manager.session() as session:
            rows = (
                await session.execute(
                    select(EmailMessage).where(
                        EmailMessage.direction
                        == EmailMessageDirection.INCOMING.value,
                        EmailMessage.kind.is_(None),
                    )
                )
            ).scalars()
            bounced_rs: set = set()
            robot_ids: set = set()
            for message in rows:
                kind = classify_message(
                    subject=message.subject,
                    from_email=message.from_email,
                )
                stats["checked"] += 1
                if kind is None:
                    continue
                stats[kind.value] += 1
                logger.info(
                    "Robot letter",
                    kind=kind.value,
                    message_id=str(message.id),
                    subject=message.subject,
                    sender=message.from_email,
                )
                robot_ids.add(message.id)
                if apply:
                    message.kind = kind.value
                if kind == MessageKind.BOUNCE:
                    bounced_rs.add(message.request_supplier_id)

            if apply:
                await session.flush()
            for rs_id in bounced_rs:
                has_reply = (
                    await session.execute(
                        select(EmailMessage.id)
                        .where(
                            EmailMessage.request_supplier_id == rs_id,
                            EmailMessage.direction
                            == EmailMessageDirection.INCOMING.value,
                            EmailMessage.kind.is_(None),
                            # in a dry run the robots are not marked yet
                            EmailMessage.id.notin_(robot_ids or {None}),
                        )
                        .limit(1)
                    )
                ).first()
                if has_reply:
                    continue
                rs = await session.get(RequestSupplier, rs_id)
                if rs and rs.sent_status != RequestSupplierStatus.FAILED.value:
                    stats["suppliers_marked_failed"] += 1
                    if apply:
                        rs.sent_status = RequestSupplierStatus.FAILED.value
            if apply:
                await session.commit()
            else:
                await session.rollback()
    finally:
        await db_manager.close()
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--apply", action="store_true", help="write changes (default: dry run)"
    )
    args = parser.parse_args()
    stats = asyncio.run(backfill(args.apply))
    mode = "applied" if args.apply else "dry run, nothing written"
    print(f"{mode}: {dict(stats)}")


if __name__ == "__main__":
    main()
