"""Agent Core — the self-learning request pipeline.

sanitize → quota check → short-term memory → knowledge (vector) search
  → [miss] plan tool → execute → AI provider (manual fallback chain) → learn
  → [hit] cached answer, zero provider tokens
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from sqlalchemy import update

from core import settings
from knowledge import KnowledgeEngine
from models import Client, Message, User
from providers import factory
from runtime import CancelToken, memory
from tools import registry

log = logging.getLogger("highlyagent.agent")


class LimitExceeded(Exception):
    """Raised when a user hits a token/quota ceiling (→ 402 LIMIT_EXCEEDED)."""


@dataclass
class AgentResult:
    text: str
    source: str                                   # knowledge | ai
    similarity: float
    tokens: int
    cost_usd: float
    latency_ms: int
    tools_used: list[str] = field(default_factory=list)


ProgressEmitter = Callable[[str, int, str | None], Awaitable[None]]


class AgentCore:
    def __init__(self, db, knowledge: KnowledgeEngine):
        self.db = db
        self.knowledge = knowledge

    # ── static helpers (pure, unit-tested) ─────────────
    @staticmethod
    def _sanitize(text: str) -> str:
        text = (text or "").strip()
        if len(text) > settings.MAX_INPUT_LENGTH:
            text = text[: settings.MAX_INPUT_LENGTH]
        return text

    @staticmethod
    def _classify_intent(text: str) -> str | None:
        t = text.lower()
        if re.search(r"weather|আবহাওয়া|তাপমাত্রা|বৃষ্টি|forecast", t):
            return "weather"
        if re.search(r"convert|কনভার্ট|টাকা|usd|bdt|eur|currency|রেট", t) and re.search(r"\d", t):
            return "currency"
        if re.search(r"time|সময়|কয়টা বাজে|ঘড়ি", t):
            return "time"
        if re.search(r"^(what is|কত|calculate|হিসাব)|[\d\s+\-*/×÷().]{3,}=?\s*$", t) and re.search(r"\d", t):
            return "math"
        if re.search(r"refund|রিফান্ড|বাজে না|কাজ করছে না|সমস্যা|help|সাহায্য", t):
            return "support"
        return None

    @staticmethod
    def _plan_tool(intent: str, text: str) -> tuple[str, dict] | tuple[None, None]:
        if intent == "time":
            return "time.now", {}
        if intent == "math":
            expr = re.sub(r"^[^0-9(]*", "", text.replace("×", "*").replace("÷", "/").split("?")[0])
            expr = re.sub(r"[^0-9+\-*/(). ]", "", expr).strip()
            return "math.calculate", {"expression": expr or text}
        if intent == "currency":
            m = re.search(r"([\d,.]+)\s*([a-z]{3})\s*(?:to|টু|থেকে)?\s*([a-z]{3})?", text.lower())
            if m:
                return "currency.convert", {"amount": float(m.group(1).replace(",", "")),
                                            "from": m.group(2), "to": m.group(3) or "bdt"}
            return "currency.convert", {"amount": 1, "from": "usd", "to": "bdt"}
        if intent == "weather":
            m = re.search(r"(?:in|@)\s+([a-zA-Z\u0980-\u09FF\s]+?)(?:\?|$|today|এখন|আজ)", text)
            city = m.group(1).strip() if m else (text.split()[-1].strip("?।") or "Dhaka")
            return "weather.fetch", {"city": city.title()}
        return None, None

    @staticmethod
    def _enforce_limits(user: User | None, estimated: int = 0):
        if user is None or user.plan == "unlimited":
            return
        if user.blocked:
            raise LimitExceeded("Account is blocked — quota exceeded. Upgrade your plan.")
        if user.daily_token_limit and user.tokens_today + estimated > user.daily_token_limit:
            raise LimitExceeded("Daily token limit reached — resets at 00:00 UTC.")
        if user.monthly_token_limit and user.tokens_month + estimated > user.monthly_token_limit:
            raise LimitExceeded("Monthly token limit reached.")

    # ── main pipeline ───────────────────────────────────
    async def process_input(self, *, client: Client, user: User | None,
                            conversation_id: uuid.UUID, text: str,
                            model_map: dict[str, str],
                            cancel: CancelToken | None = None,
                            emit: ProgressEmitter | None = None) -> AgentResult:
        t0 = time.perf_counter()
        cancel = cancel or CancelToken()

        async def progress(stage: str, pct: int, detail: str | None = None):
            if emit:
                await emit(stage, pct, detail)

        text = self._sanitize(text)
        if not text:
            raise ValueError("empty input")

        await progress("auth", 5, "context verified")
        self._enforce_limits(user, estimated=0)

        # short-term memory recall
        await progress("memory", 15, "recalling context")
        if user is not None:
            await memory.remember(conversation_id, user.id, "user", text)
        history = await memory.recall(conversation_id, user.id) if user is not None else []

        # knowledge-first lookup — this is where AI spend is avoided
        cancel.raise_if()
        await progress("vector_search", 35, "pgvector cosine search")
        hit = await self.knowledge.search(client.id, text)

        tools_used: list[str] = []
        if hit.entry is not None:
            await progress("answer", 90, f"knowledge hit · sim {hit.similarity:.2f}")
            answer = hit.entry.response_text
            source, tokens, cost = "knowledge", 0, 0.0
            if user is not None:
                user.cache_hits += 1
        else:
            # plan + run a tool when the intent is actionable
            tool_context = ""
            intent = self._classify_intent(text)
            if intent and intent != "support":
                name, args = self._plan_tool(intent, text)
                if name:
                    cancel.raise_if()
                    await progress("tool", 55, f"executing {name}")
                    try:
                        result = await registry.execute(name, args, scope=str(client.id))
                        tools_used.append(name)
                        tool_context = f"\nTool {name} returned: {result}"
                    except Exception as exc:
                        log.warning("tool %s failed: %s", name, exc)

            # provider call with the manually configured fallback chain
            cancel.raise_if()
            provider = client.ai_provider or settings.DEFAULT_PROVIDER
            await progress("provider", 70, f"calling {provider}")
            messages = [{"role": "system", "content": client.system_prompt or ""}]
            messages += history[-8:]
            messages.append({"role": "user", "content": text + tool_context})
            out = await factory.complete_with_fallback(
                messages, model_map=model_map,
                temperature=float(client.temperature or 0.7),
                max_tokens=client.max_tokens or 1024)
            answer, tokens, cost = out.text, out.tokens_in + out.tokens_out, out.cost_usd
            source = "ai"

            # self-learning: persist so the next similar question is free
            if settings.AUTO_LEARN and answer.strip():
                cancel.raise_if()
                await progress("learn", 85, "saving to knowledge base")
                await self.knowledge.learn(client.id, text, answer,
                                           [{"tool": t} for t in tools_used], learned=True)

        # durability + usage accounting
        self.db.add(Message(conversation_id=conversation_id, role="user", content=text))
        self.db.add(Message(conversation_id=conversation_id, role="assistant", content=answer,
                            source=source, tokens=tokens,
                            latency_ms=int((time.perf_counter() - t0) * 1000)))
        if user is not None:
            await self.db.execute(update(User).where(User.id == user.id).values(
                tokens_today=User.tokens_today + tokens,
                tokens_month=User.tokens_month + tokens,
                messages_total=User.messages_total + 1,
                cache_hits=User.cache_hits))
        await self.db.commit()

        if user is not None:
            await memory.remember(conversation_id, user.id, "assistant", answer)

        await progress("done", 100, source)
        return AgentResult(
            text=answer, source=source, similarity=hit.similarity,
            tokens=tokens, cost_usd=cost,
            latency_ms=int((time.perf_counter() - t0) * 1000),
            tools_used=tools_used,
        )
