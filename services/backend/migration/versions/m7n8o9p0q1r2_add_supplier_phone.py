"""Add phone field to suppliers.

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-07-03 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "m7n8o9p0q1r2"
down_revision: str | Sequence[str] | None = "l6m7n8o9p0q1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suppliers",
        sa.Column("phone", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("suppliers", "phone")
