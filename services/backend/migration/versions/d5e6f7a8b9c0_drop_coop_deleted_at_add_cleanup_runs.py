"""Drop deleted_at from cooperation tables; add cleanup run audit.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-08-20 00:15:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d5e6f7a8b9c0"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(
        "ix_verified_suppliers_deleted_at",
        table_name="verified_suppliers",
    )
    op.drop_column("verified_suppliers", "deleted_at")

    op.drop_index(
        "ix_cooperation_leads_deleted_at",
        table_name="cooperation_leads",
    )
    op.drop_column("cooperation_leads", "deleted_at")

    op.create_table(
        "personal_data_cleanup_runs",
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
        sa.Column("purpose_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column(
            "requested_by_admin_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "eligible_users",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "affected_records",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["requested_by_admin_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_personal_data_cleanup_runs_purpose_number",
        "personal_data_cleanup_runs",
        ["purpose_number"],
        unique=False,
    )
    op.create_index(
        "ix_personal_data_cleanup_runs_status",
        "personal_data_cleanup_runs",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_personal_data_cleanup_runs_status",
        table_name="personal_data_cleanup_runs",
    )
    op.drop_index(
        "ix_personal_data_cleanup_runs_purpose_number",
        table_name="personal_data_cleanup_runs",
    )
    op.drop_table("personal_data_cleanup_runs")

    op.add_column(
        "cooperation_leads",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_cooperation_leads_deleted_at",
        "cooperation_leads",
        ["deleted_at"],
        unique=False,
    )
    op.add_column(
        "verified_suppliers",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_verified_suppliers_deleted_at",
        "verified_suppliers",
        ["deleted_at"],
        unique=False,
    )
