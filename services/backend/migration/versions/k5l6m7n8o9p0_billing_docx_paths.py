"""Replace billing pdf_path with invoice/act DOCX paths.

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-07-02 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "k5l6m7n8o9p0"
down_revision: str | Sequence[str] | None = "j4k5l6m7n8o9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "subscription_billing_documents",
        sa.Column("invoice_docx_path", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "subscription_billing_documents",
        sa.Column("act_docx_path", sa.String(length=512), nullable=True),
    )
    op.execute(
        """
        UPDATE subscription_billing_documents
        SET invoice_docx_path = pdf_path
        WHERE pdf_path IS NOT NULL
        """
    )
    op.drop_column("subscription_billing_documents", "pdf_path")


def downgrade() -> None:
    op.add_column(
        "subscription_billing_documents",
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
    )
    op.execute(
        """
        UPDATE subscription_billing_documents
        SET pdf_path = invoice_docx_path
        WHERE invoice_docx_path IS NOT NULL
        """
    )
    op.drop_column("subscription_billing_documents", "act_docx_path")
    op.drop_column("subscription_billing_documents", "invoice_docx_path")
