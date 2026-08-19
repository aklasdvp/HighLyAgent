"""SQLAlchemy models — PostgreSQL + pgvector schema for HighLyAgent."""
from __future__ import annotations

import uuid as _uuid_mod
from datetime import datetime, timedelta

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core import Base, settings


def _uuid() -> _uuid_mod.UUID:
    return _uuid_mod.uuid4()


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120))
    platform: Mapped[str] = mapped_column(String(16), default="web")          # web|mobile|desktop|iot
    allowed_origins: Mapped[list] = mapped_column(JSON, default=list)
    rate_limit_per_min: Mapped[int] = mapped_column(Integer, default=60)
    ai_provider: Mapped[str | None] = mapped_column(String(40))
    ai_model: Mapped[str | None] = mapped_column(String(80))
    temperature: Mapped[float] = mapped_column(Numeric(3, 2), default=0.7)
    max_tokens: Mapped[int] = mapped_column(Integer, default=1024)
    system_prompt: Mapped[str | None] = mapped_column(Text)
    webhook_url: Mapped[str | None] = mapped_column(String(300))
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[_uuid_mod.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)            # SHA-256 — raw never stored
    last4: Mapped[str] = mapped_column(String(4))
    label: Mapped[str] = mapped_column(String(60), default="default")
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[_uuid_mod.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(60), default="general")
    language: Mapped[str] = mapped_column(String(8), default="mixed")         # en|bn|mixed
    trigger_text: Mapped[str] = mapped_column(Text)
    response_text: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[list] = mapped_column(JSON, default=list)
    embedding = mapped_column(Vector(settings.VECTOR_DIM), index=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    learned: Mapped[bool] = mapped_column(Boolean, default=True)              # AI-learned vs curated
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Tool(Base):
    __tablename__ = "tools"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    type: Mapped[str] = mapped_column(String(10), default="server")           # server|client
    schema_: Mapped[dict] = mapped_column("schema", JSON, default=dict)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[_uuid_mod.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    external_id: Mapped[str] = mapped_column(String(160), default="anonymous")
    plan: Mapped[str] = mapped_column(String(16), default="free")             # free|trial|unlimited
    tokens_today: Mapped[int] = mapped_column(Integer, default=0)
    tokens_month: Mapped[int] = mapped_column(Integer, default=0)
    daily_token_limit: Mapped[int] = mapped_column(Integer, default=2_000)
    monthly_token_limit: Mapped[int] = mapped_column(Integer, default=50_000)
    messages_total: Mapped[int] = mapped_column(Integer, default=0)
    cache_hits: Mapped[int] = mapped_column(Integer, default=0)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[_uuid_mod.UUID | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    user_id: Mapped[_uuid_mod.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    summary: Mapped[str | None] = mapped_column(Text)                          # compacted long-term memory
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    conversation_id: Mapped[_uuid_mod.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(12))                              # user|assistant|tool
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(16))                     # cache|provider
    provider: Mapped[str | None] = mapped_column(String(40))
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[_uuid_mod.UUID | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    trigger: Mapped[str] = mapped_column(String(120), default="manual")
    steps: Mapped[list] = mapped_column(JSON, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    runs: Mapped[int] = mapped_column(Integer, default=0)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(10), default="INFO")
    source: Mapped[str] = mapped_column(String(40))
    actor: Mapped[str | None] = mapped_column(String(160))
    message: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)


class AdminUser(Base):
    """Dashboard login — created manually via /auth/setup on first boot. Never auto-provisioned."""
    __tablename__ = "admin_users"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(120))                    # bcrypt
    role: Mapped[str] = mapped_column(String(20), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SessionRow(Base):
    """Refresh-token registry — rotation on every refresh, revocation on logout."""
    __tablename__ = "sessions"

    id: Mapped[_uuid_mod.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    admin_id: Mapped[_uuid_mod.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)         # SHA-256, raw never stored
    expires_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
