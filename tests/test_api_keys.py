"""Tests for the two-layer API key system (no DB / network)."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret-key")
os.environ.setdefault("MANAGEMENT_API_KEY", "hl_mgmt_unit_test")

from api_key_manager import (
    generate_management_key,
    generate_project_key,
    project_key_matches,
    verify_management_key,
)
from core import hash_api_key, settings


def test_generate_management_key_format():
    key = generate_management_key()
    assert key.startswith("hl_mgmt_")
    assert len(key) > 20


def test_verify_management_key_accepts_configured_key():
    assert settings.MANAGEMENT_API_KEY
    assert verify_management_key(settings.MANAGEMENT_API_KEY) is True


def test_verify_management_key_rejects_wrong_and_missing():
    assert verify_management_key("wrong-key") is False
    assert verify_management_key(None) is False
    assert verify_management_key("") is False


def test_project_key_generation_stores_hash_only():
    visible, stored = generate_project_key()
    assert visible.startswith("hl_live_")
    assert stored == hash_api_key(visible)
    assert visible not in stored


def test_project_key_matches_constant_time():
    visible, stored = generate_project_key()
    assert project_key_matches(visible, stored) is True
    assert project_key_matches("hl_live_wrong", stored) is False
