"""Agent Core — the self-learning pipeline.

process_input():
  sanitize → enforce user token limit → intent → short-term memory →
  knowledge search ──HIT──▶ serve cached answer (0 provider tokens)
                  └─MISS──▶ tool plan → execute → provider (fallback chain)
                            → learn() → respond

Every path emits progress frames via `emit`, so the gateway can stream real-time
task progress to any connected client (Web / Mobile / Desktop / IoT).
"""
from __future__ import annotations

import html
import logging
import re
import time
import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from core import settings
from knowledge import KnowledgeEngine
from models import Client, User
from providers import ProviderResponse, factory
from runtime import CancelToken, memory
from tools import registry

log = logging.getLogger("agent")

INTENT_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("weather",   re.compile(r"weather|আবহাওয়া|তাপমাত্রা|বৃষ্টি", re.I)),
    ("math",      re.compile(r"calculate|হিসাব|\d+\s*[\+\-\*\/x×÷]\s*\d+|(\d+)\s*(plus|minus)", re.I)),
    ("currency",  re.compile(r"currency|convert|টাকা|usd|bdt|eur", re.I)),
    ("time",      re.compile(r"\btime\b|সময়|ঘটা", re.I)),
    ("support",   re.compile(r"refund|help|support|সাহায্য|রিফান্ড", re.I)),
]

SYSTEM_INSTRUCTION = (
    "You are HighLyAgent, a universal AI middleware assistant. Answer precisely and "
    "concisely in the user's language (Bengali or English). Use tool results verbatim "
    "when present. Never invent tool data."
)


@dataclass
class AgentResult:
    text: str
    source: str                      # "cache" | "provider"
    provider: str | None = None
    tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    similarity: float = 0.0
    tools_used: list[str] = field(default_factory=list)


class LimitExceeded(Exception):
    pass


