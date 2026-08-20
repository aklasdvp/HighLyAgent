"""Add behavior_description column to the clients table."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_behavior_description"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("behavior_description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "behavior_description")
