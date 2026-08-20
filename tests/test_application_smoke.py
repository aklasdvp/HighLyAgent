"""Smoke test: the FastAPI application must assemble without errors.

Guards against import/assembly regressions (e.g. a broken or missing router),
which the pure-logic unit tests do not cover.
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "unit-test-secret-key")
os.environ.setdefault("MANAGEMENT_API_KEY", "hl_mgmt_unit_test")

import application


def test_app_assembles():
    assert application.app.title == "HighLyAgent"
    assert application.__version__


def test_key_routers_registered():
    paths = {r.path for r in application.app.routes}
    assert "/agent/process" in paths
    assert "/ws" in paths
    assert "/projects" in paths
    assert "/projects/{project_id}/keys/rotate" in paths
    assert "/auth/login" in paths
    assert "/tools" in paths
    assert "/system/health" in paths
