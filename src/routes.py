"""REST API — admin auth (JWT), management endpoints, and the client-facing
ingest with the mandatory Project-ID + API-Key pairing.

All responses use the standardized envelope (see ``response``):
success/data/message/timestamp; error responses also carry error_code/detail;
list responses carry total/limit/offset/items.
"""
from __future__ import annotations

import hmac
import time
import uuid
from datetime import datetime, timedelta

import jsonschema
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api_key_manager import authenticate_project_key, require_management
from core import (
    create_token, decode_token, generate_api_key, get_db, get_redis, hash_api_key,
    hash_password, settings, verify_password,
)
from knowledge import KnowledgeEngine
from models import ApiKey, AuditLog, Client, Conversation, KnowledgeEntry, Message, Tool, User
from providers import DEFAULT_MODEL_MAP, factory
from response import ok, ok_list
from schemas import (
    ApiKeyOut, ClientCreate, ClientOut, KnowledgeCreate, KnowledgeOut, ProjectLimits,
    TokenPair, ToolCreate,
)


class ProviderConfig(BaseModel):
    """Provider configuration for management."""
    name: str
    configured: bool
    has_key: bool


class ProviderOut(BaseModel):
    """Provider output schema."""
    name: str
    configured: bool
    has_key: bool
    default_model: str | None = None

router = APIRouter(prefix=settings.API_V1_PREFIX, tags=["admin"])


def _audit(db: AsyncSession, actor: str, action: str, message: str):
    db.add(AuditLog(level="INFO", source="admin", actor=actor, message=f"{action} — {message}"))


# ════════════════ Auth plane (JWT only — no setup) ════════════════
class LoginIn(BaseModel):
    username: str
    password: str


async def _verify_management_credentials(username: str, password: str) -> bool:
    """Verify management credentials against .env variables (plain text comparison)."""
    if not settings.MANAGEMENT_USERNAME or not settings.MANAGEMENT_PASSWORD:
        return False
    # Plain text comparison for username and password from .env
    return hmac.compare_digest(username.strip(), settings.MANAGEMENT_USERNAME.strip()) and \
           hmac.compare_digest(password, settings.MANAGEMENT_PASSWORD)


