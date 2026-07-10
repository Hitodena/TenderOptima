"""Add consultations table (landing page lead form).

Revision ID: x1y2z3a4b5c6
Revises: w7x8y9z0a1b2
Create Date: 2026-07-07 17:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "x1y2z3a4b5c6"
down_revision: str | Sequence[str] | None = "w7x8y9z0a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "consultations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("company", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="new"
        ),
        sa.Column("utm_source", sa.String(100), nullable=True),
        sa.Column("utm_medium", sa.String(100), nullable=True),
        sa.Column("utm_campaign", sa.String(100), nullable=True),
        sa.Column("utm_content", sa.String(100), nullable=True),
        sa.Column("page_url", sa.String(500), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_consultations_ip_address",
        "consultations",
        ["ip_address"],
    )
    op.create_index(
        "ix_consultations_created_at",
        "consultations",
        ["created_at"],
    )
    op.create_index(
        "ix_consultations_status",
        "consultations",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("ix_consultations_status", "consultations")
    op.drop_index("ix_consultations_created_at", "consultations")
    op.drop_index("ix_consultations_ip_address", "consultations")
    op.drop_table("consultations")
