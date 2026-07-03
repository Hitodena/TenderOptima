"""Add frontend_error_logs and idea_suggestions tables.

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-07-03 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "n8o9p0q1r2s3"
down_revision: str | Sequence[str] | None = "m7n8o9p0q1r2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "frontend_error_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("backend_response", sa.Text, nullable=True),
        sa.Column("page_url", sa.String(2048), nullable=True),
        sa.Column("request_method", sa.String(16), nullable=True),
        sa.Column("request_url", sa.String(2048), nullable=True),
        sa.Column("status_code", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_frontend_error_logs_user_id",
        "frontend_error_logs",
        ["user_id"],
    )
    op.create_index(
        "ix_frontend_error_logs_created_at",
        "frontend_error_logs",
        ["created_at"],
    )

    op.create_table(
        "idea_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_idea_suggestions_user_id",
        "idea_suggestions",
        ["user_id"],
    )
    op.create_index(
        "ix_idea_suggestions_created_at",
        "idea_suggestions",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_idea_suggestions_created_at", "idea_suggestions")
    op.drop_index("ix_idea_suggestions_user_id", "idea_suggestions")
    op.drop_table("idea_suggestions")

    op.drop_index(
        "ix_frontend_error_logs_created_at", "frontend_error_logs"
    )
    op.drop_index("ix_frontend_error_logs_user_id", "frontend_error_logs")
    op.drop_table("frontend_error_logs")
