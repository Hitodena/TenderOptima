"""Add cooperation_leads and verified_suppliers tables.

Revision ID: c4d5e6f7a8b9
Revises: a1b2c3d4e5f7
Create Date: 2026-08-19 20:40:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c4d5e6f7a8b9"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cooperation_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("company", sa.String(length=150), nullable=False),
        sa.Column("industry", sa.String(length=150), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "agree_marketing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="new",
        ),
        sa.Column("utm_source", sa.String(length=100), nullable=True),
        sa.Column("utm_medium", sa.String(length=100), nullable=True),
        sa.Column("utm_campaign", sa.String(length=100), nullable=True),
        sa.Column("utm_content", sa.String(length=100), nullable=True),
        sa.Column("page_url", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "reviewed_by_admin_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["reviewed_by_admin_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_cooperation_leads_email",
        "cooperation_leads",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_cooperation_leads_status",
        "cooperation_leads",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_cooperation_leads_ip_address",
        "cooperation_leads",
        ["ip_address"],
        unique=False,
    )
    op.create_index(
        "ix_cooperation_leads_deleted_at",
        "cooperation_leads",
        ["deleted_at"],
        unique=False,
    )

    op.create_table(
        "verified_suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("company_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("industry", sa.String(length=150), nullable=False),
        sa.Column("contact_name", sa.String(length=100), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column(
            "source",
            sa.String(length=50),
            nullable=False,
            server_default="cooperation_approval",
        ),
        sa.Column(
            "source_lead_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "approved_by_admin_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["source_lead_id"],
            ["cooperation_leads.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["approved_by_admin_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("source_lead_id"),
    )
    op.create_index(
        "ix_verified_suppliers_email",
        "verified_suppliers",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_verified_suppliers_deleted_at",
        "verified_suppliers",
        ["deleted_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_verified_suppliers_deleted_at", table_name="verified_suppliers"
    )
    op.drop_index("ix_verified_suppliers_email", table_name="verified_suppliers")
    op.drop_table("verified_suppliers")
    op.drop_index(
        "ix_cooperation_leads_deleted_at", table_name="cooperation_leads"
    )
    op.drop_index(
        "ix_cooperation_leads_ip_address", table_name="cooperation_leads"
    )
    op.drop_index("ix_cooperation_leads_status", table_name="cooperation_leads")
    op.drop_index("ix_cooperation_leads_email", table_name="cooperation_leads")
    op.drop_table("cooperation_leads")
