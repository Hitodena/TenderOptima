"""Add is_winner to request_suppliers.

Revision ID: g1h2i3j4k5l6
Revises: c3d4e5f6a7b8
Create Date: 2026-06-27 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "g1h2i3j4k5l6"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE request_suppliers "
        "ADD COLUMN IF NOT EXISTS is_winner BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE request_suppliers DROP COLUMN IF EXISTS is_winner")
