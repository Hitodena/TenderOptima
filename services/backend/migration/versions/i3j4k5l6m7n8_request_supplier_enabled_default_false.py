"""Default request_suppliers.is_enabled to false.

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-06-29 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "i3j4k5l6m7n8"
down_revision: str | Sequence[str] | None = "h2i3j4k5l6m7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "request_suppliers",
        "is_enabled",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "request_suppliers",
        "is_enabled",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
        existing_nullable=False,
    )
