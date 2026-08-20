# HighLyAgent — Management API Guide

The **Management API** is used by the **Admin Dashboard (HighLyAgent Manager)**
and by operators to manage projects, API keys, knowledge/training, tools, users,
and system health.

## Base URL

```text
http://localhost:8000
```

## Authentication

Management endpoints accept **either** of the following:

1. **Management API Key** (recommended for server-to-server / dashboard calls)
   - Sent as the `X-Management-Key` header.
   - Value comes from the `MANAGEMENT_API_KEY` environment variable (see
     `.env.example`).
   - Grants full admin access and is never handed to a client project.
2. **JWT bearer token** (after `/auth/login`)
   - Sent as `Authorization: Bearer <access_token>`.
   - Access tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 30 min);
     refresh with `POST /auth/refresh`.

```bash
# With the management key
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" http://localhost:8000/projects

# With a JWT
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8000/projects
```

> The auth plane (`/auth/setup`, `/auth/login`, `/auth/refresh`) is JWT-only
> and is not protected by the management key.

## Endpoints overview

### Auth plane

| Method | Path                 | Description                                   |
|--------|----------------------|-----------------------------------------------|
| POST   | `/auth/setup`        | Create the first admin (first boot only)      |
| POST   | `/auth/login`        | Login with username/email + password          |
| POST   | `/auth/refresh`      | Rotate a refresh token into a new token pair  |
| GET    | `/auth/me`           | Current principal (JWT or management key)     |

### Management plane

| Method | Path                                  | Permission   | Description                            |
|--------|---------------------------------------|--------------|----------------------------------------|
| GET    | `/projects`                           | clients.read | List all projects                      |
| POST   | `/projects`                           | clients.write| Create a project (+ project API key)   |
| PATCH  | `/projects/{project_id}`              | clients.write| Update a project (incl. behavior)      |
| DELETE | `/projects/{project_id}`              | clients.delete | Delete a project                     |
| POST   | `/projects/{project_id}/keys/rotate`  | clients.write| Regenerate the project API key         |
| GET    | `/projects/{project_id}/knowledge`    | knowledge.read | List knowledge entries              |
| POST   | `/projects/{project_id}/knowledge`    | knowledge.write | Add training/knowledge              |
| GET    | `/tools`                              | clients.read | List tools                             |
| POST   | `/tools`                              | tools.manage | Register a tool                        |
| PATCH  | `/tools/{tool_id}`                    | tools.manage | Update a tool (enable/disable, schema) |
| GET    | `/projects/{project_id}/users`        | clients.read | List users and usage for a project     |
| GET    | `/system/health`                      | —            | Database/Redis/provider health         |

> With the management key you bypass RBAC entirely (admin-equivalent). With a
> JWT, the caller's role must carry the listed permission (admin / manager /
> developer / viewer).

## Project management

### Create a project

`POST /projects` — creates the project and an associated **Project API Key**.
The key is returned **exactly once**.

```bash
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "name": "My E-commerce Store",
    "behavior_description": "This project is an e-commerce website. Give helpful, concise answers about products, orders, refunds and shipping.",
    "platform": "web",
    "rate_limit_per_min": 120
  }'
```

```json
{
  "client": {
    "id": "3f2a…c9e1",
    "name": "My E-commerce Store",
    "behavior_description": "This project is an e-commerce website. Give helpful, concise answers about products, orders, refunds and shipping.",
    "platform": "web",
    "rate_limit_per_min": 120,
    "suspended": false,
    "created_at": "2026-08-20T12:00:00"
  },
  "key": {
    "key": { "id": "…", "label": "default", "last4": "aB3d", "revoked": false, "created_at": "…" },
    "visible_key": "hl_live_9Q…"
  }
}
```

**Save `visible_key` now** — it is never returned again.

### List projects

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" http://localhost:8000/projects
```

### Update a project (edit name, behavior, platform, suspend, etc.)

`PATCH /projects/{project_id}` — send only the fields you want to change.

```bash
curl -X PATCH http://localhost:8000/projects/3f2a…c9e1 \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "behavior_description": "This project is an e-commerce website focused on fashion and returns.",
    "suspended": false
  }'
```

### Delete a project

```bash
curl -X DELETE http://localhost:8000/projects/3f2a…c9e1 \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

Deleting a project cascades: keys, users, knowledge, tools, and conversations
are removed.

### Rotate the project API key

`POST /projects/{project_id}/keys/rotate` — the old key is revoked instantly
and a new one is issued (shown once).

```bash
curl -X POST http://localhost:8000/projects/3f2a…c9e1/keys/rotate \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

## AI provider configuration

AI providers are configured **via environment variables** (there is no runtime
endpoint — a restart picks up changes). In `.env`:

```text
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
DEFAULT_PROVIDER=openai
FALLBACK_CHAIN=openai,claude,gemini,deepseek
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
```

- `FALLBACK_CHAIN` is walked in order; the first provider with a key that
  succeeds is used.
- Leave unused provider keys blank.
- Check what is actually configured with `GET /system/health` (returns
  `providers` as `{"openai": true, ...}` and the active `fallback_chain`).

## Tool management

Tools power the agent's actions (e.g. weather, math, currency, time). Two kinds:

- **server** tools — executed inside HighLyAgent (must use a known built-in
  implementation name, e.g. `weather.fetch`).
- **client** tools — dispatched to a connected client over WebSocket.

### List tools

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" http://localhost:8000/tools
```

### Register a tool

`POST /tools` — body is a JSON-Schema describing the arguments.

```json
{
  "name": "orders.lookup",
  "type": "client",
  "description": "Look up an order by id on the client app.",
  "schema": {
    "type": "object",
    "properties": { "order_id": { "type": "string" } },
    "required": ["order_id"],
    "additionalProperties": false
  }
}
```

### Update / disable a tool

```bash
curl -X PATCH http://localhost:8000/tools/<tool_id> \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{ "enabled": false }'
```

## Training (knowledge base)

Add curated entries the agent should answer without calling an AI provider.

```bash
curl -X POST http://localhost:8000/projects/<project_id>/knowledge \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "category": "shipping",
    "trigger_text": "How long does delivery take?",
    "response_text": "Standard delivery takes 3-5 business days across Bangladesh.",
    "tool_calls": [],
    "active": true
  }'
```

List entries with `GET /projects/{project_id}/knowledge`.

## Error codes

| HTTP | Code            | Meaning                                            |
|------|-----------------|----------------------------------------------------|
| 401  | `INVALID_KEY`   | Missing/invalid management key or JWT              |
| 403  | `INSUFFICIENT`  | JWT role lacks the required permission             |
| 404  | —               | Project / tool / knowledge entry not found         |
| 409  | —               | Admin already exists (use `/auth/login`)           |
| 422  | —               | Request validation failed (see response `detail`)  |
| 429  | —               | Rate limit exceeded (`RATE_LIMIT_PER_MINUTE`)      |

## Example (Python)

```python
import httpx

MGMT_KEY = "hl_mgmt_your_key"
BASE = "http://localhost:8000"

headers = {"X-Management-Key": MGMT_KEY}

r = httpx.post(
    f"{BASE}/projects",
    headers={**headers, "Content-Type": "application/json"},
    json={
        "name": "My Store",
        "behavior_description": "E-commerce assistant. Be concise and helpful.",
        "platform": "web",
    },
)
print(r.status_code, r.json())
```
