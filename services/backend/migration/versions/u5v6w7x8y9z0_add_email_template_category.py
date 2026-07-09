"""Add category to email_templates.

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-07-09 09:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "u5v6w7x8y9z0"
down_revision: str | Sequence[str] | None = "t4u5v6w7x8y9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_templates",
        sa.Column(
            "category",
            sa.String(length=32),
            nullable=False,
            server_default="letter",
        ),
    )
    op.execute(
        sa.text(
            "UPDATE email_templates SET category = 'quick_reply' "
            "WHERE title = 'Ответ о получении'"
        )
    )


def downgrade() -> None:
    op.drop_column("email_templates", "category")
