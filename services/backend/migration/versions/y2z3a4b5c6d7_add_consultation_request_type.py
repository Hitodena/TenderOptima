"""Add consultation request_type (demo vs trial).

Revision ID: y2z3a4b5c6d7
Revises: x1y2z3a4b5c6
Create Date: 2026-07-07 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "y2z3a4b5c6d7"
down_revision: str | Sequence[str] | None = "x1y2z3a4b5c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "consultations",
        sa.Column(
            "request_type",
            sa.String(20),
            nullable=False,
            server_default="demo",
        ),
    )
    op.create_index(
        "ix_consultations_request_type",
        "consultations",
        ["request_type"],
    )


def downgrade() -> None:
    op.drop_index("ix_consultations_request_type", "consultations")
    op.drop_column("consultations", "request_type")
