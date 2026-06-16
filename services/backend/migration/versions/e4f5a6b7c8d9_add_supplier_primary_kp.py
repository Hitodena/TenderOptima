"""Add primary_kp_filename to tz_analysis_suppliers.

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-16 18:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e4f5a6b7c8d9"
down_revision: str | Sequence[str] | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE tz_analysis_suppliers "
        "ADD COLUMN IF NOT EXISTS primary_kp_filename VARCHAR(512)"
    )
    op.execute(
        """
        UPDATE tz_analysis_suppliers
        SET primary_kp_filename = kp_filenames->>0
        WHERE primary_kp_filename IS NULL
          AND jsonb_array_length(kp_filenames::jsonb) > 0
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE tz_analysis_suppliers "
        "DROP COLUMN IF EXISTS primary_kp_filename"
    )
