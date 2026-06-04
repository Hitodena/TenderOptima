"""add tz_analyses.kp_filenames JSON column

Revision ID: f0a1b2c3d4e5
Revises: e5f6a7b8c9d0
Create Date: 2026-06-04 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

revision: str = "f0a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tz_analyses",
        sa.Column(
            "kp_filenames",
            JSON(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.alter_column("tz_analyses", "kp_filenames", server_default=None)


def downgrade() -> None:
    op.drop_column("tz_analyses", "kp_filenames")
