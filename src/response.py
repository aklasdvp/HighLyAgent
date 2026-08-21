"""Standardized API response envelope.

Every endpoint returns either a success or an error envelope:

Success:  {"success": true, "data": ..., "message": "...", "timestamp": "..."}
List:     {"success": true, "data": {"items": [...], "total": n, "limit": l, "offset": o},
           "message": "...", "timestamp": "..."}
Error:    {"success": false, "data": null, "message": "...", "error_code": "...",
           "detail": "...", "timestamp": "..."}
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ok(data: Any = None, message: str = "ok") -> dict:
    return {"success": True, "data": data, "message": message, "timestamp": _now()}


def ok_list(items: list, total: int, limit: int, offset: int, message: str = "ok") -> dict:
    return {
        "success": True,
        "data": {"items": items, "total": total, "limit": limit, "offset": offset},
        "message": message,
        "timestamp": _now(),
    }


def err(error_code: str, detail: str, message: str | None = None) -> dict:
    return {
        "success": False,
        "data": None,
        "message": message or detail,
        "error_code": error_code,
        "detail": detail,
        "timestamp": _now(),
    }
