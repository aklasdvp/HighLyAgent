"""HighLyAgent unit tests — pure logic only (no DB, Redis or network).

Run:  pytest backend/tests -q
"""
import asyncio
import os
import uuid
from types import SimpleNamespace

# Settings are validated at import time — provide safe defaults first.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret-key")

import pytest

from agent import AgentCore, LimitExceeded
from core import (
    ROLE_PERMISSIONS,
    create_token,
    decode_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_password,
)
from knowledge import KnowledgeEngine
from providers import COST_TABLE, _cost, factory
from runtime import CancelToken, WorkflowEngine
from tools import ToolValidationError, registry


# ── auth primitives ──────────────────────────────────────────────────
def test_api_key_hash_only_storage():
    visible, stored = generate_api_key()
    assert visible.startswith("hl_live_")
    assert stored == hash_api_key(visible)
    assert visible not in stored                     # raw key never recoverable


def test_password_hash_roundtrip():
    hashed = hash_password("strong-password-123")
    assert verify_password("strong-password-123", hashed)
    assert not verify_password("wrong-password", hashed)


def test_jwt_access_roundtrip():
    token = create_token("sub-1", "admin", "access")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == "sub-1"
    assert payload["role"] == "admin"


def test_jwt_type_mismatch_rejected():
    token = create_token("sub-1", "admin", "refresh")
    with pytest.raises(Exception):
        decode_token(token, expected_type="access")


def test_rbac_matrix():
    assert "security.manage" in ROLE_PERMISSIONS["admin"]
    assert "clients.delete" in ROLE_PERMISSIONS["admin"]
    assert "security.manage" not in ROLE_PERMISSIONS["viewer"]
    assert "clients.read" in ROLE_PERMISSIONS["viewer"]          # read-only floor


# ── knowledge engine ─────────────────────────────────────────────────
def test_cache_key_deterministic_and_normalized():
    cid = uuid.uuid4()
    a = KnowledgeEngine._cache_key(cid, "  ঢাকায় আবহাওয়া? ")
    b = KnowledgeEngine._cache_key(cid, "ঢাকায় আবহাওয়া?")
    assert a == b                                             # strip + lower
    assert a != KnowledgeEngine._cache_key(cid, "other question")
    assert a != KnowledgeEngine._cache_key(uuid.uuid4(), "ঢাকায় আবহাওয়া?")  # per-project


# ── runtime: cancellation & workflow templates ───────────────────────
def test_cancel_token():
    tok = CancelToken()
    assert not tok.cancelled
    tok.cancel()
    assert tok.cancelled
    with pytest.raises(asyncio.CancelledError):
        tok.raise_if()


def test_workflow_template_resolution():
    assert WorkflowEngine._resolve("Weather in {{city}}", {"city": "Dhaka"}, {}) == "Weather in Dhaka"
    assert WorkflowEngine._resolve({"q": "{{step_0}}"}, {}, {"step_0": 42}) == {"q": "42"}
    assert WorkflowEngine._resolve(7, {}, {}) == 7              # passthrough


def test_workflow_engine_runs_steps_in_order():
    wf = SimpleNamespace(steps=[
        {"kind": "tool", "tool": "math.calculate", "args": {"expression": "1+1"},
         "label": "calc", "save_as": "calc"},
        {"kind": "ai", "prompt": "Sum: {{calc}}", "label": "summarize"},
    ], runs=0)
    seen: list[str] = []

    async def tool_exec(name, args):
        seen.append(name)
        return {"ok": True}

    async def ai_call(prompt):
        seen.append("ai")
        return "done"

    async def progress(*_args):
        return None

    async def main():
        return await WorkflowEngine().run(
            wf, {}, on_progress=progress, cancel=CancelToken(),
            tool_exec=tool_exec, ai_call=ai_call)

    res = asyncio.run(main())
    assert [s["ok"] for s in res["steps"]] == [True, True]
    assert wf.runs == 1
    assert seen == ["math.calculate", "ai"]


