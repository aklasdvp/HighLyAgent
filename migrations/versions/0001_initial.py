"""initial schema — clients, keys, knowledge (pgvector), users, conversations

Revision ID: 0001
Revises:
Create Date: 2026-08-19
"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("platform", sa.String(16), server_default="web"),
        sa.Column("allowed_origins", postgresql.JSON, server_default="[]"),
        sa.Column("rate_limit_per_min", sa.Integer, server_default="60"),
        sa.Column("ai_provider", sa.String(40)),
        sa.Column("ai_model", sa.String(80)),
        sa.Column("temperature", sa.Numeric(3, 2), server_default="0.7"),
        sa.Column("max_tokens", sa.Integer, server_default="1024"),
        sa.Column("system_prompt", sa.Text),
        sa.Column("webhook_url", sa.String(300)),
        sa.Column("suspended", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="CASCADE"), index=True),
        sa.Column("key_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("last4", sa.String(4)),
        sa.Column("label", sa.String(60), server_default="default"),
        sa.Column("revoked", sa.Boolean, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime),
    )

    op.create_table(
        "knowledge_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="CASCADE"), index=True),
        sa.Column("category", sa.String(60), server_default="general"),
        sa.Column("language", sa.String(8), server_default="mixed"),
        sa.Column("trigger_text", sa.Text, nullable=False),
        sa.Column("response_text", sa.Text, nullable=False),
        sa.Column("tool_calls", postgresql.JSON, server_default="[]"),
        sa.Column("embedding", Vector(1536)),
        sa.Column("hit_count", sa.Integer, server_default="0"),
        sa.Column("learned", sa.Boolean, server_default=sa.true()),
        sa.Column("active", sa.Boolean, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_knowledge_embedding_hnsw", "knowledge_entries", ["embedding"],
                    postgresql_using="hnsw", postgresql_ops={"embedding": "vector_cosine_ops"})

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("clients.id", ondelete="CASCADE"), index=True),
        sa.Column("external_id", sa.String(160), server_default="anonymous"),
        sa.Column("plan", sa.String(16), server_default="free"),
        sa.Column("tokens_today", sa.Integer, server_default="0"),
        sa.Column("tokens_month", sa.Integer, server_default="0"),
        sa.Column("daily_token_limit", sa.Integer, server_default="2000"),
        sa.Column("monthly_token_limit", sa.Integer, server_default="50000"),
        sa.Column("messages_total", sa.Integer, server_default="0"),
        sa.Column("cache_hits", sa.Integer, server_default="0"),
        sa.Column("blocked", sa.Boolean, server_default=sa.false()),
    )

    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("summary", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id", ondelete="CASCADE"), index=True),
        sa.Column("role", sa.String(12), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("source", sa.String(16)),
        sa.Column("provider", sa.String(40)),
        sa.Column("tokens", sa.Integer, server_default="0"),
        sa.Column("latency_ms", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "tools",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(80), unique=True, nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("type", sa.String(10), server_default="server"),
        sa.Column("schema", postgresql.JSON, server_default="{}"),
        sa.Column("enabled", sa.Boolean, server_default=sa.true()),
    )

    op.create_table(
        "workflows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("trigger", sa.String(120), server_default="manual"),
        sa.Column("steps", postgresql.JSON, server_default="[]"),
        sa.Column("active", sa.Boolean, server_default=sa.true()),
        sa.Column("runs", sa.Integer, server_default="0"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("level", sa.String(10), server_default="INFO"),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("actor", sa.String(160)),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("meta", postgresql.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), index=True),
    )

    op.create_table(
        "admin_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(40), unique=True, index=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, index=True, nullable=False),
        sa.Column("password_hash", sa.String(120), nullable=False),
        sa.Column("role", sa.String(20), server_default="admin"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("admin_users.id", ondelete="CASCADE"), index=True),
        sa.Column("refresh_hash", sa.String(64), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in ("sessions", "admin_users", "audit_logs", "workflows", "tools", "messages",
              "conversations", "users", "api_keys", "knowledge_entries", "clients"):
        op.drop_table(t)
