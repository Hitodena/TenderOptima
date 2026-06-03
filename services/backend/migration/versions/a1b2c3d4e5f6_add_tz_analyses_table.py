"""add tz_analyses table

Revision ID: a1b2c3d4e5f6
Revises: f67b0fb6e5ad
Create Date: 2026-06-02 22:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f67b0fb6e5ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tz_analyses",
        sa.Column("id", sa.UUID(), nullable=False),
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
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tz_filename", sa.String(length=512), nullable=False),
        sa.Column("kp_filename", sa.String(length=512), nullable=False),
        sa.Column("items", sa.JSON(), nullable=False),
        sa.Column("match_score", sa.Integer(), nullable=False),
        sa.Column("met_count", sa.Integer(), nullable=False),
        sa.Column("partial_count", sa.Integer(), nullable=False),
        sa.Column("missing_count", sa.Integer(), nullable=False),
        sa.Column("not_found_count", sa.Integer(), nullable=False),
        sa.Column("llm_model", sa.String(length=128), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tz_analyses_user_id",
        "tz_analyses",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_tz_analyses_user_id", table_name="tz_analyses")
    op.drop_table("tz_analyses")
