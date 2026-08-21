"""Pydantic schemas — request/response contracts (also used by the Admin UI contract)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Clients & keys ──────────────────────────────────────
class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    behavior_description: str | None = Field(
        default=None, max_length=2000,
        description="Guides the AI: e.g. 'This project is an e-commerce website; give helpful product responses.'",
    )
    platform: Literal["web", "mobile", "desktop", "iot"] = "web"
    allowed_origins: list[str] = []
    rate_limit_per_min: int = Field(default=60, ge=1, le=5000)
    webhook_url: str | None = None
    ai_provider: Literal["openai", "claude", "gemini", "deepseek"] | None = Field(
        default=None, description="Project-level provider override (falls back to global chain when unset)",
    )
    ai_model: str | None = Field(default=None, max_length=80)
    daily_request_limit: int | None = Field(default=None, ge=0, le=10_000_000)
    monthly_request_limit: int | None = Field(default=None, ge=0, le=10_000_000)
    daily_token_limit: int | None = Field(default=None, ge=0, le=1_000_000_000)
    monthly_token_limit: int | None = Field(default=None, ge=0, le=1_000_000_000)


class ClientOut(ORM):
    id: uuid.UUID
    name: str
    behavior_description: str | None = None
    platform: str
    rate_limit_per_min: int
    suspended: bool
    ai_provider: str | None = None
    ai_model: str | None = None
    daily_request_limit: int | None = None
    monthly_request_limit: int | None = None
    daily_token_limit: int | None = None
    monthly_token_limit: int | None = None
    created_at: datetime


class ProjectLimits(BaseModel):
    """Per-user usage limits configured at the project level."""
    daily_request_limit: int | None = Field(default=None, ge=0, le=10_000_000)
    monthly_request_limit: int | None = Field(default=None, ge=0, le=10_000_000)
    daily_token_limit: int | None = Field(default=None, ge=0, le=1_000_000_000)
    monthly_token_limit: int | None = Field(default=None, ge=0, le=1_000_000_000)


class ApiKeyOut(ORM):
    id: uuid.UUID
    label: str
    last4: str
    revoked: bool
    created_at: datetime


class ApiKeyIssued(BaseModel):
    """Visible key is returned exactly once, at creation/rotation time."""
    key: ApiKeyOut
    visible_key: str


# ── Knowledge ───────────────────────────────────────────
class KnowledgeCreate(BaseModel):
    category: str = "general"
    trigger_text: str = Field(min_length=3)
    response_text: str = Field(min_length=1)
    tool_calls: list[dict] = []
    active: bool = True

    @field_validator("trigger_text", "response_text")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v[:4000]


class KnowledgeOut(ORM):
    id: uuid.UUID
    client_id: uuid.UUID
    category: str
    trigger_text: str
    response_text: str
    tool_calls: list[dict]
    hit_count: int
    active: bool
    learned: bool
    updated_at: datetime


class KnowledgeHit(BaseModel):
    entry: KnowledgeOut
    similarity: float


# ── Tools ───────────────────────────────────────────────
class ToolCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80, pattern=r"^[a-z][a-z0-9_.]*$")
    description: str
    type: Literal["server", "client"] = "server"
    schema: dict


# ── Chat frames (WebSocket protocol) ────────────────────
class ChatFrame(BaseModel):
    type: Literal["chat", "cancel", "tool_result", "pong"]
    task_id: str | None = None
    text: str | None = None
    tool_name: str | None = None
    tool_payload: Any = None


class ProgressFrame(BaseModel):
    type: Literal["progress"] = "progress"
    task_id: str
    stage: str            # auth | intent | vector_search | tool | provider | learn
    pct: int
    detail: str | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    db: bool
    redis: bool
    vector: bool
    providers: dict[str, bool]
