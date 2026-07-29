"""Add attachment_paths JSON column to idea_suggestions.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-29 15:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "idea_suggestions",
        sa.Column("attachment_paths", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("idea_suggestions", "attachment_paths")
