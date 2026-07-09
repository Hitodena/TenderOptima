"""Add is_global to blacklisted_domains.

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-06-28 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "h2i3j4k5l6m7"
down_revision: str | Sequence[str] | None = "g1h2i3j4k5l6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE blacklisted_domains "
        "ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE"
    )
    op.execute(
        "UPDATE blacklisted_domains SET is_global = TRUE "
        "WHERE added_by_user_id IS NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE blacklisted_domains DROP COLUMN IF EXISTS is_global"
    )
