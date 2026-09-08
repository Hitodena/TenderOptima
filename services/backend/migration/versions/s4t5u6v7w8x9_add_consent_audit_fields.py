"""Add consent audit fields (document versions, IP, user-agent).

Revision ID: s4t5u6v7w8x9
Revises: r3s4t5u6v7w8
Create Date: 2026-09-08 20:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "s4t5u6v7w8x9"
down_revision: str | Sequence[str] | None = "r3s4t5u6v7w8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _add_shared_consent_columns(table: str, *, ip_column: str | None) -> None:
    op.add_column(
        table,
        sa.Column(
            "terms_accepted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        table,
        sa.Column("terms_version", sa.String(length=32), nullable=True),
    )
    op.add_column(
        table,
        sa.Column("privacy_version", sa.String(length=32), nullable=True),
    )
    if ip_column is not None:
        op.add_column(
            table,
            sa.Column(ip_column, sa.String(length=64), nullable=True),
        )
    op.add_column(
        table,
        sa.Column(
            "consent_user_agent",
            sa.String(length=512),
            nullable=True,
        ),
    )
    op.add_column(
        table,
        sa.Column(
            "marketing_consent_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        table,
        sa.Column(
            "marketing_consent_version",
            sa.String(length=32),
            nullable=True,
        ),
    )


def _drop_shared_consent_columns(
    table: str, *, ip_column: str | None
) -> None:
    op.drop_column(table, "marketing_consent_version")
    op.drop_column(table, "marketing_consent_at")
    op.drop_column(table, "consent_user_agent")
    if ip_column is not None:
        op.drop_column(table, ip_column)
    op.drop_column(table, "privacy_version")
    op.drop_column(table, "terms_version")
    op.drop_column(table, "terms_accepted_at")


def upgrade() -> None:
    _add_shared_consent_columns("users", ip_column="consent_ip")
    _add_shared_consent_columns("cooperation_leads", ip_column=None)
    _add_shared_consent_columns("consultations", ip_column=None)
    _add_shared_consent_columns(
        "supplier_email_preferences", ip_column=None
    )
    op.add_column(
        "supplier_email_preferences",
        sa.Column(
            "agree_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    _add_shared_consent_columns("verified_suppliers", ip_column="consent_ip")
    op.add_column(
        "verified_suppliers",
        sa.Column(
            "agree_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("verified_suppliers", "agree_marketing")
    _drop_shared_consent_columns(
        "verified_suppliers", ip_column="consent_ip"
    )
    op.drop_column("supplier_email_preferences", "agree_marketing")
    _drop_shared_consent_columns(
        "supplier_email_preferences", ip_column=None
    )
    _drop_shared_consent_columns("consultations", ip_column=None)
    _drop_shared_consent_columns("cooperation_leads", ip_column=None)
    _drop_shared_consent_columns("users", ip_column="consent_ip")
