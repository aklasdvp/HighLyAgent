"""REST API — endpoints are served at the root (no /api/v1 prefix).

Security layer: client calls must present BOTH X-Client-Id and X-API-Key; the key
must be bound to that exact project, otherwise → 403 ACCESS_DENIED.
The admin dashboard authenticates with a JWT only — no API key required.
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agent import AgentCore, LimitExceeded
from core import (create_token, decode_token, generate_api_key, get_db, hash_api_key,
                  hash_password, require, settings, verify_password)
from knowledge import KnowledgeEngine
from models import AdminUser, ApiKey, AuditLog, Client, KnowledgeEntry, SessionRow, Tool, User
from runtime import CancelToken
from schemas import (ClientCreate, ClientOut, ApiKeyIssued, ApiKeyOut, HealthOut,
                     KnowledgeCreate, KnowledgeHit, KnowledgeOut, TokenPair)

log = logging.getLogger("highlyagent.routes")
router = APIRouter(tags=["admin"])


async def _audit(db: AsyncSession, source: str, message: str, actor: str | None = None,
                 level: str = "INFO", meta: dict | None = None):
    db.add(AuditLog(source=source, message=message, actor=actor, level=level, meta=meta or {}))
    await db.commit()


# ══════════════ AUTH PLANE (first-boot setup + JWT) ══════════════
@router.post("/auth/setup", response_model=TokenPair, status_code=201)
async def auth_setup(payload: dict, db: AsyncSession = Depends(get_db)):
    """Create the first admin. Works exactly once — never auto-provisioned."""
    existing = (await db.execute(select(AdminUser).limit(1))).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Admin already exists — use /auth/login")
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    if len(username) < 3 or "@" not in email or len(password) < 8:
        raise HTTPException(400, "username ≥3 chars, valid email, password ≥8 chars")
    admin = AdminUser(username=username, email=email, password_hash=hash_password(password))
    db.add(admin)
    await db.commit()
    await _audit(db, "auth", f"admin account created: {username}", actor=username)
    return _issue_tokens(db, admin)


@router.post("/auth/login", response_model=TokenPair)
async def auth_login(payload: dict, db: AsyncSession = Depends(get_db)):
    identifier = (payload.get("identifier") or "").strip().lower()
    password = payload.get("password") or ""
    admin = (await db.execute(select(AdminUser).where(
        (AdminUser.username == identifier) | (AdminUser.email == identifier)))).scalar_one_or_none()
    if admin is None or not verify_password(password, admin.password_hash):
        await _audit(db, "auth", f"LOGIN_FAILED identifier={identifier}", level="WARN")
        raise HTTPException(401, "Invalid credentials")
    await _audit(db, "auth", "login ok", actor=admin.username)
    return _issue_tokens(db, admin)


async def _issue_tokens(db: AsyncSession, admin: AdminUser) -> TokenPair:
    access = create_token(str(admin.id), admin.role, "access")
    refresh = create_token(str(admin.id), admin.role, "refresh")
    db.add(SessionRow(admin_id=admin.id,
                      refresh_hash=hashlib.sha256(refresh.encode()).hexdigest(),
                      expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)))
    await db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/auth/refresh", response_model=TokenPair)
async def auth_refresh(payload: dict, db: AsyncSession = Depends(get_db)):
    """Rotate the refresh token — the old one is revoked immediately."""
    payload_jwt = decode_token(payload.get("refresh_token", ""), expected_type="refresh")
    digest = hashlib.sha256(payload["refresh_token"].encode()).hexdigest()
    row = (await db.execute(select(SessionRow).where(
        SessionRow.refresh_hash == digest, SessionRow.revoked_at.is_(None)))).scalar_one_or_none()
    if row is None or row.expires_at < datetime.utcnow():
        raise HTTPException(401, "Refresh token revoked or expired")
    row.revoked_at = datetime.utcnow()
    await db.commit()
    admin = await db.get(AdminUser, uuid.UUID(payload_jwt["sub"]))
    return _issue_tokens(db, admin)


@router.get("/auth/me")
async def auth_me(me: dict = Depends(require("clients.read"))):
    return {"sub": me["sub"], "role": me["role"]}


# ══════════════ PROJECTS / CLIENTS (admin JWT + RBAC) ══════════════
@router.get("/projects", response_model=list[ClientOut])
async def list_projects(_: dict = Depends(require("clients.read")), db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Client).order_by(Client.created_at.desc()))).scalars().all()


@router.post("/projects", response_model=ApiKeyIssued, status_code=201)
async def create_project(body: ClientCreate, me: dict = Depends(require("clients.write")),
                         db: AsyncSession = Depends(get_db)):
    client = Client(name=body.name, platform=body.platform,
                    allowed_origins=body.allowed_origins,
                    rate_limit_per_min=body.rate_limit_per_min, webhook_url=body.webhook_url)
    db.add(client)
    await db.commit()
    visible, stored = generate_api_key()
    key = ApiKey(client_id=client.id, key_hash=stored, last4=visible[-4:])
    db.add(key)
    await db.commit()
    await db.refresh(key)
    await _audit(db, "projects", f"project created: {client.name} ({client.id})", actor=me["sub"])
    return ApiKeyIssued(key=ApiKeyOut.model_validate(key), visible_key=visible)


@router.post("/projects/{client_id}/keys/rotate", response_model=ApiKeyIssued)
async def rotate_key(client_id: uuid.UUID, me: dict = Depends(require("clients.write")),
                     db: AsyncSession = Depends(get_db)):
    old = (await db.execute(select(ApiKey).where(ApiKey.client_id == client_id,
                                                 ApiKey.revoked.is_(False)))).scalars().all()
    for k in old:
        k.revoked = True
    visible, stored = generate_api_key()
    key = ApiKey(client_id=client_id, key_hash=stored, last4=visible[-4:])
    db.add(key)
    await db.commit()
    await db.refresh(key)
    await _audit(db, "projects", f"api key rotated client={client_id}", actor=me["sub"], level="WARN")
    return ApiKeyIssued(key=ApiKeyOut.model_validate(key), visible_key=visible)


@router.delete("/projects/{client_id}", status_code=204)
async def delete_project(client_id: uuid.UUID, me: dict = Depends(require("clients.delete")),
                         db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, client_id)
    if client is None:
        raise HTTPException(404, "Project not found")
    await db.delete(client)
    await db.commit()
    await _audit(db, "projects", f"project deleted: {client.name}", actor=me["sub"], level="WARN")


# ══════════════ KNOWLEDGE (training rules) ══════════════
@router.get("/projects/{client_id}/knowledge", response_model=list[KnowledgeOut])
async def list_knowledge(client_id: uuid.UUID, _: dict = Depends(require("knowledge.read")),
                         db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(KnowledgeEntry).where(
        KnowledgeEntry.client_id == client_id).order_by(KnowledgeEntry.updated_at.desc()))).scalars().all()
    return rows


@router.post("/projects/{client_id}/knowledge", response_model=KnowledgeOut, status_code=201)
async def add_knowledge(client_id: uuid.UUID, body: KnowledgeCreate,
                        _: dict = Depends(require("knowledge.write")), db: AsyncSession = Depends(get_db)):
    engine = KnowledgeEngine(db)
    entry = await engine.learn(client_id, body.trigger_text, body.response_text,
                               body.tool_calls, learned=False)
    entry.category = body.category
    entry.active = body.active
    await db.commit()
    await db.refresh(entry)
    return entry


# ══════════════ TOOLS / USERS / HEALTH ══════════════
@router.get("/tools")
async def list_tools(_: dict = Depends(require("clients.read"))):
    return registry_list()


def registry_list():
    from tools import registry
    return registry.list()


@router.get("/projects/{client_id}/users")
async def list_users(client_id: uuid.UUID, _: dict = Depends(require("users.manage")),
                     db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).where(User.client_id == client_id))).scalars().all()
    return [{"id": str(u.id), "external_id": u.external_id, "plan": u.plan,
             "tokens_today": u.tokens_today, "tokens_month": u.tokens_month,
             "messages_total": u.messages_total, "cache_hits": u.cache_hits,
             "blocked": u.blocked} for u in rows]


@router.get("/system/health", response_model=HealthOut)
async def system_health(request: Request, db: AsyncSession = Depends(get_db)):
    from providers import factory
    db_ok, redis_ok, vector_ok = True, True, True
    try:
        await db.execute(select(1))
    except Exception:
        db_ok = False
    try:
        from core import get_redis
        await get_redis().ping()
    except Exception:
        redis_ok = False
    try:
        await db.execute(select(KnowledgeEntry).limit(1))
    except Exception:
        vector_ok = False
    return HealthOut(status="ok" if (db_ok and redis_ok) else "degraded",
                     version=request.app.version, db=db_ok, redis=redis_ok,
                     vector=vector_ok, providers=factory.configured())


# ══════════════ CLIENT PLANE — dual-factor security layer ══════════════
async def _verify_client_pair(db: AsyncSession, x_client_id: str | None, x_api_key: str | None) -> Client:
    """Both headers required; the key must be bound to exactly this project."""
    if not x_api_key:
        raise HTTPException(401, detail={"code": "INVALID_KEY", "message": "X-API-Key header is required"})
    if not x_client_id:
        raise HTTPException(401, detail={"code": "INVALID_KEY", "message": "X-Client-Id header is required"})
    key = (await db.execute(select(ApiKey).where(
        ApiKey.key_hash == hash_api_key(x_api_key), ApiKey.revoked.is_(False)))).scalar_one_or_none()
    if key is None:
        raise HTTPException(401, detail={"code": "INVALID_KEY", "message": "Unknown or revoked API key"})
    if str(key.client_id) != x_client_id:
        await _audit(db, "security", f"ACCESS_DENIED project mismatch key=…{x_api_key[-4:]}",
                     level="WARN", meta={"claimed": x_client_id, "bound_to": str(key.client_id)})
        raise HTTPException(403, detail={"code": "ACCESS_DENIED",
                                         "message": "API key does not belong to this project"})
    key.last_used_at = datetime.utcnow()
    client = await db.get(Client, key.client_id)
    if client is None or client.suspended:
        raise HTTPException(403, detail={"code": "SUSPENDED", "message": "Project is suspended"})
    await db.commit()
    return client


@router.post("/agent/process")
async def agent_process(payload: dict, request: Request,
                        x_client_id: str | None = Header(default=None, alias="X-Client-Id"),
                        x_api_key: str | None = Header(default=None, alias="X-API-Key"),
                        db: AsyncSession = Depends(get_db)):
    client = await _verify_client_pair(db, x_client_id, x_api_key)
    text = (payload.get("text") or "")[: settings.MAX_INPUT_LENGTH]
    if not text.strip():
        raise HTTPException(400, detail={"code": "VALIDATION", "message": "text must not be empty"})

    user_ref = payload.get("user_ref") or "anonymous"
    user = (await db.execute(select(User).where(User.client_id == client.id,
                                                User.external_id == user_ref))).scalar_one_or_none()
    if user is None:
        user = User(client_id=client.id, external_id=user_ref)
        db.add(user)
        await db.commit()

    from models import Conversation
    conv = Conversation(client_id=client.id, user_id=user.id)
    db.add(conv)
    await db.commit()

    agent = AgentCore(db, KnowledgeEngine(db))
    try:
        result = await agent.process_input(
            client=client, user=user, conversation_id=conv.id, text=text,
            model_map={"openai": client.ai_model or "gpt-4o-mini", "claude": "claude-haiku-4",
                       "gemini": "gemini-2.0-flash", "deepseek": "deepseek-chat"},
            cancel=CancelToken(), emit=None)
    except LimitExceeded as exc:
        raise HTTPException(402, detail={"code": "LIMIT_EXCEEDED", "message": str(exc)}) from exc

    return {"task_id": str(conv.id), "text": result.text, "source": result.source,
            "similarity": result.similarity, "tools": result.tools_used,
            "tokens": result.tokens, "cost_usd": result.cost_usd,
            "latency_ms": result.latency_ms}
