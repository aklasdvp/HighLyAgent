"""Tests for project behavior configuration (no DB / network)."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret-key")

from agent import AgentCore
from schemas import ClientCreate


def test_client_schema_accepts_behavior_description():
    client = ClientCreate(
        name="Shop",
        behavior_description="E-commerce website — be helpful with product questions.",
    )
    assert client.behavior_description is not None


def test_client_schema_behavior_optional():
    assert ClientCreate(name="Shop").behavior_description is None


def test_agent_messages_include_behavior():
    msgs = AgentCore._build_messages([], "hello", [], behavior="E-commerce assistant.")
    assert "E-commerce assistant." in msgs[0]["content"]


def test_agent_messages_omit_behavior_when_unset():
    msgs = AgentCore._build_messages([], "hello", [], behavior=None)
    assert "Project behavior" not in msgs[0]["content"]
