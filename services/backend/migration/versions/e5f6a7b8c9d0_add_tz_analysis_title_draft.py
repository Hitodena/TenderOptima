"""add tz_analyses.title and nullable filenames for draft

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-03 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tz_analyses",
        sa.Column("title", sa.String(length=500), nullable=False, server_default=""),
    )
    op.alter_column("tz_analyses", "title", server_default=None)
    op.alter_column(
        "tz_analyses",
        "tz_filename",
        existing_type=sa.String(length=512),
        nullable=True,
    )
    op.alter_column(
        "tz_analyses",
        "kp_filename",
        existing_type=sa.String(length=512),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "tz_analyses",
        "kp_filename",
        existing_type=sa.String(length=512),
        nullable=False,
    )
    op.alter_column(
        "tz_analyses",
        "tz_filename",
        existing_type=sa.String(length=512),
        nullable=False,
    )
    op.drop_column("tz_analyses", "title")
