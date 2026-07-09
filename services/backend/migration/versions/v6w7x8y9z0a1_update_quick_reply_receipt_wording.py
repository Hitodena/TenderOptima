"""Update quick reply receipt template wording.

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-07-09 10:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "v6w7x8y9z0a1"
down_revision: str | Sequence[str] | None = "u5v6w7x8y9z0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_BODY = (
    "Благодарим за предоставление информации. Мы обработаем ваше "
    "коммерческое предложение и направим ответ в ближайшее время."
)


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE email_templates SET body = :body "
            "WHERE title = 'Ответ о получении' "
            "AND category = 'quick_reply'"
        ).bindparams(body=NEW_BODY)
    )


def downgrade() -> None:
    old_body = (
        "Благодарим за предоставленную информацию. Мы обработаем ваше "
        "коммерческое предложение и направим ответ в ближайшее время."
    )
    op.execute(
        sa.text(
            "UPDATE email_templates SET body = :body "
            "WHERE title = 'Ответ о получении' "
            "AND category = 'quick_reply'"
        ).bindparams(body=old_body)
    )
