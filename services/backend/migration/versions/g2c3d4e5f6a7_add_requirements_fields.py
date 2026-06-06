"""add tz_analyses requirements_tz and requirements_kp JSON columns

Revision ID: g2c3d4e5f6a7
Revises: f1b2c3d4e5f6
Create Date: 2026-06-06 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision: str = "g2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "f1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tz_analyses",
        sa.Column(
            "requirements_tz",
            JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "tz_analyses",
        sa.Column(
            "requirements_kp",
            JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.alter_column("tz_analyses", "requirements_tz", server_default=None)
    op.alter_column("tz_analyses", "requirements_kp", server_default=None)


def downgrade() -> None:
    op.drop_column("tz_analyses", "requirements_kp")
    op.drop_column("tz_analyses", "requirements_tz")
