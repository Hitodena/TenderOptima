"""Add subscription_payments for bePaid checkout.

Revision ID: a1b2c3d4e5f7
Revises: h8i9j0k1l2m3
Create Date: 2026-08-05 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f7"
down_revision: str | Sequence[str] | None = "h8i9j0k1l2m3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subscription_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "subscription_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("tracking_id", sa.String(length=64), nullable=False),
        sa.Column("method", sa.String(length=16), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency_code", sa.String(length=8), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("receipt_id", sa.String(length=64), nullable=False),
        sa.Column("bepaid_token", sa.String(length=128), nullable=True),
        sa.Column("bepaid_uid", sa.String(length=64), nullable=True),
        sa.Column("redirect_url", sa.String(length=1024), nullable=True),
        sa.Column(
            "raw_notification",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tracking_id"),
    )
    op.create_index(
        "ix_subscription_payments_user_id",
        "subscription_payments",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_subscription_payments_user_id",
        table_name="subscription_payments",
    )
    op.drop_table("subscription_payments")
