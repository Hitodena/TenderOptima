"""Add subscription billing profiles and documents.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-07-02 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, Sequence[str], None] = "i3j4k5l6m7n8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscription_billing_profiles",
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
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("country", sa.String(length=64), nullable=True),
        sa.Column("organization_form", sa.String(length=64), nullable=True),
        sa.Column("inn", sa.String(length=32), nullable=True),
        sa.Column("organization_name", sa.String(length=255), nullable=True),
        sa.Column("kpp", sa.String(length=32), nullable=True),
        sa.Column("ogrn", sa.String(length=32), nullable=True),
        sa.Column("legal_address", sa.Text(), nullable=True),
        sa.Column("postal_address", sa.Text(), nullable=True),
        sa.Column("director_name", sa.String(length=255), nullable=True),
        sa.Column("bik", sa.String(length=16), nullable=True),
        sa.Column("bank_name", sa.String(length=255), nullable=True),
        sa.Column("settlement_account", sa.String(length=32), nullable=True),
        sa.Column(
            "correspondent_account", sa.String(length=32), nullable=True
        ),
        sa.Column("contact_person", sa.String(length=255), nullable=True),
        sa.Column("contact_full_name", sa.String(length=255), nullable=True),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("contact_phone", sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "subscription_billing_documents",
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
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "subscription_id", postgresql.UUID(as_uuid=True), nullable=False
        ),
        sa.Column("receipt_id", sa.String(length=64), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("currency_code", sa.String(length=8), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_items", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("pdf_path", sa.String(length=512), nullable=True),
        sa.Column(
            "email_status",
            sa.String(length=32),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recipient_email", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "receipt_id",
            name="uq_billing_documents_user_receipt",
        ),
    )


def downgrade() -> None:
    op.drop_table("subscription_billing_documents")
    op.drop_table("subscription_billing_profiles")
