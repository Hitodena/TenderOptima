"""Add user consent revocation and deletion fields.

Revision ID: a1b2c3d4e5f6
Revises: z3a4b5c6d7e8
Create Date: 2026-07-11 19:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "z3a4b5c6d7e8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("consent_revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("deleted_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "deleted_reason")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "consent_revoked_at")
