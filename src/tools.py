"""Tool System — registry, JSON-Schema validation and the execution engine.

Two kinds of tools:
  • server tools run inside the backend (weather, math, currency, time…)
  • client tools are dispatched to the connected client app over WebSocket and
    resolved when the client replies with a tool_result frame.
"""
from __future__ import annotations

import ast
import logging
import operator as op
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

import jsonschema

log = logging.getLogger("highlyagent.tools")

ClientDispatcher = Callable[[str, str, dict], Awaitable[Any]]   # (scope, tool_name, args) -> result


class ToolValidationError(Exception):
    pass


class ToolRegistry:
    def __init__(self):
        self._server: dict[str, dict] = {}                      # name -> {"schema", "handler"}
        self._client: dict[str, dict] = {}
        self._dispatcher: ClientDispatcher | None = None

    # ── registration ────────────────────────────────────
    def register(self, name: str, schema: dict, type_: str,
                 handler: Callable[[dict], Awaitable[Any]] | None = None):
        if not isinstance(schema, dict) or schema.get("type") != "object":
            raise ToolValidationError(f"tool '{name}': schema must be an object schema")
        jsonschema.Draft7Validator.check_schema(schema)
        if type_ == "client":
            self._client[name] = {"schema": schema}
        else:
            if handler is None:
                raise ToolValidationError(f"server tool '{name}' requires a handler")
            self._server[name] = {"schema": schema, "handler": handler}
        log.info("tool registered: %s (%s)", name, type_)

    def set_client_dispatcher(self, fn: ClientDispatcher | None):
        self._dispatcher = fn

    # ── execution ───────────────────────────────────────
    async def execute(self, name: str, args: dict, scope: str = "") -> Any:
        if name in self._server:
            spec = self._server[name]
            self._validate(name, spec["schema"], args)
            return await spec["handler"](args)
        if name in self._client:
            spec = self._client[name]
            self._validate(name, spec["schema"], args)
            if self._dispatcher is None:
                raise ToolValidationError(f"client tool '{name}': no live client connection to dispatch to")
            return await self._dispatcher(scope, name, args)
        raise ToolValidationError(f"tool '{name}' is not registered")

    @staticmethod
    def _validate(name: str, schema: dict, args: dict):
        try:
            jsonschema.validate(args, schema)
        except jsonschema.ValidationError as exc:
            raise ToolValidationError(f"tool '{name}': {exc.message}") from exc

    def list(self) -> list[dict]:
        return ([{"name": n, "type": "server", "schema": s["schema"]} for n, s in self._server.items()]
                + [{"name": n, "type": "client", "schema": s["schema"]} for n, s in self._client.items()])


# ── safe math evaluator (AST allowlist — no code execution) ──
_ALLOWED_BINOPS = {
    ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv, ast.Mod: op.mod, ast.Pow: op.pow,
}
_ALLOWED_UNARY = {ast.UAdd: op.pos, ast.USub: op.neg}


def _safe_eval(node: ast.AST) -> float | int:
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
        return _ALLOWED_BINOPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY:
        return _ALLOWED_UNARY[type(node.op)](_safe_eval(node.operand))
    raise ValueError(f"disallowed expression node: {type(node).__name__}")


# ── built-in server tools ───────────────────────────────
async def _math(args: dict) -> dict:
    tree = ast.parse(args["expression"].replace("×", "*").replace("÷", "/"), mode="eval")
    value = _safe_eval(tree)
    return {"ok": True, "expression": args["expression"], "result": value}


async def _weather(args: dict) -> dict:
    # deterministic demo forecast — swap for a real provider in production
    city = args["city"]
    temp = 24 + (sum(ord(c) for c in city) % 11)
    return {"ok": True, "city": city, "temp_c": temp,
            "condition": "partly cloudy", "humidity": 60 + (len(city) % 25)}


async def _currency(args: dict) -> dict:
    rates = {"usd": 1.0, "bdt": 117.5, "eur": 0.92, "gbp": 0.79, "inr": 83.2}
    amt, src, dst = args["amount"], args["from"].lower(), args["to"].lower()
    if src not in rates or dst not in rates:
        raise ToolValidationError("unsupported currency")
    return {"ok": True, "amount": amt, "from": src, "to": dst,
            "result": round(amt / rates[src] * rates[dst], 2)}


async def _time(_args: dict) -> dict:
    now = datetime.now(timezone.utc)
    return {"ok": True, "utc": now.isoformat(), "epoch": int(now.timestamp())}


registry = ToolRegistry()
registry.register("math.calculate", {"type": "object", "properties": {"expression": {"type": "string"}},
                                     "required": ["expression"]}, "server", _math)
registry.register("weather.fetch", {"type": "object", "properties": {"city": {"type": "string"}},
                                    "required": ["city"]}, "server", _weather)
registry.register("currency.convert", {"type": "object", "properties": {
    "amount": {"type": "number"}, "from": {"type": "string"}, "to": {"type": "string"}},
    "required": ["amount", "from", "to"]}, "server", _currency)
registry.register("time.now", {"type": "object", "properties": {}}, "server", _time)
