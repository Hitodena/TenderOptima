"""Add one-time registration referrals.

Revision ID: z3a4b5c6d7e8
Revises: y2z3a4b5c6d7
Create Date: 2026-07-10 22:58:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "z3a4b5c6d7e8"
down_revision: str | Sequence[str] | None = "y2z3a4b5c6d7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "registration_referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("inviter_name", sa.String(length=150), nullable=False),
        sa.Column(
            "created_by_admin_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "used_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            unique=True,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
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
        "ix_registration_referrals_code",
        "registration_referrals",
        ["code"],
        unique=True,
    )
    op.create_index(
        "ix_registration_referrals_created_at",
        "registration_referrals",
        ["created_at"],
    )
    op.add_column(
        "users",
        sa.Column("ref_by", sa.String(length=150), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "referral_invitation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("registration_referrals.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_users_referral_invitation_id",
        "users",
        ["referral_invitation_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_referral_invitation_id", "users")
    op.drop_column("users", "referral_invitation_id")
    op.drop_column("users", "ref_by")
    op.drop_index("ix_registration_referrals_created_at", "registration_referrals")
    op.drop_index("ix_registration_referrals_code", "registration_referrals")
    op.drop_table("registration_referrals")
