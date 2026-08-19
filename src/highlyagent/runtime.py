"""Runtime services: Memory Manager (short-term Redis + long-term PostgreSQL)
and the Workflow Engine (multi-step tasks with progress + cancellation, via Celery)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Callable, Awaitable

from celery import Celery
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from highlyagent.core import get_redis, settings
from highlyagent.models import Conversation, Message, Workflow

log = logging.getLogger("highlyagent.runtime")

celery_app = Celery("highlyagent", broker=settings.REDIS_URL, backend=settings.REDIS_URL)
celery_app.conf.update(task_serializer="json", result_serializer="json",
                       task_acks_late=True, worker_prefetch_multiplier=1)


# ── Memory Manager ──────────────────────────────────────
class MemoryManager:
    """Short-term memory lives in Redis (fast, TTL-bounded); long-term memory is
    compacted into PostgreSQL as conversation summaries."""

    STM_KEY = "stm:{conv}:{user}"

    async def remember(self, conv_id: uuid.UUID, user_id: uuid.UUID, role: str, content: str):
        key = self.STM_KEY.format(conv=conv_id, user=user_id)
        rds = get_redis()
        await rds.rpush(key, json.dumps({"role": role, "content": content}))
        await rds.ltrim(key, -40, -1)                      # keep last 40 turns
        await rds.expire(key, settings.STM_TTL_SECONDS)

    async def recall(self, conv_id: uuid.UUID, user_id: uuid.UUID, window: int = 12) -> list[dict]:
        key = self.STM_KEY.format(conv=conv_id, user=user_id)
        raw = await get_redis().lrange(key, -window, -1)
        return [json.loads(item) for item in raw]

    async def compact_to_long_term(self, db: AsyncSession, conv_id: uuid.UUID):
        """Roll old short-term turns into a durable summary on the conversation."""
        msgs = (await db.execute(
            select(Message).where(Message.conversation_id == conv_id)
            .order_by(Message.created_at.desc()).limit(30))).scalars().all()
        if len(msgs) < 20:
            return
        digest = " | ".join(f"{m.role}: {m.content[:140]}" for m in reversed(msgs[-10:]))
        await db.execute(update(Conversation).where(Conversation.id == conv_id)
                         .values(summary=digest[:2000]))
        await db.commit()
        log.info("memory compacted conv=%s", conv_id)


memory = MemoryManager()


# ── Workflow Engine ─────────────────────────────────────
ProgressFn = Callable[[str, int, str], Awaitable[None]]    # (stage, pct, detail)


class CancelToken:
    def __init__(self) -> None:
        self._event = asyncio.Event()

    def cancel(self): self._event.set()
    @property
    def cancelled(self): return self._event.is_set()
    def raise_if(self):
        if self._event.is_set():
            raise asyncio.CancelledError("task cancelled by user")


class WorkflowEngine:
    """Executes ordered steps (tool → tool → ai → webhook …), reporting progress
    per step and honouring cancellation between steps."""

    async def run(self, workflow: Workflow, ctx: dict[str, Any], *,
                  on_progress: ProgressFn, cancel: CancelToken,
                  tool_exec: Callable[..., Awaitable[Any]],
                  ai_call: Callable[[str], Awaitable[str]]) -> dict[str, Any]:
        results: dict[str, Any] = {"steps": []}
        steps = workflow.steps or []
        for i, step in enumerate(steps):
            cancel.raise_if()
            pct = int((i / max(len(steps), 1)) * 100)
            await on_progress(f"workflow:{step.get('kind', 'step')}", pct, step.get("label", f"step {i + 1}"))
            kind = step.get("kind")
            try:
                if kind == "tool":
                    out = await tool_exec(step["tool"], self._resolve(step.get("args", {}), ctx, results))
                elif kind == "ai":
                    out = await ai_call(self._resolve(step.get("prompt", ""), ctx, results))
                elif kind == "delay":
                    await asyncio.wait_for(asyncio.sleep(0), timeout=0.01)  # cooperative tick
                    out = {"waited": True}
                else:
                    raise ValueError(f"unknown step kind '{kind}'")
                results["steps"].append({"name": step.get("label", kind), "ok": True, "out": out})
                results[step.get("save_as") or f"step_{i}"] = out
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                if step.get("on_error") == "continue":
                    results["steps"].append({"name": step.get("label", kind), "ok": False, "error": str(exc)})
                    continue
                raise
        workflow.runs += 1
        return results

    @staticmethod
    def _resolve(value: Any, ctx: dict, results: dict) -> Any:
        """Tiny template resolver: {{ctx.city}} / {{step_0.temp_c}}."""
        if isinstance(value, str):
            for src in (ctx, results):
                for k, v in src.items():
                    value = value.replace("{{" + k + "}}", str(v))
        if isinstance(value, dict):
            return {k: WorkflowEngine._resolve(v, ctx, results) for k, v in value.items()}
        return value


workflows = WorkflowEngine()
