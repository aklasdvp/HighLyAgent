# HighLyAgent — API Reference

Base: `https://api.highlyagent.io` · JSON · UTF-8 (বাংলা + English)

## Auth plane (Admin dashboard — JWT, no API key needed)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/setup` | First boot only — create admin (username, email, password). 409 if exists. |
| POST | `/api/v1/auth/login` | `{identifier, password}` → `{access_token(30m), refresh_token(7d)}` |
| POST | `/api/v1/auth/refresh` | `{refresh_token}` → new pair (old refresh rotated & revoked) |
| POST | `/api/v1/auth/logout` | revoke refresh token |
| GET  | `/api/v1/auth/me` | session profile |

Session timeout: access exp enforced server-side; dashboard auto-refreshes 30s before expiry.

## Admin plane (all require `Authorization: Bearer <JWT>` + RBAC)

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/v1/projects` | list / register project (manual — no defaults) |
| PATCH/DELETE | `/api/v1/projects/{id}` | update config / delete (cascades keys+KB) |
| POST | `/api/v1/projects/{id}/keys/rotate` | issue new key — visible once |
| GET | `/api/v1/keys` | all keys (masked; hash-only server-side) |
| GET/PATCH | `/api/v1/providers/{id}` | model, temperature, max_tokens, key (manual) |
| POST | `/api/v1/providers/fallback-order` | explicit chain order |
| GET/POST | `/api/v1/projects/{id}/knowledge` | list / add training rule |
| PATCH/DELETE | `/api/v1/knowledge/{id}` | edit / remove (+ vector) |
| POST | `/api/v1/knowledge/reindex` | re-embed after model swap |
| GET/POST | `/api/v1/tools` · PATCH `/tools/{id}` | registry, enable/disable |
| GET | `/api/v1/projects/{id}/users` · PATCH `…/users/{id}` | plans, limits, unblock |
| GET | `/api/v1/logs?level=&source=&q=` | runtime logs |
| GET | `/api/v1/audit` | append-only audit trail |
| GET | `/api/v1/system/health` | db/redis/vector/providers status |

## Client plane — the security layer

```http
POST /api/agent/process
X-Client-Id: 9f2c…-uuid          ← REQUIRED (project id)
X-API-Key:   hl_live_3f9a…        ← REQUIRED (project-scoped key)
Content-Type: application/json

{ "user_ref": "u_1947", "text": "ঢাকায় আজ আবহাওয়া কেমন?", "conversation_id": "…" }
```

Verification order:
1. Key exists & not revoked → else `401 INVALID_KEY`
2. `key.client_id == X-Client-Id` → else **`403 ACCESS_DENIED` (project/key mismatch)**
3. Project not suspended, origin allowed, rate limit ok → else `403 / 429`
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
