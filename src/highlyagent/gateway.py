"""WebSocket Gateway — real-time communication for every client type.

Protocol (JSON frames):
  → {type:"chat", text}          start a task
  → {type:"cancel", task_id}     cancel a running task
  → {type:"tool_result", task_id, tool_name, payload}   answer a client-tool call
  → {type:"pong"}                heartbeat reply
  ← {type:"progress", task_id, stage, pct, detail}
  ← {type:"answer", task_id, text, source, tokens, cost_usd, latency_ms}
  ← {type:"tool_request", task_id, tool_name, args}
  ← {type:"error", task_id, code, message}
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from highlyagent.agent import AgentCore, LimitExceeded
from highlyagent.core import async_session, decode_token, hash_api_key
from highlyagent.knowledge import KnowledgeEngine
from highlyagent.models import ApiKey, Client, Conversation, User
from highlyagent.runtime import CancelToken
from highlyagent.tools import registry

log = logging.getLogger("highlyagent.gateway")
router = APIRouter()


class ConnectionManager:
    """Tracks live sockets per client app, fans out frames, resolves client-tool calls."""

    def __init__(self):
        self.active: dict[str, WebSocket] = {}                     # conn_id -> ws
        self.by_client: dict[uuid.UUID, set[str]] = {}
        self.tasks: dict[str, CancelToken] = {}                    # task_id -> cancel token
        self.pending_tools: dict[str, asyncio.Future] = {}         # task_id:tool -> future

    def register(self, conn_id: str, ws: WebSocket, client_id: uuid.UUID | None):
        self.active[conn_id] = ws
        if client_id:
            self.by_client.setdefault(client_id, set()).add(conn_id)

    def drop(self, conn_id: str):
        self.active.pop(conn_id, None)
        for conns in self.by_client.values():
            conns.discard(conn_id)

    async def send(self, conn_id: str, frame: dict[str, Any]):
        ws = self.active.get(conn_id)
        if ws:
            with contextlib.suppress(RuntimeError):
                await ws.send_text(json.dumps(frame, ensure_ascii=False, default=str))

    async def dispatch_client_tool(self, scope: str, tool_name: str, args: dict,
                                   task_id: str) -> Any:
        """Ask the connected client to run a tool and await its tool_result frame."""
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending_tools[f"{task_id}:{tool_name}"] = fut
        for conn_id in self.by_client.get(uuid.UUID(scope), set()):
            await self.send(conn_id, {"type": "tool_request", "task_id": task_id,
                                      "tool_name": tool_name, "args": args})
        return await fut


manager = ConnectionManager()


async def _authenticate(token: str | None) -> tuple[uuid.UUID | None, str]:
    """JWT (dashboard user) or API key (client app)."""
    if not token:
        return None, "anon"
    if token.startswith("hl_live_"):
        async with async_session() as db:
            row = (await db.execute(select(ApiKey).where(
                ApiKey.key_hash == hash_api_key(token), ApiKey.revoked.is_(False)))).scalar_one_or_none()
            return (row.client_id, "api-key") if row else (None, "anon")
    try:
        payload = decode_token(token)
        return uuid.UUID(payload["sub"]), "jwt"
    except Exception:
        return None, "anon"


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str | None = None, client_id: str | None = None):
    """Real-time gateway. Client apps must present BOTH ?client_id= and ?token= (API key);
    a key bound to a different project is rejected with close code 4403 (ACCESS_DENIED)."""
    await ws.accept()
    key_client, auth_kind = await _authenticate(token)
    if auth_kind == "api-key" and client_id is not None and str(key_client) != client_id:
        log.warning("ws ACCESS_DENIED key-project mismatch client=%s", client_id)
        await ws.close(code=4403, reason="ACCESS_DENIED: client_id does not match API key")
        return
    client_id = uuid.UUID(client_id) if client_id else key_client
    conn_id = str(uuid.uuid4())
    manager.register(conn_id, ws, client_id)
    log.info("ws connect conn=%s auth=%s client=%s", conn_id, auth_kind, client_id)
    await manager.send(conn_id, {"type": "hello", "conn_id": conn_id, "auth": auth_kind})

    async def heartbeat():
        while conn_id in manager.active:
            await asyncio.sleep(20)
            await manager.send(conn_id, {"type": "ping", "ts": time.time()})

    hb = asyncio.create_task(heartbeat())

    try:
        while True:
            frame = json.loads(await ws.receive_text())
            ftype = frame.get("type")

            if ftype == "pong":
                continue

            if ftype == "tool_result":
                fut = manager.pending_tools.pop(f"{frame.get('task_id')}:{frame.get('tool_name')}", None)
                if fut and not fut.done():
                    fut.set_result(frame.get("payload"))
                continue

            if ftype == "cancel":
                tok = manager.tasks.get(frame.get("task_id", ""))
                if tok:
                    tok.cancel()
                    await manager.send(conn_id, {"type": "cancelled", "task_id": frame.get("task_id")})
                continue

            if ftype == "chat":
                task_id = str(uuid.uuid4())
                asyncio.create_task(_run_task(conn_id, client_id, task_id, frame.get("text", "")))

    except WebSocketDisconnect:
        pass
    finally:
        hb.cancel()
        manager.drop(conn_id)
        log.info("ws disconnect conn=%s", conn_id)


async def _run_task(conn_id: str, client_id: uuid.UUID | None, task_id: str, text: str):
    cancel = CancelToken()
    manager.tasks[task_id] = cancel

    async def emit(stage: str, pct: int, detail: str | None = None):
        await manager.send(conn_id, {"type": "progress", "task_id": task_id,
                                     "stage": stage, "pct": pct, "detail": detail})

    try:
        async with async_session() as db:
            client = await db.get(Client, client_id) if client_id else None
            if client is None or client.suspended:
                raise PermissionError("unknown or suspended client")

            user = (await db.execute(select(User).where(User.client_id == client.id)
                                     .limit(1))).scalar_one_or_none()
            conv = Conversation(user_id=user.id)
            db.add(conv)
            await db.commit()

            agent = AgentCore(db, KnowledgeEngine(db))
            registry.set_client_dispatcher(
                lambda scope, name, args: manager.dispatch_client_tool(scope, name, args, task_id))

            result = await agent.process_input(
                client=client, user=user, conversation_id=conv.id, text=text,
                model_map={"openai": "gpt-4o-mini", "claude": "claude-haiku-4",
                           "gemini": "gemini-2.0-flash", "deepseek": "deepseek-chat"},
                cancel=cancel, emit=emit)

            await manager.send(conn_id, {
                "type": "answer", "task_id": task_id, "text": result.text,
                "source": result.source, "tokens": result.tokens,
                "cost_usd": result.cost_usd, "latency_ms": result.latency_ms,
                "similarity": result.similarity, "tools": result.tools_used,
            })
    except asyncio.CancelledError:
        await manager.send(conn_id, {"type": "cancelled", "task_id": task_id})
    except LimitExceeded as exc:
        await manager.send(conn_id, {"type": "error", "task_id": task_id,
                                     "code": "LIMIT_EXCEEDED", "message": str(exc)})
    except Exception as exc:
        log.exception("task %s failed", task_id)
        await manager.send(conn_id, {"type": "error", "task_id": task_id,
                                     "code": "INTERNAL", "message": str(exc)})
    finally:
        manager.tasks.pop(task_id, None)
