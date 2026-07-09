"""Add consultation request_type (demo vs trial).

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-07-07 22:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "t4u5v6w7x8y9"
down_revision: str | Sequence[str] | None = "s3t4u5v6w7x8"
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
