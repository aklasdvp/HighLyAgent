# HighLyAgent — Management API Guide

The **Management API** is used by the **Admin Dashboard (HighLyAgent Manager)**
and by operators to manage projects, API keys, knowledge/training, tools, users,
limits, providers, and analytics.

## Base URL

```text
http://localhost:8000
```

## Response format

Every endpoint returns a standardized envelope.

Success:

```json
{
  "success": true,
  "data": { },
  "message": "ok",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

List responses wrap `items` with pagination metadata inside `data`:

```json
{
  "success": true,
  "data": {
    "items": [ ],
    "total": 0,
    "limit": 50,
    "offset": 0
  },
  "message": "ok",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "message": "daily request limit reached",
  "error_code": "LIMIT_EXCEEDED",
  "detail": "daily request limit reached",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

List endpoints accept `limit` (default 50, max 500) and `offset` (default 0)
query parameters.

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

| Method | Path                                     | Permission   | Description                              |
|--------|------------------------------------------|--------------|------------------------------------------|
| GET    | `/projects`                              | clients.read | List projects (paginated)                |
| POST   | `/projects`                              | clients.write | Create a project (+ project API key)   |
| PATCH  | `/projects/{project_id}`                 | clients.write | Update a project (incl. behavior, provider) |
| PATCH  | `/projects/{project_id}/limits`          | clients.write | Configure per-user usage limits         |
| DELETE | `/projects/{project_id}`                 | clients.delete | Delete a project                      |
| POST   | `/projects/{project_id}/keys/rotate`     | clients.write | Regenerate the project API key           |
| GET    | `/projects/{project_id}/analytics`       | clients.read | Usage analytics for a project            |
| GET    | `/projects/{project_id}/knowledge`       | knowledge.read | List knowledge entries (incl. auto-learned) |
| POST   | `/projects/{project_id}/knowledge`       | knowledge.write | Add training/knowledge                |
| GET    | `/projects/{project_id}/knowledge/{entry_id}` | knowledge.read | Get one knowledge entry              |
| PUT    | `/projects/{project_id}/knowledge/{entry_id}` | knowledge.write | Update a knowledge entry             |
| DELETE | `/projects/{project_id}/knowledge/{entry_id}` | knowledge.write | Delete a knowledge entry             |
| GET    | `/tools`                                 | clients.read | List tools (paginated)                   |
| POST   | `/tools`                                 | tools.manage | Register a tool                         |
| PATCH  | `/tools/{tool_id}`                       | tools.manage | Update a tool (enable/disable, schema)   |
| DELETE | `/tools/{tool_id}?confirm=true`          | tools.manage | Delete a tool from all projects         |
| GET    | `/projects/{project_id}/users`           | clients.read | List users and usage for a project       |
| GET    | `/system/health`                         | —            | Database/Redis/provider health           |

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
    "ai_provider": "openai",
    "ai_model": "gpt-4o-mini",
    "daily_token_limit": 50000,
    "daily_request_limit": 2000,
    "rate_limit_per_min": 120
  }'
```

```json
{
  "success": true,
  "data": {
    "client": {
      "id": "3f2a…c9e1",
      "name": "My E-commerce Store",
      "behavior_description": "…",
      "platform": "web",
      "rate_limit_per_min": 120,
      "suspended": false,
      "ai_provider": "openai",
      "ai_model": "gpt-4o-mini",
      "daily_request_limit": 2000,
      "monthly_request_limit": null,
      "daily_token_limit": 50000,
      "monthly_token_limit": null,
      "created_at": "2026-08-20T12:00:00"
    },
    "key": {
      "key": { "id": "…", "label": "default", "last4": "aB3d", "revoked": false, "created_at": "…" },
      "visible_key": "hl_live_9Q…"
    }
  },
  "message": "project created — save the visible API key now",
  "timestamp": "…"
}
```

**Save `visible_key` now** — it is never returned again.

### List projects

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/projects?limit=50&offset=0"
```

### Update a project (edit name, behavior, provider, suspend, etc.)

`PATCH /projects/{project_id}` — send only the fields you want to change.

```bash
curl -X PATCH http://localhost:8000/projects/3f2a…c9e1 \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "behavior_description": "This project is an e-commerce website focused on fashion and returns.",
    "ai_provider": "deepseek",
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

## Project usage limits

`PATCH /projects/{project_id}/limits` configures **per-user** limits. Any field
omitted or set to `null` means "inherit the per-user default".

Fields:

| Field                  | Type  | Meaning                      |
|------------------------|-------|------------------------------|
| `daily_request_limit`  | int   | Max requests per user / day  |
| `monthly_request_limit`| int   | Max requests per user / month|
| `daily_token_limit`    | int   | Max tokens per user / day    |
| `monthly_token_limit`  | int   | Max tokens per user / month  |

```bash
curl -X PATCH http://localhost:8000/projects/3f2a…c9e1/limits \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "daily_request_limit": 1000,
    "monthly_request_limit": 20000,
    "daily_token_limit": 50000,
    "monthly_token_limit": 500000
  }'
