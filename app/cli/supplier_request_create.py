import asyncio
import uuid

import click
from loguru import logger

from app.core import get_config
from app.db.dao import RequestDAO, RequestSupplierDAO, SupplierDAO
from app.db.models import RequestSupplier, Supplier
from app.services.db_service import db_manager

config = get_config()


async def create_supplier_request_async(
    request_id: uuid.UUID,
    supplier_domain: str,
    supplier_email: str,
    supplier_company_name: str,
    sent_to_email: str | None,
    body_text: str | None,
    status: str,
) -> tuple[Supplier, RequestSupplier]:
    db_manager.init(config.build_db_url())
    async with db_manager.session() as session:
        request = await RequestDAO.get_by_id(session, request_id)
        if not request:
            raise click.ClickException(
                f"Request with ID {request_id} not found"
            )
        supplier = await SupplierDAO.get_or_create_by_domain(
            session,
            domain=supplier_domain,
            defaults={
                "email": supplier_email,
                "company_name": supplier_company_name,
            },
        )
        request_supplier = await RequestSupplierDAO.create(
            session,
            request_id=request_id,
            supplier_id=supplier.id,
            sent_to_email=sent_to_email,
            body_text=body_text,
            status=status,
        )
        return supplier, request_supplier


@click.command()
@click.option(
    "--request-id", required=True, type=click.UUID, help="Request UUID"
)
@click.option("--supplier-domain", required=True, help="Supplier domain")
@click.option("--supplier-email", required=True, help="Supplier email")
@click.option("--supplier-company-name", required=True, help="Company name")
@click.option("--sent-to-email", default=None, help="Email sent to")
@click.option("--body-text", default=None, help="Email body text")
@click.option("--status", default="pending", help="Status")
def create_supplier_request(
    request_id: uuid.UUID,
    supplier_domain: str,
    supplier_email: str,
    supplier_company_name: str,
    sent_to_email: str | None,
    body_text: str | None,
    status: str,
) -> None:
    supplier, request_supplier = asyncio.run(
        create_supplier_request_async(
            request_id,
            supplier_domain,
            supplier_email,
            supplier_company_name,
            sent_to_email,
            body_text,
            status,
        )
    )
    logger.info(f"RequestSupplier created: {request_supplier.id}")
    click.echo(f"Supplier: {supplier.id}")
    click.echo(f"RequestSupplier created with ID: {request_supplier.id}")
