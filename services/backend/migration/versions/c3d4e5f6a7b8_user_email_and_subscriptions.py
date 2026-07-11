"""Add user email settings and restructure subscriptions.

Revision ID: c3d4e5f6a7b8
Revises: f5a6b7c8d9e0
Create Date: 2026-06-22 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("smtp_host", sa.String(), nullable=True))
    op.add_column("users", sa.Column("smtp_user", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("smtp_password", sa.String(), nullable=True)
    )
    op.add_column("users", sa.Column("imap_host", sa.String(), nullable=True))
    op.add_column("users", sa.Column("imap_user", sa.String(), nullable=True))
    op.add_column(
        "users", sa.Column("imap_password", sa.String(), nullable=True)
    )

    op.drop_constraint("subscriptions_plan_key", "subscriptions", type_="unique")

    op.add_column(
        "subscriptions",
        sa.Column(
            "module_1_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "module_2_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column("max_searches_per_month", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("max_emails_per_month", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("max_kp_processed_per_month", sa.Integer(), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "geo_code",
            sa.String(length=8),
            nullable=False,
            server_default="BY",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "currency_code",
            sa.String(length=8),
            nullable=False,
            server_default="BYN",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "price_module_1_monthly",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "price_module_2_monthly",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "price_bundle_monthly",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET plan = 'starter',
                module_1_enabled = true,
                module_2_enabled = false,
                max_searches_per_month = COALESCE(max_requests_per_month, 50),
                max_emails_per_month = COALESCE(max_mailings_per_request, 1000),
                price_module_1_monthly = 160,
                price_module_2_monthly = 220,
                price_bundle_monthly = 360
            WHERE plan IS NOT NULL
            """
        )
    )

    op.drop_column("subscriptions", "max_requests_per_month")
    op.drop_column("subscriptions", "max_suppliers_per_request")
    op.drop_column("subscriptions", "max_mailings_per_request")


def downgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column(
            "max_mailings_per_request",
            sa.Integer(),
            nullable=False,
            server_default="20",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "max_suppliers_per_request",
            sa.Integer(),
            nullable=False,
            server_default="20",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "max_requests_per_month",
            sa.Integer(),
            nullable=False,
            server_default="3",
        ),
    )

    op.drop_column("subscriptions", "price_bundle_monthly")
    op.drop_column("subscriptions", "price_module_2_monthly")
    op.drop_column("subscriptions", "price_module_1_monthly")
    op.drop_column("subscriptions", "currency_code")
    op.drop_column("subscriptions", "geo_code")
    op.drop_column("subscriptions", "max_kp_processed_per_month")
    op.drop_column("subscriptions", "max_emails_per_month")
    op.drop_column("subscriptions", "max_searches_per_month")
    op.drop_column("subscriptions", "module_2_enabled")
    op.drop_column("subscriptions", "module_1_enabled")

    op.create_unique_constraint(
        "subscriptions_plan_key", "subscriptions", ["plan"]
    )

    op.drop_column("users", "imap_password")
    op.drop_column("users", "imap_user")
    op.drop_column("users", "imap_host")
    op.drop_column("users", "smtp_password")
    op.drop_column("users", "smtp_user")
    op.drop_column("users", "smtp_host")