def test_workflow_stops_on_cancel_between_steps():
    wf = SimpleNamespace(steps=[
        {"kind": "delay", "label": "one"},
        {"kind": "delay", "label": "two"},
    ], runs=0)
    cancel = CancelToken()
    cancel.cancel()

    async def main():
        return await WorkflowEngine().run(
            wf, {}, on_progress=lambda *a: asyncio.sleep(0), cancel=cancel,
            tool_exec=None, ai_call=None)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(main())


# ── tool system ──────────────────────────────────────────────────────
def test_math_tool_executes_safely():
    res = asyncio.run(registry.execute("math.calculate", {"expression": "2+3*4"}))
    assert res["ok"] is True
    assert res["result"] == 14


def test_math_tool_blocks_disallowed_nodes():
    with pytest.raises(Exception):
        asyncio.run(registry.execute("math.calculate", {"expression": "__import__('os')"}))


def test_tool_schema_validation_rejects_bad_args():
    with pytest.raises(ToolValidationError):
        asyncio.run(registry.execute("weather.fetch", {"wrong_field": 1}))


def test_unregistered_tool_rejected():
    with pytest.raises(ToolValidationError):
        asyncio.run(registry.execute("nope.nope", {}))


def test_client_tool_requires_live_dispatcher():
    registry.register("unit.client.echo", {"type": "object", "properties": {}}, "client")
    with pytest.raises(ToolValidationError):
        asyncio.run(registry.execute("unit.client.echo", {}))


def test_invalid_schema_rejected_at_registration():
    with pytest.raises(Exception):
        registry.register("bad.schema", {"type": "not-a-real-type"}, "server")


# ── provider layer ───────────────────────────────────────────────────
def test_cost_table_covers_default_models():
    for model in ("gpt-4o-mini", "claude-haiku-4", "gemini-2.0-flash", "deepseek-chat"):
        assert model in COST_TABLE


def test_cost_math():
    assert _cost("gpt-4o-mini", 1_000_000, 0) == 0.15
    assert _cost("unknown-model", 0, 0) == 0.0


def test_fallback_chain_is_manual_and_valid():
    assert factory.chain
    assert all(p in ("openai", "gemini", "claude", "deepseek") for p in factory.chain)


def test_configured_flags_reflect_env_keys():
    flags = factory.configured()
    assert set(flags) == {"openai", "gemini", "claude", "deepseek"}
    assert all(isinstance(v, bool) for v in flags.values())


# ── agent core: intent + planning + limits ───────────────────────────
@pytest.mark.parametrize("text,expected", [
    ("ঢাকায় আজ আবহাওয়া কেমন?", "weather"),
    ("What is 12 x 4?", "math"),
    ("convert 250 usd to bdt", "currency"),
    ("রিফান্ড পলিসি কী?", "support"),
    ("hello there friend", None),
])
def test_intent_classification_bilingual(text, expected):
    assert AgentCore._classify_intent(text) == expected


def test_plan_tool_weather_extracts_city():
    name, args = AgentCore._plan_tool("weather", "weather in Dhaka")
    assert name == "weather.fetch"
    assert args["city"] == "Dhaka"


def test_plan_tool_time():
    assert AgentCore._plan_tool("time", "what time is it") == ("time.now", {})


def test_token_limits_enforced():
    agent = AgentCore(db=None, knowledge=None)
    user = SimpleNamespace(blocked=True, plan="free", tokens_today=0, tokens_month=0,
                           daily_token_limit=100, monthly_token_limit=1000,
                           monthly_limit=1000)
    with pytest.raises(LimitExceeded):                       # blocked account
        agent._enforce_limits(user, estimated=0)
    user.blocked = False
    user.tokens_today = 100
    with pytest.raises(LimitExceeded):                       # daily ceiling
        agent._enforce_limits(user, estimated=1)
    user.plan = "unlimited"
    agent._enforce_limits(user, estimated=10**9)             # never raises
