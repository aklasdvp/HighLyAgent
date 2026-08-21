"""Tests for the standardized response envelope and project-level provider selection."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret-key")

from providers import DEFAULT_MODEL_MAP, factory
from response import err, ok, ok_list


def test_ok_envelope_shape():
    body = ok({"a": 1}, "done")
    assert body["success"] is True
    assert body["data"] == {"a": 1}
    assert body["message"] == "done"
    assert "timestamp" in body


def test_ok_list_envelope_shape():
    body = ok_list([1, 2], total=2, limit=50, offset=10)
    assert body["success"] is True
    assert body["data"]["items"] == [1, 2]
    assert body["data"]["total"] == 2
    assert body["data"]["limit"] == 50
    assert body["data"]["offset"] == 10


def test_err_envelope_shape():
    body = err("LIMIT_EXCEEDED", "daily limit reached")
    assert body["success"] is False
    assert body["error_code"] == "LIMIT_EXCEEDED"
    assert body["detail"] == "daily limit reached"
    assert body["message"] == "daily limit reached"
    assert body["data"] is None


def test_default_model_map_covers_all_providers():
    assert set(DEFAULT_MODEL_MAP) == {"openai", "claude", "gemini", "deepseek"}


def test_project_config_falls_back_when_unset():
    assert factory.project_config(None, None) == (None, None)


def test_project_config_unknown_provider_falls_back():
    assert factory.project_config("nope", "x") == (None, None)


def test_project_config_known_provider_uses_default_model():
    provider, model = factory.project_config("openai", None)
    assert provider == "openai"
    assert model == DEFAULT_MODEL_MAP["openai"]


def test_project_config_known_provider_honours_model():
    provider, model = factory.project_config("openai", "gpt-4.1")
    assert (provider, model) == ("openai", "gpt-4.1")
