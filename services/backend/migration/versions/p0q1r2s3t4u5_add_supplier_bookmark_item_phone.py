"""Add phone column to supplier_bookmark_items table.

Revision ID: p0q1r2s3t4u5
Revises: o9p0q1r2s3t4
Create Date: 2026-07-04 23:52:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "p0q1r2s3t4u5"
down_revision: str | Sequence[str] | None = "o9p0q1r2s3t4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "supplier_bookmark_items",
        sa.Column("phone", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("supplier_bookmark_items", "phone")
