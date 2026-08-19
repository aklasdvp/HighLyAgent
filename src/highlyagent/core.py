"""Core infrastructure: settings, async database, auth & RBAC primitives."""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import AsyncGenerator

import redis.asyncio as redis
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


# ── Settings ────────────────────────────────────────────
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "HighLyAgent"
    ENVIRONMENT: str = "production"
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: list[str] = []

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    KNOWLEDGE_CACHE_TTL: int = 300
    STM_TTL_SECONDS: int = 1800

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 20160

    VECTOR_DIM: int = 1536
    SIMILARITY_THRESHOLD: float = 0.40
    AUTO_LEARN: bool = True
    DEFAULT_PROVIDER: str = "openai"
    FALLBACK_CHAIN: list[str] = ["openai", "claude", "gemini", "deepseek"]

    RATE_LIMIT_PER_MINUTE: int = 60
    MAX_INPUT_LENGTH: int = 4000


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()


# ── Async database ──────────────────────────────────────
engine = create_async_engine(settings.DATABASE_URL, pool_size=20, max_overflow=15, pool_pre_ping=True)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


# ── Redis ───────────────────────────────────────────────
redis_pool: redis.Redis | None = None


async def init_redis() -> redis.Redis:
    global redis_pool
    redis_pool = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_pool


def get_redis() -> redis.Redis:
    assert redis_pool is not None, "Redis not initialised"
    return redis_pool


# ── Passwords / keys ────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def generate_api_key() -> tuple[str, str]:
    """Return (visible_key, stored_hash). Visible form is shown exactly once."""
    raw = secrets.token_urlsafe(32)
    visible = f"hl_live_{raw}"
    return visible, hash_api_key(visible)


def hash_api_key(visible: str) -> str:
    return hashlib.sha256(visible.encode()).hexdigest()


# ── JWT ─────────────────────────────────────────────────
def create_token(subject: str, role: str, kind: str = "access") -> str:
    expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES if kind == "access"
                       else settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "type": kind,
        "exp": datetime.now(timezone.utc) + expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, expected_type: str = "access") -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    return payload


bearer_scheme = HTTPBearer(auto_error=False)


# ── RBAC ────────────────────────────────────────────────
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin":      {"clients.read", "clients.write", "clients.delete", "knowledge.read", "knowledge.write",
                   "knowledge.delete", "tools.manage", "providers.manage", "users.manage", "workflows.manage",
                   "logs.read", "security.manage", "billing.manage"},
    "manager":    {"clients.read", "clients.write", "knowledge.read", "knowledge.write", "tools.manage",
                   "workflows.manage", "users.manage", "logs.read"},
    "developer":  {"clients.read", "knowledge.read", "knowledge.write", "tools.manage", "logs.read"},
    "viewer":     {"clients.read", "knowledge.read", "logs.read"},
}


def require(*permissions: str):
    """Dependency factory: enforce RBAC on a route."""
    async def _check(creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
        if creds is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
        payload = decode_token(creds.credentials)
        granted = ROLE_PERMISSIONS.get(payload.get("role", ""), set())
        if not all(p in granted for p in permissions):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return payload
    return _check
