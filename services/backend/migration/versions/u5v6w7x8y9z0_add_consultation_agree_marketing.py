"""Add agree_marketing to consultations.

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-07-07 23:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "u5v6w7x8y9z0"
down_revision: str | Sequence[str] | None = "t4u5v6w7x8y9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consultations",
        sa.Column(
            "agree_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("consultations", "agree_marketing")
