"""Centralize SMTP/IMAP settings in mail_accounts.

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-10-20 11:15:00.000000
"""

import json
from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "u6v7w8x9y0z1"
down_revision: str | Sequence[str] | None = "t5u6v7w8x9y0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _encrypt_legacy_secret(value: str | None) -> str | None:
    """Encrypt plaintext legacy passwords while preserving valid ciphertext."""
    if not value or value.startswith("enc:"):
        return value
    # Import inside migration so metadata imports do not initialize settings.
    from backend.utils.secret_encryption import store_secret

    return store_secret(value)


def upgrade() -> None:
    op.create_table(
        "mail_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True),
        sa.Column("smtp_user", sa.String(length=255), nullable=True),
        sa.Column("smtp_password", sa.Text(), nullable=True),
        sa.Column("imap_host", sa.String(length=255), nullable=True),
        sa.Column("imap_port", sa.Integer(), nullable=True),
        sa.Column("imap_user", sa.String(length=255), nullable=True),
        sa.Column("imap_password", sa.Text(), nullable=True),
        sa.Column(
            "availability",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "smtp_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "imap_available",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_mail_accounts_email_lower",
        "mail_accounts",
        [sa.text("lower(email)")],
        unique=True,
    )
    op.create_index(
        "ix_mail_accounts_created_by_user_id",
        "mail_accounts",
        ["created_by_user_id"],
    )

    op.add_column(
        "users",
        sa.Column(
            "mail_account_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_users_mail_account_id",
        "users",
        "mail_accounts",
        ["mail_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_mail_account_id", "users", ["mail_account_id"])

    op.add_column(
        "email_messages",
        sa.Column(
            "mail_account_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_email_messages_mail_account_id",
        "email_messages",
        "mail_accounts",
        ["mail_account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_email_messages_mail_account_id",
        "email_messages",
        ["mail_account_id"],
    )

    # Keep encrypted evidence for rows that cannot be safely normalized.
    # This prevents an automatic merge of contradictory mailbox settings.
    op.create_table(
        "mail_account_migration_conflicts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mailbox_email", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.String(length=128), nullable=False),
        sa.Column("legacy_payload_encrypted", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_mail_account_conflict_user"),
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, email, smtp_host, smtp_port, smtp_user, smtp_password,
                   imap_host, imap_port, imap_user, imap_password
            FROM users
            WHERE smtp_host IS NOT NULL OR smtp_port IS NOT NULL
               OR smtp_user IS NOT NULL OR smtp_password IS NOT NULL
               OR imap_host IS NOT NULL OR imap_port IS NOT NULL
               OR imap_user IS NOT NULL OR imap_password IS NOT NULL
            """
        )
    ).mappings()

    accounts_by_email: dict[str, tuple[object, tuple[object, ...]]] = {}
    user_account_ids: dict[object, object] = {}
    conflicts: list[dict[str, object]] = []
    mail_accounts = sa.table(
        "mail_accounts",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("email", sa.String()),
        sa.column("source", sa.String()),
        sa.column("created_by_user_id", postgresql.UUID(as_uuid=True)),
        sa.column("smtp_host", sa.String()),
        sa.column("smtp_port", sa.Integer()),
        sa.column("smtp_user", sa.String()),
        sa.column("smtp_password", sa.Text()),
        sa.column("imap_host", sa.String()),
        sa.column("imap_port", sa.Integer()),
        sa.column("imap_user", sa.String()),
        sa.column("imap_password", sa.Text()),
        sa.column("availability", sa.Boolean()),
        sa.column("smtp_available", sa.Boolean()),
        sa.column("imap_available", sa.Boolean()),
        sa.column("last_checked_at", sa.DateTime(timezone=True)),
        sa.column("last_error", sa.Text()),
    )

    for row in rows:
        mailbox_email = str(
            row["smtp_user"] or row["imap_user"] or row["email"]
        ).strip().lower()
        configuration = (
            row["smtp_host"],
            row["smtp_port"],
            row["smtp_user"],
            row["smtp_password"],
            row["imap_host"],
            row["imap_port"],
            row["imap_user"],
            row["imap_password"],
        )
        existing = accounts_by_email.get(mailbox_email)
        if existing is not None:
            account_id, existing_configuration = existing
            if existing_configuration == configuration:
                user_account_ids[row["id"]] = account_id
                continue
            conflicts.append(
                {
                    "id": uuid4(),
                    "user_id": row["id"],
                    "mailbox_email": mailbox_email,
                    "reason": "same_email_has_different_legacy_configuration",
                    "legacy_payload_encrypted": _encrypt_legacy_secret(
                        json.dumps(
                            {
                                "smtp_host": row["smtp_host"],
                                "smtp_port": row["smtp_port"],
                                "smtp_user": row["smtp_user"],
                                "smtp_password": row["smtp_password"],
                                "imap_host": row["imap_host"],
                                "imap_port": row["imap_port"],
                                "imap_user": row["imap_user"],
                                "imap_password": row["imap_password"],
                            },
                            default=str,
                        )
                    ),
                }
            )
            continue

        account_id = uuid4()
        bind.execute(
            mail_accounts.insert().values(
                id=account_id,
                email=mailbox_email,
                source="custom",
                created_by_user_id=row["id"],
                smtp_host=row["smtp_host"],
                smtp_port=row["smtp_port"],
                smtp_user=row["smtp_user"],
                smtp_password=_encrypt_legacy_secret(row["smtp_password"]),
                imap_host=row["imap_host"],
                imap_port=row["imap_port"],
                imap_user=row["imap_user"],
                imap_password=_encrypt_legacy_secret(row["imap_password"]),
                availability=False,
                smtp_available=False,
                imap_available=False,
                last_checked_at=None,
                last_error="Requires centralized SMTP/IMAP verification",
            )
        )
        accounts_by_email[mailbox_email] = (account_id, configuration)
        user_account_ids[row["id"]] = account_id

    for user_id, account_id in user_account_ids.items():
        bind.execute(
            sa.text("UPDATE users SET mail_account_id = :account_id WHERE id = :id"),
            {"id": user_id, "account_id": account_id},
        )
    if conflicts:
        bind.execute(
            sa.table(
                "mail_account_migration_conflicts",
                sa.column("id", postgresql.UUID(as_uuid=True)),
                sa.column("user_id", postgresql.UUID(as_uuid=True)),
                sa.column("mailbox_email", sa.String()),
                sa.column("reason", sa.String()),
                sa.column("legacy_payload_encrypted", sa.Text()),
            ).insert(),
            conflicts,
        )

    for mailbox_email, (account_id, _configuration) in accounts_by_email.items():
        bind.execute(
            sa.text(
                """
                UPDATE email_messages
                SET mail_account_id = :account_id
                WHERE mail_account_id IS NULL
                  AND lower(mailbox_email) = :mailbox_email
                """
            ),
            {"account_id": account_id, "mailbox_email": mailbox_email},
        )

    # mail_accounts is now the only active credential source. Archived conflict
    # values above stay encrypted and must be reconciled manually, never merged.
    for column in (
        "smtp_host",
        "smtp_port",
        "smtp_user",
        "smtp_password",
        "imap_host",
        "imap_port",
        "imap_user",
        "imap_password",
    ):
        op.drop_column("users", column)


def downgrade() -> None:
    # Restore the legacy columns structurally. Credentials remain encrypted in
    # the centralized table/archive and are never copied back as plaintext.
    op.add_column("users", sa.Column("smtp_host", sa.String(), nullable=True))
    op.add_column("users", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("smtp_user", sa.String(), nullable=True))
    op.add_column("users", sa.Column("smtp_password", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("imap_host", sa.String(), nullable=True))
    op.add_column("users", sa.Column("imap_port", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("imap_user", sa.String(), nullable=True))
    op.add_column("users", sa.Column("imap_password", sa.Text(), nullable=True))
    op.drop_index("ix_email_messages_mail_account_id", table_name="email_messages")
    op.drop_constraint(
        "fk_email_messages_mail_account_id",
        "email_messages",
        type_="foreignkey",
    )
    op.drop_column("email_messages", "mail_account_id")
    op.drop_table("mail_account_migration_conflicts")
    op.drop_index("ix_users_mail_account_id", table_name="users")
    op.drop_constraint("fk_users_mail_account_id", "users", type_="foreignkey")
    op.drop_column("users", "mail_account_id")
    op.drop_index("ix_mail_accounts_created_by_user_id", table_name="mail_accounts")
    op.drop_index("uq_mail_accounts_email_lower", table_name="mail_accounts")
    op.drop_table("mail_accounts")
