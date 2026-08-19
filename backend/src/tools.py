"""Tool System — registry, JSON-Schema validation, async execution.

Two kinds:
  • server tools — executed inside the gateway (weather, math, currency, time)
  • client tools — dispatched to a connected client over WebSocket; the client
    executes and replies with a `tool_result` frame (resolved via a pending future).
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import httpx
import jsonschema
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Tool

log = logging.getLogger("highlyagent.tools")

ClientToolDispatcher = Callable[[str, str, dict], Awaitable[Any]]  # (conn scope, tool, args) -> result


class ToolValidationError(Exception):
    pass


class ToolRegistry:
    def __init__(self) -> None:
        self._server: dict[str, Callable[..., Awaitable[Any]]] = {}
        self._schemas: dict[str, dict] = {}
        self._kinds: dict[str, str] = {}
        self._dispatcher: ClientToolDispatcher | None = None
        self._register_builtins()

    # ── registration ────────────────────────────────────
    def register(self, name: str, schema: dict, kind: str, fn: Callable[..., Awaitable[Any]] | None = None):
        jsonschema.Draft202012Validator.check_schema(schema)  # raises on invalid schema
        self._schemas[name] = schema
        self._kinds[name] = kind
        if fn is not None:
            self._server[name] = fn

    def set_client_dispatcher(self, fn: ClientToolDispatcher):
        self._dispatcher = fn

    async def load_from_db(self, db: AsyncSession, client_id: uuid.UUID | None = None):
        rows = (await db.execute(select(Tool).where(Tool.enabled.is_(True)))).scalars().all()
        for t in rows:
            if t.type == "server" and t.name not in self._server:
                continue  # unknown server implementation — skip, stays client/manual
            self.register(t.name, t.schema_, t.type, self._server.get(t.name))

    def validate(self, name: str, args: dict) -> None:
        schema = self._schemas.get(name)
        if schema is None:
            raise ToolValidationError(f"tool '{name}' is not registered")
        try:
            jsonschema.validate(args, schema)
        except jsonschema.ValidationError as exc:
            raise ToolValidationError(f"tool '{name}' args invalid: {exc.message}") from exc

    # ── execution ───────────────────────────────────────
    async def execute(self, name: str, args: dict, *, timeout: float = 10.0,
                      dispatch_scope: str | None = None) -> Any:
        self.validate(name, args)
        if name in self._server:
            return await asyncio.wait_for(self._server[name](**args), timeout=timeout)
        if self._kinds.get(name) == "client":
            if self._dispatcher is None or dispatch_scope is None:
                raise ToolValidationError(f"client tool '{name}' needs a live WebSocket connection")
            return await asyncio.wait_for(self._dispatcher(dispatch_scope, name, args), timeout=timeout)
        raise ToolValidationError(f"no executor for tool '{name}'")

    # ── built-in server tools ───────────────────────────
    def _register_builtins(self):
        async def weather_fetch(city: str, **_: Any) -> dict:
            async with httpx.AsyncClient(timeout=6) as c:
                geo = (await c.get("https://geocoding-api.open-meteo.com/v1/search",
                                   params={"name": city, "count": 1, "language": "bn"})).json()
                hit = (geo.get("results") or [None])[0]
                if hit is None:
                    return {"ok": False, "error": f"city '{city}' not found"}
                wx = (await c.get("https://api.open-meteo.com/v1/forecast",
                                  params={"latitude": hit["latitude"], "longitude": hit["longitude"],
                                          "current": "temperature_2m,relative_humidity_2m,weather_code"})).json()
                cur = wx["current"]
                return {"ok": True, "city": hit["name"], "country": hit.get("country", ""),
                        "temp_c": cur["temperature_2m"], "humidity": cur["relative_humidity_2m"],
                        "code": cur["weather_code"]}

        async def calculate(expression: str, **_: Any) -> dict:
            import ast
            import operator as op
            allowed = {ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv,
                       ast.Pow: op.pow, ast.Mod: op.mod, ast.USub: op.neg}

            def _eval(node: ast.AST) -> float:
                if isinstance(node, ast.Expression):
                    return _eval(node.body)
                if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
                    return node.value
                if isinstance(node, ast.BinOp) and type(node.op) in allowed:
                    return allowed[type(node.op)](_eval(node.left), _eval(node.right))
                if isinstance(node, ast.UnaryOp) and type(node.op) in allowed:
                    return allowed[type(node.op)](_eval(node.operand))
                raise ValueError("expression not allowed")

            return {"ok": True, "expression": expression, "result": _eval(ast.parse(expression, mode="eval"))}

        async def currency_convert(amount: float, from_c: str = "USD", to_c: str = "BDT", **_: Any) -> dict:
            async with httpx.AsyncClient(timeout=6) as c:
                r = (await c.get("https://api.frankfurter.dev/v1/latest",
                                 params={"base": from_c.upper(), "symbols": to_c.upper()})).json()
                rate = r["rates"][to_c.upper()]
                return {"ok": True, "amount": amount, "from": from_c.upper(), "to": to_c.upper(),
                        "rate": rate, "result": round(amount * rate, 2)}

        async def time_now(timezone_name: str = "Asia/Dhaka", **_: Any) -> dict:
            return {"ok": True, "utc": datetime.now(timezone.utc).isoformat(), "timezone": timezone_name}

        self.register("weather.fetch", {
            "type": "object", "properties": {"city": {"type": "string", "minLength": 2}},
            "required": ["city"], "additionalProperties": False,
        }, "server", weather_fetch)
        self.register("math.calculate", {
            "type": "object", "properties": {"expression": {"type": "string", "maxLength": 200}},
            "required": ["expression"], "additionalProperties": False,
        }, "server", calculate)
        self.register("currency.convert", {
            "type": "object",
            "properties": {"amount": {"type": "number"}, "from": {"type": "string", "maxLength": 3},
                           "to": {"type": "string", "maxLength": 3}},
            "required": ["amount"], "additionalProperties": False,
        }, "server", currency_convert)
        self.register("time.now", {"type": "object", "properties": {}, "additionalProperties": False},
                      "server", time_now)


registry = ToolRegistry()
