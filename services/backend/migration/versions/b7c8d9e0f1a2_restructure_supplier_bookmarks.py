"""Restructure supplier bookmarks into lists with items.

Revision ID: b7c8d9e0f1a2
Revises: a6b7c8d9e0f1
Create Date: 2026-06-18 21:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a6b7c8d9e0f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_bookmark_lists",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column(
            "is_global",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "supplier_bookmark_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("list_id", sa.UUID(), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["list_id"],
            ["supplier_bookmark_lists.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if inspector.has_table("supplier_bookmarks"):
        conn.execute(
            sa.text(
                """
                INSERT INTO supplier_bookmark_lists (
                    id, user_id, title, is_global, created_at, updated_at
                )
                SELECT
                    gen_random_uuid(),
                    user_id,
                    CASE
                        WHEN is_global THEN 'Общая база поставщиков'
                        ELSE 'Моя база поставщиков'
                    END,
                    is_global,
                    MIN(created_at),
                    MAX(updated_at)
                FROM supplier_bookmarks
                GROUP BY user_id, is_global
                """
            )
        )
        conn.execute(
            sa.text(
                """
                INSERT INTO supplier_bookmark_items (
                    id, list_id, company_name, email, domain, notes,
                    created_at, updated_at
                )
                SELECT
                    b.id,
                    l.id,
                    b.company_name,
                    b.email,
                    b.domain,
                    b.notes,
                    b.created_at,
                    b.updated_at
                FROM supplier_bookmarks b
                JOIN supplier_bookmark_lists l
                    ON b.user_id IS NOT DISTINCT FROM l.user_id
                    AND b.is_global = l.is_global
                    AND l.title = CASE
                        WHEN b.is_global THEN 'Общая база поставщиков'
                        ELSE 'Моя база поставщиков'
                    END
                """
            )
        )
        op.drop_table("supplier_bookmarks")


def downgrade() -> None:
    op.create_table(
        "supplier_bookmarks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "is_global",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            INSERT INTO supplier_bookmarks (
                id, user_id, company_name, email, domain, notes,
                is_global, created_at, updated_at
            )
            SELECT
                i.id,
                l.user_id,
                i.company_name,
                i.email,
                i.domain,
                i.notes,
                l.is_global,
                i.created_at,
                i.updated_at
            FROM supplier_bookmark_items i
            JOIN supplier_bookmark_lists l ON l.id = i.list_id
            """
        )
    )
    op.drop_table("supplier_bookmark_items")
    op.drop_table("supplier_bookmark_lists")
