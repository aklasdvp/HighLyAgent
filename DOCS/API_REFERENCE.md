# API Reference

Base: `http://localhost:8000` (or your server) · JSON · UTF-8 (বাংলা + English)

Endpoints are served at the **root** — there is no `/api/v1` prefix.

## Public plane (no auth — safe to expose)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Browsers (`Accept: text/html`) get the public landing page; API clients get minimal JSON. Reveals no version, hosts or internal paths. |
| GET | `/health` | Liveness probe for ops/monitors (`{"status":"ok"}`). |

## Auth plane (Admin dashboard — JWT, no API key needed)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/setup` | First boot only — create admin (username, email, password). 409 if exists. |
| POST | `/auth/login` | `{identifier, password}` → `{access_token(30m), refresh_token(7d)}` |
| POST | `/auth/refresh` | `{refresh_token}` → new pair (old refresh rotated & revoked) |
| GET  | `/auth/me` | session profile |

## Admin plane (all require `Authorization: Bearer <JWT>` + RBAC)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/projects` | list / register project (manual — no defaults) |
| PATCH/DELETE | `/projects/{id}` | update config / delete (cascades keys+KB) |
| POST | `/projects/{id}/keys/rotate` | issue new key — visible once |
| GET/POST | `/projects/{id}/knowledge` | list / add training rule |
| GET | `/projects/{id}/users` | per-user usage ledger |
| GET | `/tools` | tool registry |
| GET | `/system/health` | db/redis/vector/provider status |

## Client plane — the security layer

```http
POST /agent/process
X-Client-Id: 9f2c…-uuid          ← REQUIRED (project id)
X-API-Key:   hl_live_3f9a…        ← REQUIRED (project-scoped key)
Content-Type: application/json

{ "user_ref": "u_1947", "text": "ঢাকায় আজ আবহাওয়া কেমন?" }
```

Verification order:
1. Key exists & not revoked → else `401 INVALID_KEY`
2. `key.client_id == X-Client-Id` → else **`403 ACCESS_DENIED` (project/key mismatch)**
3. Project not suspended → else `403 SUSPENDED`
4. User quota → else `402 LIMIT_EXCEEDED`

WebSocket: `wss://…/ws?client_id=<uuid>&token=hl_live_…` — same pair check;
mismatch closes with code `4403`.

Response (200):
```json
{ "task_id": "…", "text": "ঢাকায় এখন ২৮°…", "source": "knowledge|ai",
  "similarity": 0.91, "tools": ["weather.fetch"],
  "tokens": 0, "cost_usd": 0.0, "latency_ms": 118 }
```

## Error codes
`400 VALIDATION` · `401 INVALID_KEY | TOKEN_EXPIRED` · `402 LIMIT_EXCEEDED` ·
`403 ACCESS_DENIED | SUSPENDED` · `404` · `409 CONFLICT` · `429 RATE_LIMITED` · `500 INTERNAL`
