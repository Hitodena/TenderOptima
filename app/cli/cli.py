import click

from app.cli.request_create_active import create_active_request
from app.cli.supplier_request_create import create_supplier_request
from app.cli.user_create import create_user


@click.group()
def cli() -> None:
    pass


cli.add_command(create_user)
cli.add_command(create_active_request)
cli.add_command(create_supplier_request)
