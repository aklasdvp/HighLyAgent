"""REST API v1 — admin auth (JWT), admin management endpoints and the
client-facing ingest with the mandatory Project-ID + API-Key pairing."""
from __future__ import annotations

import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import (
    create_token, decode_token, generate_api_key, get_db, get_redis, hash_api_key,
    hash_password, require, settings, verify_password,
)
from app.knowledge import KnowledgeEngine
from app.models import AdminUser, ApiKey, AuditLog, Client, KnowledgeEntry, SessionRow, Tool, User
from app.providers import factory
from app.schemas import (
    ApiKeyIssued, ApiKeyOut, ClientCreate, ClientOut, KnowledgeCreate, KnowledgeOut, TokenPair,
)

router = APIRouter(prefix=settings.API_V1_PREFIX, tags=["admin"])


def _audit(db: AsyncSession, actor: str, action: str, message: str):
    db.add(AuditLog(level="INFO", source="admin", actor=actor, message=f"{action} — {message}"))


# ════════════════ Auth plane (no API key — JWT only) ════════════════
class SetupIn(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-z0-9_.-]+$")
    email: str
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    identifier: str                      # username OR email
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


async def _issue_pair(db: AsyncSession, admin: AdminUser) -> TokenPair:
    access = create_token(str(admin.id), admin.role, "access")
    refresh = create_token(str(admin.id), admin.role, "refresh")
    db.add(SessionRow(admin_id=admin.id, refresh_hash=hash_api_key(refresh)))
    await db.commit()
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/auth/setup", response_model=TokenPair, status_code=201)
async def auth_setup(body: SetupIn, db: AsyncSession = Depends(get_db)):
    """First boot only — creates the admin. No auto-configuration ever happens."""
    existing = (await db.execute(select(AdminUser).limit(1))).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "admin already exists — use /auth/login")
    admin = AdminUser(username=body.username, email=body.email,
                      password_hash=hash_password(body.password), role="admin")
    db.add(admin)
    await db.flush()
    _audit(db, body.username, "ADMIN_SETUP", "initial admin created manually")
    return await _issue_pair(db, admin)


@router.post("/auth/login", response_model=TokenPair)
async def auth_login(body: LoginIn, db: AsyncSession = Depends(get_db)):
    admin = (await db.execute(select(AdminUser).where(
        (AdminUser.username == body.identifier) | (AdminUser.email == body.identifier))
    )).scalar_one_or_none()
    if admin is None or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    _audit(db, admin.username, "LOGIN", "JWT pair issued (access 30m / refresh 7d)")
    return await _issue_pair(db, admin)


@router.post("/auth/refresh", response_model=TokenPair)
async def auth_refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token, expected_type="refresh")
    row = (await db.execute(select(SessionRow).where(
        SessionRow.refresh_hash == hash_api_key(body.refresh_token),
        SessionRow.revoked_at.is_(None)))).scalar_one_or_none()
    if row is None or row.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "refresh token revoked or expired")
    row.revoked_at = datetime.utcnow()                    # rotation — single use
    admin = await db.get(AdminUser, uuid.UUID(payload["sub"]))
    if admin is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "admin vanished")
    return await _issue_pair(db, admin)


@router.get("/auth/me")
async def auth_me(who: dict = Depends(require())):
    return {"sub": who["sub"], "role": who["role"]}


# ════════════════ Admin plane — projects & keys ════════════════
@router.get("/projects", response_model=list[ClientOut])
async def list_projects(_: dict = Depends(require("clients.read")), db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Client).order_by(Client.created_at.desc()))).scalars().all()


@router.post("/projects", status_code=201)
async def create_project(body: ClientCreate, who: dict = Depends(require("clients.write")),
                         db: AsyncSession = Depends(get_db)):
    client = Client(**body.model_dump())
    db.add(client)
    await db.flush()
    visible, key_hash = generate_api_key()
    key = ApiKey(client_id=client.id, key_hash=key_hash, last4=visible[-4:], label="default")
    db.add(key)
    _audit(db, who["sub"], "CLIENT_CREATE", f"{client.name} — key issued (shown once)")
    await db.commit()
    return {"client": ClientOut.model_validate(client),
            "key": ApiKeyIssued(key=ApiKeyOut.model_validate(key), visible_key=visible)}


