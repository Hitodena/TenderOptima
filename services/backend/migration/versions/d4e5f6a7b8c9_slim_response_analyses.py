"""drop hardcoded columns from response_analyses

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-03 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = (
    "offered_price_per_unit",
    "offered_currency",
    "offered_quantity",
    "offered_delivery_days",
    "quality_description",
    "meets_price",
    "meets_quantity",
    "meets_deadline",
    "meets_quality",
    "match_score",
    "summary",
)


def upgrade() -> None:
    for column in _COLUMNS:
        op.drop_column("response_analyses", column)


def downgrade() -> None:
    op.add_column(
        "response_analyses",
        sa.Column(
            "offered_price_per_unit",
            sa.Numeric(precision=12, scale=2),
            nullable=True,
        ),
    )
    op.add_column(
        "response_analyses",
        sa.Column("offered_currency", sa.String(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("offered_quantity", sa.Integer(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("offered_delivery_days", sa.Integer(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("quality_description", sa.Text(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("meets_price", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("meets_quantity", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("meets_deadline", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("meets_quality", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("match_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "response_analyses",
        sa.Column("summary", sa.Text(), nullable=True),
    )