async def _issue_pair_for_management() -> TokenPair:
    """Issue JWT tokens for management user (credentials from .env)."""
    access = create_token("management", "admin", "access")
    refresh = create_token("management", "admin", "refresh")
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/auth/login")
async def auth_login(body: LoginIn):
    """Login with management credentials from .env (username + password)."""
    if not await _verify_management_credentials(body.username, body.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    return ok((await _issue_pair_for_management()).model_dump(), "login successful", {"username": settings.MANAGEMENT_USERNAME})


@router.post("/auth/refresh")
async def auth_refresh(body: RefreshIn):
    """Refresh access token using refresh token."""
    payload = decode_token(body.refresh_token, expected_type="refresh")
    # For simple env-based auth, we just re-issue tokens without session tracking
    return ok((await _issue_pair_for_management()).model_dump(), "tokens refreshed")


@router.get("/auth/me")
async def auth_me(who: dict = Depends(require_management())):
    """Get current authenticated user info."""
    return ok({"sub": who["sub"], "role": who["role"]}, "identity")


# ════════════════ Management plane — projects & keys ════════════════
@router.get("/projects")
async def list_projects(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                        _: dict = Depends(require_management("clients.read")),
                        db: AsyncSession = Depends(get_db)):
    stmt = select(Client).order_by(Client.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return ok_list([ClientOut.model_validate(c).model_dump() for c in rows], total, limit, offset,
                   "projects listed")


@router.post("/projects", status_code=201)
async def create_project(body: ClientCreate, who: dict = Depends(require_management("clients.write")),
                         db: AsyncSession = Depends(get_db)):
    client = Client(**body.model_dump())
    db.add(client)
    await db.flush()
    visible, key_hash = generate_api_key()
    key = ApiKey(client_id=client.id, key_hash=key_hash, last4=visible[-4:], label="default")
    db.add(key)
    _audit(db, who["sub"], "CLIENT_CREATE", f"{client.name} — key issued (shown once)")
    await db.commit()
    return ok({
        "client": ClientOut.model_validate(client).model_dump(),
        "key": {"key": ApiKeyOut.model_validate(key).model_dump(), "visible_key": visible},
    }, "project created — save the visible API key now")


@router.patch("/projects/{project_id}")
async def update_project(project_id: uuid.UUID, patch: dict,
                         _: dict = Depends(require_management("clients.write")),
                         db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")
    for k, v in patch.items():
        if hasattr(client, k) and k != "id":
            setattr(client, k, v)
    await db.commit()
    await db.refresh(client)
    return ok(ClientOut.model_validate(client).model_dump(), "project updated")


@router.patch("/projects/{project_id}/limits")
async def set_project_limits(project_id: uuid.UUID, body: ProjectLimits,
                             who: dict = Depends(require_management("clients.write")),
                             db: AsyncSession = Depends(get_db)):
    """Configure per-user usage limits for a project. None means 'inherit defaults'."""
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")
    for k, v in body.model_dump().items():
        setattr(client, k, v)
    _audit(db, who["sub"], "CLIENT_LIMITS", f"{client.name} limits updated")
    await db.commit()
    await db.refresh(client)
    return ok({
        "project_id": str(client.id),
        "daily_request_limit": client.daily_request_limit,
        "monthly_request_limit": client.monthly_request_limit,
        "daily_token_limit": client.daily_token_limit,
        "monthly_token_limit": client.monthly_token_limit,
    }, "limits updated")


@router.delete("/projects/{project_id}")
async def delete_project(project_id: uuid.UUID, who: dict = Depends(require_management("clients.delete")),
                         db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")
    _audit(db, who["sub"], "CLIENT_DELETE", f"{client.name} — keys revoked, KB purged")
    await db.delete(client)
    await db.commit()
    return ok(None, "project deleted")


@router.post("/projects/{project_id}/keys/rotate")
async def rotate_key(project_id: uuid.UUID, who: dict = Depends(require_management("clients.write")),
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
    return ok({
        "key": ApiKeyOut.model_validate(key).model_dump(), "visible_key": visible,
    }, "API key rotated — old key is now invalid")


# ════════════════ Client ingest — the security layer ════════════════
class ProcessIn(BaseModel):
    user_ref: str = "anonymous"
    text: str = Field(min_length=1, max_length=4000)
    conversation_id: uuid.UUID | None = None


async def _ensure_conversation(db: AsyncSession, user: User,
                               conversation_id: uuid.UUID | None) -> Conversation:
    if conversation_id is not None:
        conv = await db.get(Conversation, conversation_id)
        if conv is not None and str(conv.user_id) == str(user.id):
            return conv
    conv = Conversation(user_id=user.id)
    db.add(conv)
    await db.flush()
    return conv


def _persist_turn(db: AsyncSession, conversation_id: uuid.UUID, user: User, text: str,
                  answer: str, source: str, provider: str | None, tokens: int,
                  latency_ms: int, tools: list | None = None):
    """Record usage counters and durable message rows (for analytics)."""
    db.add(Message(conversation_id=conversation_id, role="user", content=text))
    db.add(Message(conversation_id=conversation_id, role="assistant", content=answer,
                   source=source, provider=provider, tokens=tokens, latency_ms=latency_ms,
                   tools_used=tools or []))
    user.tokens_today += tokens
    user.tokens_month += tokens
    user.requests_today += 1
    user.requests_month += 1
    user.messages_total += 1


@router.post("/agent/process", tags=["client"])
async def agent_process(body: ProcessIn, request: Request, db: AsyncSession = Depends(get_db)):
    """Dual-factor access: BOTH X-Client-Id and X-API-Key are required and must match."""
    started = time.perf_counter()
    client, key = await authenticate_project_key(
        db, request.headers.get("X-Client-Id"), request.headers.get("X-API-Key"))

    key.last_used_at = datetime.utcnow()

    # per-user quota ledger
    user = (await db.execute(select(User).where(
        User.client_id == client.id, User.external_id == body.user_ref))).scalar_one_or_none()
    if user is None:
        user = User(client_id=client.id, external_id=body.user_ref)
        db.add(user)
        await db.flush()

    if user.blocked:
        await db.commit()
        raise HTTPException(403, {"code": "BLOCKED", "message": "user is blocked by admin"})
    if user.plan != "unlimited":
        if client.daily_request_limit is not None and user.requests_today >= client.daily_request_limit:
            await db.commit()
            raise HTTPException(402, {"code": "LIMIT_EXCEEDED", "message": "daily request limit reached"})
        if client.monthly_request_limit is not None and user.requests_month >= client.monthly_request_limit:
            await db.commit()
            raise HTTPException(402, {"code": "LIMIT_EXCEEDED", "message": "monthly request limit reached"})
        daily_tokens = client.daily_token_limit if client.daily_token_limit is not None else user.daily_token_limit
        monthly_tokens = (client.monthly_token_limit if client.monthly_token_limit is not None
                          else user.monthly_token_limit)
        if user.tokens_today >= daily_tokens:
            user.blocked = True
            await db.commit()
            raise HTTPException(402, {"code": "LIMIT_EXCEEDED", "message": "daily token limit reached"})
        if user.tokens_month >= monthly_tokens:
            await db.commit()
            raise HTTPException(402, {"code": "LIMIT_EXCEEDED", "message": "monthly token limit reached"})

    conv = await _ensure_conversation(db, user, body.conversation_id)
    engine = KnowledgeEngine(db)

    def _latency_ms() -> int:
        return int((time.perf_counter() - started) * 1000)

    try:
        hit = await engine.search(client.id, body.text)
        if hit.entry is not None:
            user.cache_hits += 1
            _persist_turn(db, conv.id, user, body.text, hit.entry.response_text,
                          "cache", None, 0, _latency_ms(), tools=hit.entry.tool_calls)
            await db.commit()
            return ok({
                "task_id": str(uuid.uuid4()), "text": hit.entry.response_text, "source": "knowledge",
                "similarity": hit.similarity, "tools": hit.entry.tool_calls,
                "tokens": 0, "cost_usd": 0.0, "latency_ms": _latency_ms(),
            }, "knowledge answer")

        system_prompt = "You are the embedded assistant of " + client.name + "."
        if client.behavior_description:
            system_prompt += " " + client.behavior_description
        provider_override, model_override = factory.project_config(client.ai_provider, client.ai_model)
        out = await factory.complete_with_fallback(
            [{"role": "system", "content": system_prompt},
             {"role": "user", "content": body.text}],
            temperature=0.3, max_tokens=400, model_map=DEFAULT_MODEL_MAP,
            provider_override=provider_override, model_override=model_override)

        if settings.AUTO_LEARN:
            await engine.learn(client.id, body.text, out.text, tool_calls=[])

        tokens = out.tokens_in + out.tokens_out
        _persist_turn(db, conv.id, user, body.text, out.text, "provider", out.provider,
                      tokens, _latency_ms())
        await db.commit()
        return ok({
            "task_id": str(uuid.uuid4()), "text": out.text, "source": "ai",
            "similarity": hit.similarity, "tools": [], "tokens": tokens,
            "cost_usd": out.cost_usd, "latency_ms": _latency_ms(),
        }, "ai answer")
    except HTTPException:
        raise
    except Exception:
        user.errors_total = (user.errors_total or 0) + 1
        await db.commit()
        raise


# ════════════════ Management plane — knowledge / tools / users / analytics ════════════════
@router.get("/projects/{project_id}/knowledge")
async def list_knowledge(project_id: uuid.UUID, limit: int = Query(50, ge=1, le=500),
                         offset: int = Query(0, ge=0),
                         _: dict = Depends(require_management("knowledge.read")),
                         db: AsyncSession = Depends(get_db)):
    """List knowledge entries (curated AND auto-learned)."""
    stmt = (select(KnowledgeEntry).where(KnowledgeEntry.client_id == project_id)
            .order_by(KnowledgeEntry.updated_at.desc()))
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return ok_list([KnowledgeOut.model_validate(e).model_dump() for e in rows], total, limit, offset,
                   "knowledge listed")


@router.post("/projects/{project_id}/knowledge", status_code=201)
async def add_knowledge(project_id: uuid.UUID, body: KnowledgeCreate,
                        _: dict = Depends(require_management("knowledge.write")),
                        db: AsyncSession = Depends(get_db)):
    entry = await KnowledgeEngine(db).learn(project_id, body.trigger_text, body.response_text,
                                            body.tool_calls, learned=False)
    return ok(KnowledgeOut.model_validate(entry).model_dump(), "knowledge added")


@router.get("/projects/{project_id}/knowledge/{entry_id}")
async def get_knowledge(project_id: uuid.UUID, entry_id: uuid.UUID,
                        _: dict = Depends(require_management("knowledge.read")),
                        db: AsyncSession = Depends(get_db)):
    entry = await db.get(KnowledgeEntry, entry_id)
    if entry is None or str(entry.client_id) != str(project_id):
        raise HTTPException(404, "knowledge entry not found")
    return ok(KnowledgeOut.model_validate(entry).model_dump(), "knowledge entry")


@router.put("/projects/{project_id}/knowledge/{entry_id}")
async def update_knowledge(project_id: uuid.UUID, entry_id: uuid.UUID, body: KnowledgeCreate,
                           who: dict = Depends(require_management("knowledge.write")),
                           db: AsyncSession = Depends(get_db)):
    """Update a knowledge entry (works for auto-learned entries too)."""
    entry = await db.get(KnowledgeEntry, entry_id)
    if entry is None or str(entry.client_id) != str(project_id):
        raise HTTPException(404, "knowledge entry not found")
    trigger_changed = entry.trigger_text != body.trigger_text
    entry.category = body.category
    entry.trigger_text = body.trigger_text
    entry.response_text = body.response_text
    entry.tool_calls = body.tool_calls
    entry.active = body.active
    if trigger_changed:
        (vec,) = await factory.embed([body.trigger_text])
        entry.embedding = vec
    _audit(db, who["sub"], "KNOWLEDGE_UPDATE", f"entry={entry_id}")
    await db.commit()
    await db.refresh(entry)
    return ok(KnowledgeOut.model_validate(entry).model_dump(), "knowledge updated")


@router.delete("/projects/{project_id}/knowledge/{entry_id}")
async def delete_knowledge(project_id: uuid.UUID, entry_id: uuid.UUID,
                           who: dict = Depends(require_management("knowledge.write")),
                           db: AsyncSession = Depends(get_db)):
    entry = await db.get(KnowledgeEntry, entry_id)
    if entry is None or str(entry.client_id) != str(project_id):
        raise HTTPException(404, "knowledge entry not found")
    _audit(db, who["sub"], "KNOWLEDGE_DELETE", f"entry={entry_id}")
    await db.delete(entry)
    await db.commit()
    return ok(None, "knowledge deleted")


@router.get("/tools")
async def list_tools(limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0),
                     _: dict = Depends(require_management("clients.read")),
                     db: AsyncSession = Depends(get_db)):
    stmt = select(Tool).order_by(Tool.name)
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    items = [{"id": str(t.id), "name": t.name, "type": t.type, "enabled": t.enabled,
              "description": t.description, "schema": t.schema} for t in rows]
    return ok_list(items, total, limit, offset, "tools listed")


@router.post("/tools", status_code=201)
async def create_tool(body: ToolCreate, who: dict = Depends(require_management("tools.manage")),
                      db: AsyncSession = Depends(get_db)):
    """Register a project tool (server or client). Server tools must have an
    implementation name known to the tool registry (e.g. weather.fetch)."""
    jsonschema.Draft202012Validator.check_schema(body.schema)
    tool = Tool(name=body.name, description=body.description, type=body.type, schema=body.schema)
    db.add(tool)
    _audit(db, who["sub"], "TOOL_CREATE", body.name)
    await db.commit()
    await db.refresh(tool)
    return ok({"id": str(tool.id), "name": tool.name, "type": tool.type, "enabled": tool.enabled,
               "description": tool.description, "schema": tool.schema}, "tool created")


@router.patch("/tools/{tool_id}")
async def update_tool(tool_id: uuid.UUID, patch: dict, who: dict = Depends(require_management("tools.manage")),
                      db: AsyncSession = Depends(get_db)):
    """Update a tool (e.g. enable/disable, change schema or description)."""
    tool = await db.get(Tool, tool_id)
    if tool is None:
        raise HTTPException(404, "tool not found")
    for k, v in patch.items():
        if hasattr(tool, k) and k != "id":
            if k == "schema":
                jsonschema.Draft202012Validator.check_schema(v)
            setattr(tool, k, v)
    await db.commit()
    return ok({"id": str(tool.id), "name": tool.name, "type": tool.type, "enabled": tool.enabled,
               "description": tool.description, "schema": tool.schema}, "tool updated")


@router.delete("/tools/{tool_id}")
async def delete_tool(tool_id: uuid.UUID, confirm: bool = Query(False),
                      who: dict = Depends(require_management("tools.manage")),
                      db: AsyncSession = Depends(get_db)):
    """Delete a tool from every project. Requires explicit ?confirm=true."""
    if not confirm:
        raise HTTPException(400, {"code": "CONFIRMATION_REQUIRED",
                                  "message": "Pass ?confirm=true to permanently delete this tool from all projects"})
    tool = await db.get(Tool, tool_id)
    if tool is None:
        raise HTTPException(404, "tool not found")
    _audit(db, who["sub"], "TOOL_DELETE", tool.name)
    await db.delete(tool)
    await db.commit()
    return ok(None, "tool deleted")


@router.get("/projects/{project_id}/users")
async def list_users(project_id: uuid.UUID, limit: int = Query(50, ge=1, le=500),
                     offset: int = Query(0, ge=0),
                     _: dict = Depends(require_management("clients.read")),
                     db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.client_id == project_id).order_by(User.created_at.desc())
    total = (await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    items = [{"id": str(u.id), "external_id": u.external_id, "plan": u.plan,
              "tokens_today": u.tokens_today, "tokens_month": u.tokens_month,
              "requests_today": u.requests_today, "requests_month": u.requests_month,
              "cache_hits": u.cache_hits, "blocked": u.blocked} for u in rows]
    return ok_list(items, total, limit, offset, "users listed")


@router.get("/projects/{project_id}/analytics")
async def project_analytics(project_id: uuid.UUID, _: dict = Depends(require_management("clients.read")),
                            db: AsyncSession = Depends(get_db)):
    """Usage analytics for a project (users, requests, tokens, tools, intents, errors)."""
    client = await db.get(Client, project_id)
    if client is None:
        raise HTTPException(404, "project not found")

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    month_start = today_start.replace(day=1)
    thirty_days_ago = today_start - timedelta(days=29)

    Msg = Message
    Conv = Conversation
    Usr = User
    msg_sub = (select(Msg.id, Msg.tokens, Msg.latency_ms, Msg.tools_used, Msg.intent, Msg.created_at)
               .join(Conv, Msg.conversation_id == Conv.id)
               .join(Usr, Conv.user_id == Usr.id)
               .where(Usr.client_id == project_id).subquery())

    total_users = (await db.execute(
        select(func.count()).select_from(Usr).where(Usr.client_id == project_id))).scalar_one()
    daily_active = (await db.execute(
        select(func.count()).select_from(Usr).where(
            Usr.client_id == project_id, func.coalesce(Usr.requests_today, 0) > 0))).scalar_one()

    async def _count(since: datetime | None = None) -> int:
        q = select(func.count()).select_from(msg_sub)
        if since is not None:
            q = q.where(msg_sub.c.created_at >= since)
        return (await db.execute(q)).scalar_one()

    req_today = _count(today_start)
    req_month = _count(month_start)
    req_all = _count()

    daily_rows = (await db.execute(
        select(func.date(msg_sub.c.created_at).label("d"), func.count().label("c"))
        .where(msg_sub.c.created_at >= thirty_days_ago)
        .group_by(func.date(msg_sub.c.created_at))
        .order_by(func.date(msg_sub.c.created_at)))).all()
    daily_requests = [{"date": str(r.d), "count": r.c} for r in daily_rows]

    total_tokens = (await db.execute(
        select(func.coalesce(func.sum(msg_sub.c.tokens), 0)))).scalar_one()
    avg_tokens_per_user = round(total_tokens / total_users, 2) if total_users else 0.0

    tool_rows = (await db.execute(
        select(msg_sub.c.tools_used).where(msg_sub.c.created_at >= thirty_days_ago))).scalars().all()
    tool_counts: dict[str, int] = {}
    for lst in tool_rows:
        for t in (lst or []):
            tool_counts[t] = tool_counts.get(t, 0) + 1
    most_used_tools = [{"tool": t, "count": c} for t, c in
                       sorted(tool_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]]

    intent_rows = (await db.execute(
        select(msg_sub.c.intent, func.count()).where(msg_sub.c.intent.is_not(None))
        .group_by(msg_sub.c.intent).order_by(func.count().desc()).limit(10))).all()
    most_common_intents = [{"intent": r[0], "count": r[1]} for r in intent_rows]

    total_errors = (await db.execute(
        select(func.coalesce(func.sum(Usr.errors_total), 0)).where(Usr.client_id == project_id))).scalar_one()
    error_rate = round(total_errors / max(req_all, 1) * 100, 2)

    avg_latency = (await db.execute(
        select(func.coalesce(func.avg(msg_sub.c.latency_ms), 0)))).scalar_one()

    return ok({
        "project_id": str(project_id),
        "total_users": total_users,
        "daily_active_users": daily_active,
        "requests": {"today": req_today, "month": req_month, "all_time": req_all},
        "daily_requests_30d": daily_requests,
        "tokens": {"total": total_tokens, "avg_per_user": avg_tokens_per_user},
        "most_used_tools": most_used_tools,
        "most_common_intents": most_common_intents,
        "error_rate": error_rate,
        "avg_response_ms": round(float(avg_latency), 2),
    }, "analytics")


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
    from application import __version__
    return ok({
        "status": "ok" if ok_db and ok_redis else "degraded",
        "version": __version__,
        "db": ok_db, "redis": ok_redis, "vector": ok_db,
        "fallback_chain": factory.chain,
        "providers": factory.configured(),
    }, "health")


# ════════════════ AI Provider Management ════════════════
@router.get("/providers")
async def list_providers(_: dict = Depends(require_management("providers.manage"))):
    """List all configured AI providers with their status."""
    configured = factory.configured()
    items = []
    for name in ["openai", "claude", "gemini", "deepseek"]:
        items.append({
            "name": name,
            "configured": configured.get(name, False),
            "has_key": bool(factory._keys.get(name)),
            "default_model": DEFAULT_MODEL_MAP.get(name),
        })
    return ok({"providers": items}, "providers listed")


class ProviderUpdate(BaseModel):
    """Provider update schema (for documentation — keys come from .env)."""
    note: str = "Provider API keys are configured via environment variables only"


@router.get("/providers/{provider_name}")
async def get_provider(provider_name: str, _: dict = Depends(require_management("providers.manage"))):
    """Get a specific provider's configuration status."""
    if provider_name not in ["openai", "claude", "gemini", "deepseek"]:
        raise HTTPException(404, "provider not found")
    configured = factory.configured()
    return ok({
        "name": provider_name,
        "configured": configured.get(provider_name, False),
        "has_key": bool(factory._keys.get(provider_name)),
        "default_model": DEFAULT_MODEL_MAP.get(provider_name),
    }, "provider details")