@router.patch("/projects/{project_id}")
async def update_project(project_id: uuid.UUID, patch: dict, _: dict = Depends(require("clients.write")),
                         db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")
    for k, v in patch.items():
        if hasattr(client, k) and k != "id":
            setattr(client, k, v)
    await db.commit()
    return ClientOut.model_validate(client)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: uuid.UUID, who: dict = Depends(require("clients.delete")),
                         db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")
    _audit(db, who["sub"], "CLIENT_DELETE", f"{client.name} — keys revoked, KB purged")
    await db.delete(client)
    await db.commit()


@router.post("/projects/{project_id}/keys/rotate")
async def rotate_key(project_id: uuid.UUID, who: dict = Depends(require("clients.write")),
                     db: AsyncSession = Depends(get_db)):
    old = (await db.execute(select(ApiKey).where(
        ApiKey.client_id == project_id, ApiKey.revoked.is_(False)))).scalars().all()
    for k in old:
        k.revoked = True                                  # previous key dies instantly
    visible, key_hash = generate_api_key()
    key = ApiKey(client_id=project_id, key_hash=key_hash, last4=visible[-4:], label="rotated")
    db.add(key)
    _audit(db, who["sub"], "API_KEY_REGENERATE", f"project={project_id} old key revoked")
    await db.commit()
    return ApiKeyIssued(key=ApiKeyOut.model_validate(key), visible_key=visible)


# ════════════════ Client ingest — the security layer ════════════════
class ProcessIn(BaseModel):
    user_ref: str = "anonymous"
    text: str = Field(min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = None


@router.post("/agent/process", tags=["client"])
async def agent_process(body: ProcessIn, request: Request, db: AsyncSession = Depends(get_db)):
    """Dual-factor access: BOTH X-Client-Id and X-API-Key are required and must match.
    An API key alone is never enough — a mismatched project id is rejected with 403."""
    started = time.perf_counter()
    client_id_raw = request.headers.get("X-Client-Id")
    api_key = request.headers.get("X-API-Key")
    if not client_id_raw or not api_key:
        raise HTTPException(401, {"code": "INVALID_KEY",
                                  "message": "Both X-Client-Id and X-API-Key headers are required"})

    key = (await db.execute(select(ApiKey).where(
        ApiKey.key_hash == hash_api_key(api_key), ApiKey.revoked.is_(False)))).scalar_one_or_none()
    if key is None:
        raise HTTPException(401, {"code": "INVALID_KEY", "message": "unknown or revoked API key"})
    if str(key.client_id) != client_id_raw:
        _audit(db, client_id_raw, "ACCESS_DENIED", f"key ••••{key.last4} does not belong to project {client_id_raw}")
        await db.commit()
        raise HTTPException(403, {"code": "ACCESS_DENIED",
                                  "message": "API key does not belong to this project (id/key mismatch)"})

    client = await db.get(Client, key.client_id)
    if client is None or client.suspended:
        raise HTTPException(403, {"code": "SUSPENDED", "message": "project is suspended"})

    key.last_used_at = datetime.utcnow()

    # per-user quota ledger
    user = (await db.execute(select(User).where(
        User.client_id == client.id, User.external_id == body.user_ref))).scalar_one_or_none()
    if user is None:
        user = User(client_id=client.id, external_id=body.user_ref)
        db.add(user)
        await db.flush()
    if user.blocked or (user.plan != "unlimited" and user.tokens_today >= user.daily_token_limit):
        user.blocked = True
        await db.commit()
        raise HTTPException(402, {"code": "LIMIT_EXCEEDED", "message": "daily token limit reached"})

    engine = KnowledgeEngine(db)
    hit = await engine.search(client.id, body.text)
    if hit.entry is not None:
        user.cache_hits += 1
        await db.commit()
        return {"task_id": str(uuid.uuid4()), "text": hit.entry.response_text, "source": "knowledge",
                "similarity": hit.similarity, "tools": hit.entry.tool_calls,
                "tokens": 0, "cost_usd": 0.0,
                "latency_ms": int((time.perf_counter() - started) * 1000)}

    model_map = {"openai": "gpt-4o-mini", "claude": "claude-haiku-4",
                 "gemini": "gemini-2.0-flash", "deepseek": "deepseek-chat"}
    out = await factory.generate(
        [{"role": "system", "content": "You are the embedded assistant of " + client.name + "."},
         {"role": "user", "content": body.text}],
        temperature=0.3, max_tokens=400, model_map=model_map)

    if settings.AUTO_LEARN:
        await engine.learn(client.id, body.text, out.text, tool_calls=[])

    user.tokens_today += out.tokens
    user.tokens_month += out.tokens
    user.messages_total += 1
    await db.commit()
    return {"task_id": str(uuid.uuid4()), "text": out.text, "source": "ai", "similarity": hit.similarity,
            "tools": [], "tokens": out.tokens, "cost_usd": out.cost_usd,
            "latency_ms": int((time.perf_counter() - started) * 1000)}


# ════════════════ Admin plane — knowledge / tools / users / health ════════════════
@router.get("/projects/{project_id}/knowledge", response_model=list[KnowledgeOut])
async def list_knowledge(project_id: uuid.UUID, _: dict = Depends(require("knowledge.read")),
                         db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(KnowledgeEntry).where(
        KnowledgeEntry.client_id == project_id).order_by(KnowledgeEntry.updated_at.desc()))).scalars().all()


@router.post("/projects/{project_id}/knowledge", status_code=201)
async def add_knowledge(project_id: uuid.UUID, body: KnowledgeCreate,
                        _: dict = Depends(require("knowledge.write")), db: AsyncSession = Depends(get_db)):
    entry = await KnowledgeEngine(db).learn(project_id, body.trigger_text, body.response_text,
                                            body.tool_calls, learned=False)
    return KnowledgeOut.model_validate(entry)


@router.get("/tools", response_model=list[dict])
async def list_tools(_: dict = Depends(require("clients.read")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Tool))).scalars().all()
    return [{"id": str(t.id), "name": t.name, "type": t.type, "enabled": t.enabled,
             "description": t.description, "schema": t.schema} for t in rows]


@router.get("/projects/{project_id}/users")
async def list_users(project_id: uuid.UUID, _: dict = Depends(require("clients.read")),
                     db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).where(User.client_id == project_id))).scalars().all()
    return [{"id": str(u.id), "external_id": u.external_id, "plan": u.plan,
             "tokens_today": u.tokens_today, "tokens_month": u.tokens_month,
             "cache_hits": u.cache_hits, "blocked": u.blocked} for u in rows]


@router.get("/system/health")
async def system_health(db: AsyncSession = Depends(get_db)):
    ok_db = True
    try:
        await db.execute(select(1))
    except Exception:
        ok_db = False
    ok_redis = True
    try:
        await get_redis().ping()
    except Exception:
        ok_redis = False
    return {"status": "ok" if ok_db and ok_redis else "degraded", "version": "2.4.1",
            "db": ok_db, "redis": ok_redis, "vector": ok_db,
            "fallback_chain": factory.chain,
            "providers": {name: (p.api_key != "") for name, p in factory._providers.items()}}
