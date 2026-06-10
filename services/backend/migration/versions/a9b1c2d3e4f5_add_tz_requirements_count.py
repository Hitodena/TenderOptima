"""Add tz_requirements_count to tz_analyses.

Revision ID: a9b1c2d3e4f5
Revises: 868f55bbdd40
Create Date: 2026-06-10 15:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b1c2d3e4f5"
down_revision: Union[str, Sequence[str], None] = "868f55bbdd40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tz_analyses",
        sa.Column(
            "tz_requirements_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.alter_column(
        "tz_analyses",
        "tz_requirements_count",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("tz_analyses", "tz_requirements_count")
