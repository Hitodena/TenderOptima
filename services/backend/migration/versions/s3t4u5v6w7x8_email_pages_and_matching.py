"""Add email ports, page quotas, and email matching metadata.

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-07-08 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "s3t4u5v6w7x8"
down_revision: str | Sequence[str] | None = "r2s3t4u5v6w7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("imap_port", sa.Integer(), nullable=True))

    op.add_column(
        "subscriptions",
        sa.Column("max_pages_analyzed_per_month", sa.Integer(), nullable=True),
    )
    op.execute(
        sa.text(
            """
            UPDATE subscriptions
            SET max_pages_analyzed_per_month = COALESCE(max_kp_processed_per_month, 0) * 20
            WHERE max_kp_processed_per_month IS NOT NULL
            """
        )
    )

    op.add_column(
        "tz_analyses",
        sa.Column(
            "tz_pages_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "tz_analysis_suppliers",
        sa.Column(
            "kp_pages_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.add_column(
        "email_messages",
        sa.Column("from_email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "email_messages",
        sa.Column("to_email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "email_messages",
        sa.Column("mailbox_email", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "email_messages",
        sa.Column("matched_by", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "email_messages",
        sa.Column("match_confidence", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("email_messages", "match_confidence")
    op.drop_column("email_messages", "matched_by")
    op.drop_column("email_messages", "mailbox_email")
    op.drop_column("email_messages", "to_email")
    op.drop_column("email_messages", "from_email")
    op.drop_column("tz_analysis_suppliers", "kp_pages_count")
    op.drop_column("tz_analyses", "tz_pages_count")
    op.drop_column("subscriptions", "max_pages_analyzed_per_month")
    op.drop_column("users", "imap_port")
    op.drop_column("users", "smtp_port")
