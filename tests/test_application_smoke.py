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
    assert "/projects/{project_id}/limits" in paths
    assert "/projects/{project_id}/analytics" in paths
    assert "/projects/{project_id}/knowledge" in paths
    assert "/projects/{project_id}/knowledge/{entry_id}" in paths
    assert "/auth/login" in paths
    assert "/tools" in paths
    assert "/tools/{tool_id}" in paths
    assert "/system/health" in paths


def test_tool_delete_requires_confirm_query():
    route = next(r for r in application.app.routes
                 if getattr(r, "path", "") == "/tools/{tool_id}" and "DELETE" in getattr(r, "methods", set()))
    assert any(getattr(f, "name", "") == "confirm" for f in route.dependant.query_params)


def test_exception_handlers_registered():
    assert any("HTTPException" in str(handler) for handler in application.app.exception_handlers)
    assert any("RequestValidationError" in str(handler) for handler in application.app.exception_handlers)
