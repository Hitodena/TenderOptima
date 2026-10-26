"""Add admin news announcements and per-user read receipts.

Revision ID: v7w8x9y0z1a2
Revises: u6v7w8x9y0z1
Create Date: 2026-10-27 02:27:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v7w8x9y0z1a2"
down_revision: str | Sequence[str] | None = "u6v7w8x9y0z1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "news",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("module_name", sa.String(length=100), nullable=True),
        sa.Column(
            "severity",
            sa.String(length=16),
            nullable=False,
            server_default="warning",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "created_by_admin_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_admin_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_news_created_by_admin_id",
        "news",
        ["created_by_admin_id"],
    )
    op.create_index(
        "ix_news_is_active_created_at",
        "news",
        ["is_active", "created_at"],
    )

    op.create_table(
        "news_reads",
        sa.Column("news_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "read_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["news_id"], ["news.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("news_id", "user_id"),
    )
    op.create_index("ix_news_reads_user_id", "news_reads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_news_reads_user_id", table_name="news_reads")
    op.drop_table("news_reads")
    op.drop_index("ix_news_is_active_created_at", table_name="news")
    op.drop_index("ix_news_created_by_admin_id", table_name="news")
    op.drop_table("news")
