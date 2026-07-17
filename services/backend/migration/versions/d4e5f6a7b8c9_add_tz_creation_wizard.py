"""Add tz_creation_sessions and tz_creation_messages tables (Module 3).

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-07-17 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: str | Sequence[str] | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tz_creation_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column(
            "title", sa.String(length=500), nullable=False, server_default=""
        ),
        sa.Column(
            "context",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "source_tz_filename", sa.String(length=512), nullable=True
        ),
        sa.Column(
            "draft_hierarchy",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "fields",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column(
            "llm_model",
            sa.String(length=128),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "messages_used",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "resulting_tz_analysis_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(
            ["resulting_tz_analysis_id"],
            ["tz_analyses.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tz_creation_sessions_user_id",
        "tz_creation_sessions",
        ["user_id"],
    )

    op.create_table(
        "tz_creation_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "session_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
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
        sa.ForeignKeyConstraint(
            ["session_id"],
            ["tz_creation_sessions.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tz_creation_messages_session_id",
        "tz_creation_messages",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_tz_creation_messages_session_id",
        table_name="tz_creation_messages",
    )
    op.drop_table("tz_creation_messages")
    op.drop_index(
        "ix_tz_creation_sessions_user_id",
        table_name="tz_creation_sessions",
    )
    op.drop_table("tz_creation_sessions")
