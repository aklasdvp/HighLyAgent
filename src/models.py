"""SQLAlchemy 2.0 models — PostgreSQL + pgvector."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core import Base, settings


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.utcnow()


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    behavior_description: Mapped[str | None] = mapped_column(Text)
    ai_provider: Mapped[str | None] = mapped_column(String(30))
    ai_model: Mapped[str | None] = mapped_column(String(80))
    daily_request_limit: Mapped[int | None] = mapped_column(Integer)
    monthly_request_limit: Mapped[int | None] = mapped_column(Integer)
    daily_token_limit: Mapped[int | None] = mapped_column(Integer)
    monthly_token_limit: Mapped[int | None] = mapped_column(Integer)
    platform: Mapped[str] = mapped_column(Enum("web", "mobile", "desktop", "iot", name="platform"), default="web")
    allowed_origins: Mapped[list] = mapped_column(JSON, default=list)
    rate_limit_per_min: Mapped[int] = mapped_column(Integer, default=60)
    webhook_url: Mapped[str | None] = mapped_column(String(512))
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    users: Mapped[list["User"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    knowledge: Mapped[list["KnowledgeEntry"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    tools: Mapped[list["Tool"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(80), default="default")
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    last4: Mapped[str] = mapped_column(String(4))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(160), index=True)          # id on the client side
    email: Mapped[str | None] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(Enum("free", "trial", "unlimited", name="plan"), default="free")
    daily_token_limit: Mapped[int] = mapped_column(Integer, default=2000)
    monthly_token_limit: Mapped[int] = mapped_column(Integer, default=30000)
    tokens_today: Mapped[int] = mapped_column(Integer, default=0)
    tokens_month: Mapped[int] = mapped_column(Integer, default=0)
    requests_today: Mapped[int] = mapped_column(Integer, default=0)
    requests_month: Mapped[int] = mapped_column(Integer, default=0)
    errors_total: Mapped[int] = mapped_column(Integer, default=0)
    messages_total: Mapped[int] = mapped_column(BigInteger, default=0)
    cache_hits: Mapped[int] = mapped_column(Integer, default=0)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    client: Mapped[Client] = relationship(back_populates="users")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), default="New conversation")
    summary: Mapped[str | None] = mapped_column(Text)                          # long-term memory digest
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    messages: Mapped[list["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(Enum("user", "assistant", "system", "tool", name="role"))
    content: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Enum("cache", "provider", "tool", name="source"), default="provider")
    provider: Mapped[str | None] = mapped_column(String(40))
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    tools_used: Mapped[list] = mapped_column(JSON, default=list)
    intent: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class KnowledgeEntry(Base):
    """Self-learning knowledge base — pgvector semantic search."""
    __tablename__ = "knowledge_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(60), default="general")
    trigger_text: Mapped[str] = mapped_column(Text, nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    tool_calls: Mapped[list] = mapped_column(JSON, default=list)               # replay recipe
    embedding: Mapped[list[float]] = mapped_column(Vector(settings.VECTOR_DIM), nullable=False)
    similarity_floor: Mapped[float] = mapped_column(Float, default=0.40)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    learned: Mapped[bool] = mapped_column(Boolean, default=False)              # auto-learned vs curated
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=_now)

    client: Mapped[Client] = relationship(back_populates="knowledge")


class Tool(Base):
    __tablename__ = "tools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(Enum("server", "client", name="tool_type"), default="server")
    schema: Mapped[dict] = mapped_column(JSON, default=dict)                   # JSON-Schema for args
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    client: Mapped[Client | None] = relationship(back_populates="tools")


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    trigger_intent: Mapped[str] = mapped_column(String(80))
    steps: Mapped[list] = mapped_column(JSON, default=list)                    # [{kind: tool|ai, ...}]
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

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(120))                    # bcrypt
    role: Mapped[str] = mapped_column(String(20), default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class SessionRow(Base):
    """Refresh-token registry — rotation on every refresh, revocation on logout."""
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)         # SHA-256, raw never stored
    expires_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
