"""Add bePaid auto-renew fields on subscriptions and payments.

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-09-04 20:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "q2r3s4t5u6v7"
down_revision: str | Sequence[str] | None = "p1q2r3s4t5u6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column(
            "auto_renew",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "bepaid_subscription_id", sa.String(length=64), nullable=True
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "bepaid_renew_at", sa.DateTime(timezone=True), nullable=True
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "last_bepaid_transaction_uid",
            sa.String(length=64),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_subscriptions_bepaid_subscription_id",
        "subscriptions",
        ["bepaid_subscription_id"],
        unique=False,
    )
    op.add_column(
        "subscription_payments",
        sa.Column(
            "bepaid_subscription_id", sa.String(length=64), nullable=True
        ),
    )


def downgrade() -> None:
    op.drop_column("subscription_payments", "bepaid_subscription_id")
    op.drop_index(
        "ix_subscriptions_bepaid_subscription_id",
        table_name="subscriptions",
    )
    op.drop_column("subscriptions", "last_bepaid_transaction_uid")
    op.drop_column("subscriptions", "bepaid_renew_at")
    op.drop_column("subscriptions", "bepaid_subscription_id")
    op.drop_column("subscriptions", "auto_renew")
