"""Buyer's star on a supplier thread.

request_suppliers.is_starred lets the buyer mark threads in the
correspondence list (filter "Избранные", starred first).

Revision ID: c3s4t5a6r7e8
Revises: b2d3e4m5o6t7
Create Date: 2026-11-11 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3s4t5a6r7e8"
down_revision: str | Sequence[str] | None = "b2d3e4m5o6t7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "request_suppliers",
        sa.Column(
            "is_starred",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("request_suppliers", "is_starred")
