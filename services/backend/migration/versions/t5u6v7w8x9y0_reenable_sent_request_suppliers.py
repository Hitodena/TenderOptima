"""Re-enable request suppliers that already got the request letter.

The request page used to switch off already-mailed suppliers when the monthly
email quota ran low (e.g. after adding one more supplier). Threads, offers and
the comparison list only enabled rows, so the first wave of suppliers vanished
from the request. Sent rows are no longer toggled; this restores the hidden ones.

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-10-12 15:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "t5u6v7w8x9y0"
down_revision: str | Sequence[str] | None = "s4t5u6v7w8x9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "UPDATE request_suppliers SET is_enabled = true "
        "WHERE is_enabled = false AND sent_status <> 'pending'"
    )


def downgrade() -> None:
    # Data fix only: which rows were hidden by the bug is not recorded.
    pass
