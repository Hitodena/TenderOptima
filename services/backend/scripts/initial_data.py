"""Run idempotent data seeds after Alembic migrations."""

import asyncio

from backend.scripts.basic_email_templates import seed_basic_email_templates
from backend.scripts.seed_subscriptions import seed_subscription_defaults


async def seed_initial_data() -> None:
    """Seed global defaults required by a fresh or migrated installation."""
    await seed_basic_email_templates()
    await seed_subscription_defaults()


def main() -> None:
    asyncio.run(seed_initial_data())


if __name__ == "__main__":
    main()