class AgentCore:
    def __init__(self, db: AsyncSession, knowledge: KnowledgeEngine):
        self.db = db
        self.kb = knowledge

    # ── use case: process user input ────────────────────
    async def process_input(self, *, client: Client, user: User, conversation_id: uuid.UUID,
                            text: str, model_map: dict[str, str], temperature: float = 0.7,
                            cancel: CancelToken | None = None, emit=None) -> AgentResult:
        cancel = cancel or CancelToken()
        t0 = time.perf_counter()

        async def progress(stage: str, pct: int, detail: str | None = None):
            if emit:
                await emit(stage, pct, detail)

        # 1 — sanitize & validate
        text = html.unescape(text).strip()[: settings.MAX_INPUT_LENGTH]
        if not text:
            raise ValueError("empty input")
        await progress("sanitize", 6, f"{len(text)} chars")

        # 2 — subscription / token limits
        await progress("quota", 12, f"plan={user.plan}")
        self._enforce_limits(user, estimated=0)

        # 3 — intent analysis
        intent = self._classify_intent(text)
        await progress("intent", 22, intent or "general")

        # 4 — short-term memory
        history = await memory.recall(conversation_id, user.id, window=10)
        await progress("memory", 32, f"{len(history)} turns")

        # 5 — knowledge-first lookup (self-learning payoff)
        await progress("vector_search", 45, "pgvector cosine")
        hit = await self.kb.search(client.id, text)
        cancel.raise_if()

        if hit.entry is not None:
            # ── CACHE PATH: zero provider tokens ──
            answer = hit.entry.response_text
            for call in hit.entry.tool_calls:              # optional live re-run
                pass
            await progress("respond", 100, f"cache hit · sim {hit.similarity:.2f}")
            await self._record(user, conversation_id, text, answer, "cache", None, 0, 0.0,
                               int((time.perf_counter() - t0) * 1000), hit.similarity)
            return AgentResult(answer, "cache", None, 0, 0.0,
                               int((time.perf_counter() - t0) * 1000), hit.similarity)

        # ── GENERATION PATH ──
        # 6 — tool planning & execution
        tool_outputs: list[dict] = []
        tools_used: list[str] = []
        tool = self._plan_tool(intent, text)
        if tool:
            name, args = tool
            await progress("tool", 60, name)
            try:
                out = await registry.execute(name, args, dispatch_scope=str(client.id))
                tool_outputs.append({"tool": name, "result": out})
                tools_used.append(name)
            except Exception as exc:
                tool_outputs.append({"tool": name, "error": str(exc)})

        # 7 — provider call with fallback chain
        await progress("provider", 78, " → ".join(factory.chain))
        messages = self._build_messages(history, text, tool_outputs)
        cancel.raise_if()
        resp: ProviderResponse = await factory.complete_with_fallback(
            messages, model_map=model_map, temperature=temperature)

        # 8 — learn (Knowledge Saver) → next similar question is free
        if settings.AUTO_LEARN:
            await progress("learn", 92, "embedding + upsert")
            await self.kb.learn(client.id, text, resp.text, tool_outputs, learned=True)

        await progress("respond", 100, f"{resp.provider}/{resp.model}")
        await self._record(user, conversation_id, text, resp.text, "provider", resp.provider,
                           resp.tokens_in + resp.tokens_out, resp.cost_usd,
                           int((time.perf_counter() - t0) * 1000), hit.similarity)
        return AgentResult(resp.text, "provider", resp.provider,
                           resp.tokens_in + resp.tokens_out, resp.cost_usd,
                           int((time.perf_counter() - t0) * 1000), hit.similarity, tools_used)

    # ── use case: limits ────────────────────────────────
    def _enforce_limits(self, user: User, estimated: int):
        if user.blocked:
            raise LimitExceeded("account blocked by admin")
        if user.plan == "unlimited":
            return
        if user.tokens_today + estimated > user.daily_token_limit:
            raise LimitExceeded("daily token limit exceeded — resets 00:00 UTC")
        if user.tokens_month + estimated > user.monthly_token_limit:
            raise LimitExceeded("monthly token limit exceeded")

    # ── internals ───────────────────────────────────────
    @staticmethod
    def _classify_intent(text: str) -> str | None:
        for name, pattern in INTENT_PATTERNS:
            if pattern.search(text):
                return name
        return None

    @staticmethod
    def _plan_tool(intent: str | None, text: str) -> tuple[str, dict] | None:
        if intent == "weather":
            m = re.search(r"(?:in|of|for|এ)\s+([A-Za-z\u0980-\u09FF ]{2,30})", text)
            return "weather.fetch", {"city": (m.group(1).strip() if m else "Dhaka")}
        if intent == "math":
            expr = re.sub(r"[^\d\+\-\*\/\.\(\)x×÷ ]", "", text.replace("x", "*").replace("×", "*").replace("÷", "/"))
            expr = re.search(r"[\d\+\-\*\/\.\(\) ]+", expr)
            return ("math.calculate", {"expression": expr.group(0).strip()}) if expr else None
        if intent == "currency":
            nums = re.findall(r"[\d\.]+", text)
            return "currency.convert", {"amount": float(nums[0]) if nums else 1.0}
        if intent == "time":
            return "time.now", {}
        return None

    @staticmethod
    def _build_messages(history: list[dict], text: str, tool_outputs: list[dict]) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
        messages += history[-8:]
        if tool_outputs:
            import json
            messages.append({"role": "system",
                             "content": f"Tool results (use verbatim): {json.dumps(tool_outputs, ensure_ascii=False)}"})
        messages.append({"role": "user", "content": text})
        return messages

    async def _record(self, user, conversation_id, text, answer, source, provider,
                      tokens, cost, latency_ms, similarity):
        from models import Message
        await memory.remember(conversation_id, user.id, "user", text)
        await memory.remember(conversation_id, user.id, "assistant", answer)
        user.tokens_today += tokens
        user.tokens_month += tokens
        user.messages_total += 1
        user.cache_hits += 1 if source == "cache" else 0
        self.db.add(Message(conversation_id=conversation_id, role="user", content=text))
        self.db.add(Message(conversation_id=conversation_id, role="assistant", content=answer,
                            source=source, provider=provider, tokens=tokens, latency_ms=latency_ms))
        await self.db.commit()
        log.info("msg source=%s tokens=%d cost=%.6f sim=%.2f user=%s",
                 source, tokens, cost, similarity, user.id)
