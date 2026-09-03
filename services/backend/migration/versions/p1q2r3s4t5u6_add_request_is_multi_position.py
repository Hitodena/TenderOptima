"""Add is_multi_position to requests.

Revision ID: p1q2r3s4t5u6
Revises: d5e6f7a8b9c0
Create Date: 2026-09-03 14:20:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "p1q2r3s4t5u6"
down_revision: str | Sequence[str] | None = "d5e6f7a8b9c0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE requests "
        "ADD COLUMN IF NOT EXISTS is_multi_position "
        "BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE requests DROP COLUMN IF EXISTS is_multi_position")
