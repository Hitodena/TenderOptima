"""Add email_messages.kind: delivery failure, auto reply or forward.

NULL means an ordinary letter, so existing rows need no backfill.

Revision ID: a1k2n3d4m5s6
Revises: v7w8x9y0z1a2
Create Date: 2026-11-07 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1k2n3d4m5s6"
down_revision: str | Sequence[str] | None = "v7w8x9y0z1a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_messages",
        sa.Column("kind", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("email_messages", "kind")
