"""Add project limits, provider selection, usage counters and message analytics columns."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003_limits_provider_analytics"
down_revision = "0002_behavior_description"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # clients — project-level AI selection and per-user limits
    op.add_column("clients", sa.Column("ai_provider", sa.String(30), nullable=True))
    op.add_column("clients", sa.Column("ai_model", sa.String(80), nullable=True))
    op.add_column("clients", sa.Column("daily_request_limit", sa.Integer(), nullable=True))
    op.add_column("clients", sa.Column("monthly_request_limit", sa.Integer(), nullable=True))
    op.add_column("clients", sa.Column("daily_token_limit", sa.Integer(), nullable=True))
    op.add_column("clients", sa.Column("monthly_token_limit", sa.Integer(), nullable=True))

    # users — request counters and error ledger
    op.add_column("users", sa.Column("requests_today", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("requests_month", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("errors_total", sa.Integer(), nullable=False, server_default="0"))

    # messages — analytics dimensions
    op.add_column("messages", sa.Column("tools_used", sa.JSON(), nullable=True))
    op.add_column("messages", sa.Column("intent", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "intent")
    op.drop_column("messages", "tools_used")
    op.drop_column("users", "errors_total")
    op.drop_column("users", "requests_month")
    op.drop_column("users", "requests_today")
    op.drop_column("clients", "monthly_token_limit")
    op.drop_column("clients", "daily_token_limit")
    op.drop_column("clients", "monthly_request_limit")
    op.drop_column("clients", "daily_request_limit")
    op.drop_column("clients", "ai_model")
    op.drop_column("clients", "ai_provider")
