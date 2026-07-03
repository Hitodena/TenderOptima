"""Add comments column to suppliers table.

Revision ID: o9p0q1r2s3t4
Revises: n8o9p0q1r2s3
Create Date: 2026-07-03 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "o9p0q1r2s3t4"
down_revision: str | Sequence[str] | None = "n8o9p0q1r2s3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suppliers",
        sa.Column("comments", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("suppliers", "comments")