```

When a user exceeds a limit the client API returns `402 LIMIT_EXCEEDED`.

## AI provider selection (per project)

By default all projects use the global `FALLBACK_CHAIN`. To pin a specific
provider/model for one project, set `ai_provider` and `ai_model` at creation or
via `PATCH /projects/{project_id}`.

```bash
curl -X PATCH http://localhost:8000/projects/3f2a…c9e1 \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{ "ai_provider": "claude", "ai_model": "claude-haiku-4" }'
```

Valid providers: `openai`, `claude`, `gemini`, `deepseek`. The provider must
have an API key configured in the environment. If the project provider fails,
the request surfaces the error (no fallback) — leave `ai_provider` unset to keep
the global fallback chain.

Global providers remain environment-configured:

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

Check what is configured with `GET /system/health`.

## Analytics

`GET /projects/{project_id}/analytics` returns per-project usage analytics:

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/projects/3f2a…c9e1/analytics
```

```json
{
  "success": true,
  "data": {
    "project_id": "3f2a…c9e1",
    "total_users": 42,
    "daily_active_users": 7,
    "requests": { "today": 19, "month": 340, "all_time": 1200 },
    "daily_requests_30d": [ { "date": "2026-08-20", "count": 22 } ],
    "tokens": { "total": 510000, "avg_per_user": 12142.86 },
    "most_used_tools": [ { "tool": "weather.fetch", "count": 55 } ],
    "most_common_intents": [ { "intent": "support", "count": 88 } ],
    "error_rate": 1.2,
    "avg_response_ms": 482.5
  },
  "message": "analytics",
  "timestamp": "…"
}
```

## Tool management

Tools power the agent's actions. Two kinds:

- **server** tools — executed inside HighLyAgent (must use a known built-in
  implementation name, e.g. `weather.fetch`).
- **client** tools — dispatched to a connected client over WebSocket.

### List tools

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/tools?limit=50&offset=0"
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

### Delete a tool

`DELETE /tools/{tool_id}` removes the tool from **every project**. It requires
explicit confirmation via `?confirm=true`; without it the API returns
`400 CONFIRMATION_REQUIRED`.

```bash
curl -X DELETE "http://localhost:8000/tools/<tool_id>?confirm=true" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

## Training (knowledge base)

Entries can be curated (added by an admin) or **auto-learned** (created by the
agent after answering a new question). Both kinds are listed and editable.

### List entries (curated + auto-learned)

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/projects/<project_id>/knowledge"
```

### Add an entry

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

### Get one entry

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/projects/<project_id>/knowledge/<entry_id>
```

### Update an entry (editable for auto-learned entries too)

`PUT /projects/{project_id}/knowledge/{entry_id}` — the embedding is
recomputed automatically when `trigger_text` changes.

```bash
curl -X PUT http://localhost:8000/projects/<project_id>/knowledge/<entry_id> \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "category": "shipping",
    "trigger_text": "How long does delivery take?",
    "response_text": "Standard delivery takes 2-4 business days across Bangladesh.",
    "tool_calls": [],
    "active": true
  }'
```

### Delete an entry

```bash
curl -X DELETE http://localhost:8000/projects/<project_id>/knowledge/<entry_id> \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

## Error codes

| HTTP | Code                    | Meaning                                            |
|------|-------------------------|----------------------------------------------------|
| 401  | `INVALID_KEY`           | Missing/invalid management key or JWT              |
| 403  | `INSUFFICIENT`          | JWT role lacks the required permission             |
| 404  | —                       | Project / tool / knowledge entry not found         |
| 409  | —                       | Admin already exists (use `/auth/login`)           |
| 400  | `CONFIRMATION_REQUIRED` | Destructive action needs `?confirm=true`           |
| 402  | `LIMIT_EXCEEDED`        | Project user usage limit reached                   |
| 422  | `VALIDATION_ERROR`      | Request validation failed (see `detail`)           |
| 429  | —                       | Rate limit exceeded (`RATE_LIMIT_PER_MINUTE`)      |
| 500  | `INTERNAL`              | Unexpected server error                            |

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
        "ai_provider": "openai",
    },
)
print(r.status_code, r.json())
```
