"""Add open_questions JSON list to tz_creation_sessions.

Revision ID: h8i9j0k1l2m3
Revises: g7a8b9c0d1e2
Create Date: 2026-07-29 17:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "h8i9j0k1l2m3"
down_revision: str | Sequence[str] | None = "g7a8b9c0d1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tz_creation_sessions",
        sa.Column(
            "open_questions",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("tz_creation_sessions", "open_questions")
