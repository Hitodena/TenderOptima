import asyncio

import click
from loguru import logger

from app.core import get_config
from app.db.dao import UserDAO
from app.db.models import User
from app.services.db_service import db_manager
from app.utils.security import hash_password

config = get_config()


async def create_user_async(
    email: str,
    password: str,
    full_name: str | None,
    company_name: str | None,
    admin: bool,
) -> User:
    db_manager.init(config.build_db_url())
    async with db_manager.session() as session:
        existing = await UserDAO.get_by_email(session, email)
        if existing:
            raise click.ClickException(
                f"User with email {email} already exists"
            )
        hashed = hash_password(password)
        user = await UserDAO.create(
            session,
            email=email,
            hashed_password=hashed,
            full_name=full_name,
            company_name=company_name,
            is_admin=admin,
        )
        return user


@click.command()
@click.option("--email", required=True, help="User email")
@click.option("--password", required=True, help="Plain text password")
@click.option("--full-name", default=None, help="Full name")
@click.option("--company-name", default=None, help="Company name")
@click.option("--admin", is_flag=True, help="Make user admin")
def create_user(
    email: str,
    password: str,
    full_name: str | None,
    company_name: str | None,
    admin: bool,
) -> None:
    user = asyncio.run(
        create_user_async(email, password, full_name, company_name, admin)
    )
    logger.info(f"User created: {user.id}")
    click.echo(f"User created with ID: {user.id}")
