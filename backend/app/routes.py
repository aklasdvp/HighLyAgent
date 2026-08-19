"""REST API v1 — Admin Control Center endpoints (all manual configuration)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import decode_token, generate_api_key, get_db, require
from app.knowledge import KnowledgeEngine
from app.models import ApiKey, AuditLog, Client, KnowledgeEntry, Tool, User, Workflow
from app.schemas import (ApiKeyIssued, ApiKeyOut, ClientCreate, ClientOut, HealthOut,
                         KnowledgeCreate, KnowledgeHit, KnowledgeOut, ToolCreate)
from app import __version__

router = APIRouter(prefix="/api/v1")


async def audit(db: AsyncSession, level: str, source: str, message: str, actor: str | None = None):
    db.add(AuditLog(level=level, source=source, message=message, actor=actor))
    await db.commit()


# ── Auth ────────────────────────────────────────────────
@router.post("/auth/refresh")
async def refresh(payload: dict):
    data = decode_token(payload.get("refresh_token", ""), expected_type="refresh")
    from app.core import create_token
    return {"access_token": create_token(data["sub"], data["role"]), "token_type": "bearer"}


# ── Clients & API keys ──────────────────────────────────
@router.get("/clients", response_model=list[ClientOut])
async def list_clients(db: AsyncSession = Depends(get_db), _: dict = Depends(require("clients.read"))):
    return (await db.execute(select(Client).order_by(Client.created_at.desc()))).scalars().all()


@router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(body: ClientCreate, db: AsyncSession = Depends(get_db),
                        actor: dict = Depends(require("clients.write"))):
    client = Client(**body.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    await audit(db, "INFO", "clients", f"client.created name={client.name}", actor.get("sub"))
    return client


@router.post("/clients/{client_id}/keys", response_model=ApiKeyIssued, status_code=201)
async def issue_key(client_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                    actor: dict = Depends(require("clients.write"))):
    visible, hashed = generate_api_key()
    key = ApiKey(client_id=client_id, key_hash=hashed, last4=visible[-4:])
    db.add(key)
    await db.commit()
    await db.refresh(key)
    await audit(db, "WARN", "security", f"apikey.issued client={client_id} last4={key.last4}", actor.get("sub"))
    return ApiKeyIssued(key=ApiKeyOut.model_validate(key), visible_key=visible)


@router.post("/clients/{client_id}/keys/{key_id}/rotate", response_model=ApiKeyIssued)
async def rotate_key(client_id: uuid.UUID, key_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                     actor: dict = Depends(require("clients.write"))):
    old = await db.get(ApiKey, key_id)
    if old is None or old.client_id != client_id:
        raise HTTPException(404, "key not found")
    old.revoked = True
    visible, hashed = generate_api_key()
    new = ApiKey(client_id=client_id, key_hash=hashed, last4=visible[-4:])
    db.add(new)
    await db.commit()
    await db.refresh(new)
    await audit(db, "WARN", "security", f"apikey.rotated client={client_id}", actor.get("sub"))
    return ApiKeyIssued(key=ApiKeyOut.model_validate(new), visible_key=visible)


# ── Knowledge ───────────────────────────────────────────
@router.get("/clients/{client_id}/knowledge", response_model=list[KnowledgeOut])
async def list_knowledge(client_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                         _: dict = Depends(require("knowledge.read"))):
    return (await db.execute(select(KnowledgeEntry)
                             .where(KnowledgeEntry.client_id == client_id)
                             .order_by(KnowledgeEntry.updated_at.desc()))).scalars().all()


@router.post("/clients/{client_id}/knowledge", response_model=KnowledgeOut, status_code=201)
async def create_knowledge(client_id: uuid.UUID, body: KnowledgeCreate,
                           db: AsyncSession = Depends(get_db),
                           actor: dict = Depends(require("knowledge.write"))):
    engine = KnowledgeEngine(db)
    entry = await engine.learn(client_id, body.trigger_text, body.response_text,
                               body.tool_calls, learned=False)
    await audit(db, "INFO", "knowledge", f"knowledge.created id={entry.id}", actor.get("sub"))
    return entry


@router.post("/clients/{client_id}/knowledge/search", response_model=KnowledgeHit | None)
async def search_knowledge(client_id: uuid.UUID, body: dict, db: AsyncSession = Depends(get_db),
                           _: dict = Depends(require("knowledge.read"))):
    res = await KnowledgeEngine(db).search(client_id, body.get("text", ""),
                                           threshold=body.get("threshold"))
    if res.entry is None:
        return None
    return KnowledgeHit(entry=KnowledgeOut.model_validate(res.entry), similarity=res.similarity)


@router.delete("/knowledge/{entry_id}", status_code=204)
async def delete_knowledge(entry_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                           actor: dict = Depends(require("knowledge.delete"))):
    entry = await db.get(KnowledgeEntry, entry_id)
    if entry:
        await db.delete(entry)
        await db.commit()
        await audit(db, "WARN", "knowledge", f"knowledge.deleted id={entry_id}", actor.get("sub"))


# ── Tools ───────────────────────────────────────────────
@router.post("/clients/{client_id}/tools", status_code=201)
async def register_tool(client_id: uuid.UUID, body: ToolCreate, db: AsyncSession = Depends(get_db),
                        actor: dict = Depends(require("tools.manage"))):
    import jsonschema
    try:
        jsonschema.Draft202012Validator.check_schema(body.schema)
    except jsonschema.SchemaError as exc:
        raise HTTPException(422, f"invalid JSON schema: {exc.message}")
    tool = Tool(client_id=client_id, **body.model_dump())
    db.add(tool)
    await db.commit()
    await audit(db, "INFO", "tools", f"tool.registered name={body.name}", actor.get("sub"))
    return {"id": str(tool.id), "name": tool.name}


# ── Users / logs / health ───────────────────────────────
@router.get("/clients/{client_id}/users", response_model=list[dict])
async def list_users(client_id: uuid.UUID, db: AsyncSession = Depends(get_db),
                     _: dict = Depends(require("clients.read"))):
    rows = (await db.execute(select(User).where(User.client_id == client_id))).scalars().all()
    return [{"id": str(u.id), "external_id": u.external_id, "plan": u.plan,
             "tokens_today": u.tokens_today, "daily_token_limit": u.daily_token_limit,
             "messages_total": u.messages_total, "cache_hits": u.cache_hits, "blocked": u.blocked}
            for u in rows]


@router.get("/logs", response_model=list[dict])
async def list_logs(limit: int = 120, db: AsyncSession = Depends(get_db),
                    _: dict = Depends(require("logs.read"))):
    rows = (await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc())
                             .limit(min(limit, 500)))).scalars().all()
    return [{"id": r.id, "level": r.level, "source": r.source, "message": r.message,
             "actor": r.actor, "ts": r.created_at.isoformat()} for r in rows]


@router.get("/health", response_model=HealthOut)
async def health(db: AsyncSession = Depends(get_db)):
    from app.core import get_redis
    from app.providers import factory
    db_ok, redis_ok = True, True
    try:
        await db.execute(select(func.count()).select_from(Client))
    except Exception:
        db_ok = False
    try:
        await get_redis().ping()
    except Exception:
        redis_ok = False
    return HealthOut(status="ok" if db_ok and redis_ok else "degraded", version=__version__,
                     db=db_ok, redis=redis_ok, vector=db_ok,
                     providers={name: bool(True) for name in factory.chain})
