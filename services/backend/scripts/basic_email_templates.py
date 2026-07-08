"""Seed global email templates (idempotent). Run after Alembic migrations."""

import asyncio

from loguru import logger
from sqlalchemy import select

from backend.core.config import get_config
from backend.db.models.email_template import EmailTemplate
from backend.services.db_service import db_manager

BASIC_EMAIL_TEMPLATES: list[dict[str, str]] = [
    {
        "title": "Ответ о получении",
        "subject": "Подтверждение получения",
        "body": (
            "Благодарим за предоставленную информацию. Мы обработаем ваше "
            "коммерческое предложение и направим ответ в ближайшее время."
        ),
    },
    {
        "title": "Запрос на улучшение условий",
        "subject": "Предложение об улучшении условий",
        "body": (
            "Добрый день.\n"
            "В рамках текущей закупки мы получили ряд предложений. "
            "Ваше предложение - среди ключевых и находится на рассмотрении.\n\n"
            "Поскольку цена является для нас одним из ключевых факторов "
            "выбора, текущие условия не позволяют нам сделать выбор в вашу "
            "пользу.\n\n"
            "В рамках процедуры закупки предлагаем улучшить условия вашего "
            "предложения и предоставить ваше обновленное предложение в "
            "течение 3 рабочих дней."
        ),
    },
    {
        "title": "Дожим",
        "subject": "Уточнение условий закупки",
        "body": (
            "Добрый день.\n\n"
            "Мы проводим финальный раунд переговоров.\n\n"
            "Для заключения контракта нам необходимо вписаться в целевой "
            "показатель [X рублей за единицу].\n"
            "Мы понимаем, что это может потребовать от вас пересмотра "
            "калькуляции.\n\n"
            "Если вы сможете найти способ предложить цену, максимально "
            "приближенную к этому уровню, мы готовы немедленно подписать "
            "контракт.\n"
            "Ждем ваш окончательный ответ в течение следующего рабочего дня."
        ),
    },
    {
        "title": "Уведомление победителю",
        "subject": "Поздравляем! Ваше предложение признано лучшим",
        "body": (
            "Добрый день.\n\n"
            "Поздравляем! Ваше коммерческое предложение признано лучшим "
            "в рамках проведённого тендера.\n\n"
            "Мы готовы заключить с вами договор на поставку товаров/услуг "
            "на условиях, указанных в вашем предложении."
        ),
    },
]


async def seed_basic_email_templates() -> None:
    """Insert global templates that are not already present (matched by title)."""
    config = get_config()
    db_manager.init(config.build_db_url())

    try:
        async with db_manager.session() as session:
            for tpl in BASIC_EMAIL_TEMPLATES:
                existing = await session.execute(
                    select(EmailTemplate).where(
                        EmailTemplate.is_global.is_(True),
                        EmailTemplate.title == tpl["title"],
                    )
                )
                if existing.scalar_one_or_none():
                    logger.info(
                        "Global email template already exists",
                        title=tpl["title"],
                    )
                    continue

                session.add(
                    EmailTemplate(
                        user_id=None,
                        is_global=True,
                        title=tpl["title"],
                        subject=tpl["subject"],
                        body=tpl["body"],
                    )
                )
                logger.info("Seeded global email template", title=tpl["title"])

            await session.commit()
    finally:
        await db_manager.close()


def main() -> None:
    asyncio.run(seed_basic_email_templates())


if __name__ == "__main__":
    main()
