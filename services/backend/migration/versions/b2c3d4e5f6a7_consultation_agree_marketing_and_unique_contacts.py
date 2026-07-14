"""Add consultation agree_marketing and unique contact constraints.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-14 14:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
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
    op.create_unique_constraint(
        "uq_consultations_email",
        "consultations",
        ["email"],
    )
    op.create_unique_constraint(
        "uq_consultations_phone",
        "consultations",
        ["phone"],
    )
    op.create_unique_constraint(
        "uq_users_phone",
        "users",
        ["phone"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.drop_constraint(
        "uq_consultations_phone",
        "consultations",
        type_="unique",
    )
    op.drop_constraint(
        "uq_consultations_email",
        "consultations",
        type_="unique",
    )
    op.drop_column("consultations", "agree_marketing")
