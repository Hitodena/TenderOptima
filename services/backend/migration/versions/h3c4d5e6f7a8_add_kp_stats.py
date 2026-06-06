"""add tz_analyses.kp_stats JSON column

Revision ID: h3c4d5e6f7a8
Revises: g2c3d4e5f6a7
Create Date: 2026-06-06 14:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision: str = "h3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "g2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tz_analyses",
        sa.Column(
            "kp_stats",
            JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.alter_column("tz_analyses", "kp_stats", server_default=None)


def downgrade() -> None:
    op.drop_column("tz_analyses", "kp_stats")
