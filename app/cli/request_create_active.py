import asyncio
import uuid

import click
from loguru import logger

from app.core import get_config
from app.db.dao import RequestDAO, SearchHistoryDAO, UserDAO
from app.db.models import Request, SearchHistory
from app.enums import RequestStatus
from app.services.db_service import db_manager

config = get_config()


async def create_active_request_async(
    user_id: uuid.UUID,
    query: str,
    delivery_region: str,
    description: str,
) -> tuple[Request, SearchHistory]:
    db_manager.init(config.build_db_url())
    async with db_manager.session() as session:
        user = await UserDAO.get_by_id(session, user_id)
        if not user:
            raise click.ClickException(f"User with ID {user_id} not found")
        request = await RequestDAO.create(
            session,
            user_id=user_id,
            query=query,
            delivery_region=delivery_region,
            description=description,
            status=RequestStatus.ACTIVE,
        )
        search_history = await SearchHistoryDAO.create(
            session,
            user_id=user_id,
            raw_search_body={"query": query},
            query=query,
            request_id=request.id,
        )
        return request, search_history


@click.command()
@click.option("--user-id", required=True, type=click.UUID, help="User UUID")
@click.option("--query", required=True, help="Search query")
@click.option("--delivery-region", default=None, help="Delivery region")
@click.option("--description", default=None, help="Description")
@click.option("--quantity", default=None, type=int, help="Quantity")
@click.option("--unit", default=None, help="Unit")
@click.option("--max-price-per-unit", default=None, type=float, help="Price")
def create_active_request(
    user_id: uuid.UUID,
    query: str,
    delivery_region: str,
    description: str,
) -> None:
    request, search_history = asyncio.run(
        create_active_request_async(
            user_id,
            query,
            delivery_region,
            description,
        )
    )
    logger.info(f"Request created: {request.id}")
    click.echo(f"Request created with ID: {request.id}")
    click.echo(f"SearchHistory created with ID: {search_history.id}")
