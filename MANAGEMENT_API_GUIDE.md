# HighLyAgent — Management API Guide (Complete Reference)

The **Management API** is used by the **Admin Dashboard (HighLyAgent Manager)** and by operators to manage projects, API keys, knowledge/training, tools, users, limits, providers, and analytics.

---

## Base URL

```text
http://localhost:8000
```

---

## Response Format

Every endpoint returns a standardized envelope.

### Success Response

```json
{
  "success": true,
  "data": { },
  "message": "ok",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

### List Response (with pagination)

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

### Error Response

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

### Pagination Parameters

List endpoints accept query parameters:
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

---

## Authentication

Management endpoints accept **either** of the following:

### Option 1: Management API Key (Recommended for Dashboard)
- **Header:** `X-Management-Key`
- **Value:** From `MANAGEMENT_API_KEY` environment variable
- **Grants:** Full admin access

### Option 2: JWT Bearer Token (After Login)
- **Header:** `Authorization: Bearer <access_token>`
- **Expires:** After `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30 min)
- **Refresh:** Use `POST /auth/refresh`

```bash
# With management key
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" http://localhost:8000/projects

# With JWT
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:8000/projects
```

> **Note:** Auth endpoints (`/auth/login`, `/auth/refresh`) are JWT-only and not protected by the management key. Admin account is created from environment variables on first boot — there is no `/auth/setup` endpoint.

---

## Endpoints Overview

### Auth Plane

| Method | Path            | Description                              |
|--------|-----------------|------------------------------------------|
| POST   | `/auth/login`   | Login with username/email + password     |
| POST   | `/auth/refresh` | Rotate refresh token into new token pair |
| GET    | `/auth/me`      | Get current principal info               |

### Management Plane

| Method | Path                                     | Permission     | Description                           |
|--------|------------------------------------------|----------------|---------------------------------------|
| GET    | `/projects`                              | clients.read   | List all projects (paginated)         |
| POST   | `/projects`                              | clients.write  | Create project + API key              |
| GET    | `/projects/{project_id}`                 | clients.read   | Get single project details            |
| PATCH  | `/projects/{project_id}`                 | clients.write  | Update project settings               |
| PATCH  | `/projects/{project_id}/limits`          | clients.write  | Configure per-user usage limits       |
| DELETE | `/projects/{project_id}`                 | clients.delete | Delete project (cascade)              |
| POST   | `/projects/{project_id}/keys/rotate`     | clients.write  | Regenerate project API key            |
| GET    | `/projects/{project_id}/analytics`       | clients.read   | Get usage analytics                   |
| GET    | `/projects/{project_id}/knowledge`       | knowledge.read | List knowledge entries                |
| POST   | `/projects/{project_id}/knowledge`       | knowledge.write| Add knowledge entry                   |
| GET    | `/projects/{project_id}/knowledge/{id}`  | knowledge.read | Get single knowledge entry            |
| PUT    | `/projects/{project_id}/knowledge/{id}`  | knowledge.write| Update knowledge entry                |
| DELETE | `/projects/{project_id}/knowledge/{id}`  | knowledge.write| Delete knowledge entry                |
| GET    | `/tools`                                 | clients.read   | List all tools (paginated)            |
| POST   | `/tools`                                 | tools.manage   | Register new tool                     |
| PATCH  | `/tools/{tool_id}`                       | tools.manage   | Update tool (enable/disable/schema)   |
| DELETE | `/tools/{tool_id}?confirm=true`          | tools.manage   | Delete tool from all projects         |
| GET    | `/projects/{project_id}/users`           | clients.read   | List users and usage stats            |
| GET    | `/system/health`                         | —              | Check system health                   |

> With management key you bypass RBAC entirely (admin-equivalent). With JWT, the caller's role must carry the listed permission.

---

## 1. Authentication Endpoints

### POST /auth/login

Login with username/email and password. Returns JWT tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "login successful",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `401 INVALID_CREDENTIALS` — Wrong username or password
- `400 VALIDATION_ERROR` — Missing required fields

---

### POST /auth/refresh

Exchange a refresh token for a new access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in": 1800
  },
  "message": "token refreshed",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `401 INVALID_TOKEN` — Expired or invalid refresh token

---

### GET /auth/me

Get information about the currently authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "username": "admin",
    "email": "admin@highlyagent.com",
    "role": "admin",
    "created_at": "2026-08-20T12:00:00"
  },
  "message": "current user",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

---

## 2. Project Management

### POST /projects

Create a new project with an associated Project API Key. The key is returned **exactly once**.

**Request:**
```json
{
  "name": "My E-commerce Store",
  "behavior_description": "This project is an e-commerce website. Give helpful, concise answers about products, orders, refunds and shipping.",
  "platform": "web",
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "daily_token_limit": 50000,
  "daily_request_limit": 2000,
  "monthly_token_limit": null,
  "monthly_request_limit": null,
  "rate_limit_per_min": 120
}
```

**Request Fields:**

| Field                  | Type   | Required | Default | Description                                      |
|------------------------|--------|----------|---------|--------------------------------------------------|
| `name`                 | string | Yes      | —       | Project name                                     |
| `behavior_description` | string | Yes      | —       | Instructions for AI behavior                     |
| `platform`             | string | No       | `web`   | Platform type: `web`, `mobile`, `api`, etc.      |
| `ai_provider`          | string | No       | `null`  | Specific provider: `openai`, `claude`, `gemini`, `deepseek`. If null, uses global fallback chain |
| `ai_model`             | string | No       | `null`  | Specific model name. Must match provider         |
| `daily_token_limit`    | int    | No       | `null`  | Per-user daily token limit                       |
| `daily_request_limit`  | int    | No       | `null`  | Per-user daily request limit                     |
| `monthly_token_limit`  | int    | No       | `null`  | Per-user monthly token limit                     |
| `monthly_request_limit`| int    | No       | `null`  | Per-user monthly request limit                   |
| `rate_limit_per_min`   | int    | No       | `60`    | Rate limit per minute                            |

**Response:**
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "3f2a…c9e1",
      "name": "My E-commerce Store",
      "behavior_description": "This project is an e-commerce website. Give helpful, concise answers about products, orders, refunds and shipping.",
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
      "id": "key-uuid",
      "label": "default",
      "last4": "aB3d",
      "revoked": false,
      "created_at": "2026-08-20T12:00:00"
    },
    "visible_key": "hl_live_9Q…"
  },
  "message": "project created — save the visible API key now",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

> ⚠️ **Save `visible_key` immediately** — it is never returned again.

**Error Responses:**
- `400 VALIDATION_ERROR` — Missing required fields or invalid format
- `409 DUPLICATE_NAME` — Project name already exists

---

### GET /projects

List all projects with pagination.

**Query Parameters:**
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/projects?limit=50&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "3f2a…c9e1",
        "name": "My E-commerce Store",
        "behavior_description": "...",
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
      }
    ],
    "total": 5,
    "limit": 50,
    "offset": 0
  },
  "message": "projects retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

---

### GET /projects/{project_id}

Get details of a single project.

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/projects/3f2a…c9e1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "3f2a…c9e1",
    "name": "My E-commerce Store",
    "behavior_description": "...",
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
  "message": "project retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist

---

### PATCH /projects/{project_id}

Update project settings. Send only the fields you want to change.

**Request:**
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

**Updatable Fields:**
- `name`
- `behavior_description`
- `platform`
- `ai_provider`
- `ai_model`
- `suspended`
- `rate_limit_per_min`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "3f2a…c9e1",
    "name": "My E-commerce Store",
    "behavior_description": "This project is an e-commerce website focused on fashion and returns.",
    "platform": "web",
    "rate_limit_per_min": 120,
    "suspended": false,
    "ai_provider": "deepseek",
    "ai_model": "deepseek-chat",
    "daily_request_limit": 2000,
    "monthly_request_limit": null,
    "daily_token_limit": 50000,
    "monthly_token_limit": null,
    "created_at": "2026-08-20T12:00:00",
    "updated_at": "2026-08-21T04:31:41"
  },
  "message": "project updated",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist
- `400 VALIDATION_ERROR` — Invalid field values

---

### DELETE /projects/{project_id}

Delete a project. This cascades to remove keys, users, knowledge, tools, and conversations.

**Request:**
```bash
curl -X DELETE http://localhost:8000/projects/3f2a…c9e1 \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "project deleted",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist

---

### POST /projects/{project_id}/keys/rotate

Regenerate the project API key. The old key is revoked instantly and a new one is issued (shown once).

**Request:**
```bash
curl -X POST http://localhost:8000/projects/3f2a…c9e1/keys/rotate \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": {
      "id": "new-key-uuid",
      "label": "default",
      "last4": "xY9z",
      "revoked": false,
      "created_at": "2026-08-21T04:31:41"
    },
    "visible_key": "hl_live_nEwK3y…"
  },
  "message": "API key rotated — save the visible key now",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

> ⚠️ **Save `visible_key` immediately** — it is never returned again.

---

## 3. Project Usage Limits

### PATCH /projects/{project_id}/limits

Configure **per-user** usage limits for a project. Any field omitted or set to `null` means "no limit".

**Request:**
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

**Fields:**

| Field                  | Type | Meaning                          | `0` or `null` means |
|------------------------|------|----------------------------------|---------------------|
| `daily_request_limit`  | int  | Max requests per user / day      | No limit            |
| `monthly_request_limit`| int  | Max requests per user / month    | No limit            |
| `daily_token_limit`    | int  | Max tokens per user / day        | No limit            |
| `monthly_token_limit`  | int  | Max tokens per user / month      | No limit            |

**Response:**
```json
{
  "success": true,
  "data": {
    "project_id": "3f2a…c9e1",
    "daily_request_limit": 1000,
    "monthly_request_limit": 20000,
    "daily_token_limit": 50000,
    "monthly_token_limit": 500000
  },
  "message": "limits updated",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Behavior:**
- When a user exceeds a limit, the client API returns `402 LIMIT_EXCEEDED`
- Limits are per-user, not shared globally
- `0` or `null` = unlimited

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist
- `400 VALIDATION_ERROR` — Negative values or invalid types

---

## 4. AI Provider Selection (Per Project)

By default, all projects use the global `FALLBACK_CHAIN`. To pin a specific provider/model for one project, set `ai_provider` and `ai_model` at creation or via `PATCH /projects/{project_id}`.

### Valid Providers

| Provider   | Environment Variable   | Example Models                  |
|------------|------------------------|---------------------------------|
| `openai`   | `OPENAI_API_KEY`       | `gpt-4o-mini`, `gpt-4o`, `gpt-3.5-turbo` |
| `claude`   | `ANTHROPIC_API_KEY`    | `claude-haiku-4`, `claude-sonnet-4` |
| `gemini`   | `GEMINI_API_KEY`       | `gemini-1.5-flash`, `gemini-1.5-pro` |
| `deepseek` | `DEEPSEEK_API_KEY`     | `deepseek-chat`, `deepseek-coder` |

### Global Configuration (in `.env`)

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

### Set Project-Specific Provider

```bash
curl -X PATCH http://localhost:8000/projects/3f2a…c9e1 \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{ "ai_provider": "claude", "ai_model": "claude-haiku-4" }'
```

### Precedence Rules

```
Project-specific ai_provider/ai_model
        ↓
If configured → Use project configuration (no fallback)
        ↓
If not configured → Use global FALLBACK_CHAIN
```

> ⚠️ **Important:** If a project has a specific provider configured and that provider fails, the request surfaces the error (no fallback). Leave `ai_provider` unset to keep the global fallback chain.

### Check Provider Health

```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/system/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "database": "connected",
    "redis": "connected",
    "providers": {
      "openai": "configured",
      "claude": "configured",
      "gemini": "not_configured",
      "deepseek": "configured"
    }
  },
  "message": "system healthy",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

---

## 5. Analytics

### GET /projects/{project_id}/analytics

Returns per-project usage analytics calculated from real database data.

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/projects/3f2a…c9e1/analytics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "project_id": "3f2a…c9e1",
    "users": {
      "total": 42,
      "daily_active": 7
    },
    "requests": {
      "today": 19,
      "this_month": 340,
      "all_time": 1200,
      "last_30_days": [
        { "date": "2026-08-20", "count": 22 },
        { "date": "2026-08-19", "count": 18 },
        ...
      ]
    },
    "tokens": {
      "total": 510000,
      "average_per_user": 12142.86
    },
    "tools": [
      { "tool": "weather.fetch", "count": 55 },
      { "tool": "orders.lookup", "count": 32 }
    ],
    "intents": [
      { "intent": "support", "count": 88 },
      { "intent": "sales", "count": 45 }
    ],
    "error_rate": 1.2,
    "average_response_time_ms": 482.5
  },
  "message": "analytics retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Analytics Fields:**

| Field                    | Type     | Description                                      |
|--------------------------|----------|--------------------------------------------------|
| `project_id`             | string   | The project UUID                                 |
| `users.total`            | int      | Total unique users                               |
| `users.daily_active`     | int      | Users active today                               |
| `requests.today`         | int      | Requests made today                              |
| `requests.this_month`    | int      | Requests made this month                         |
| `requests.all_time`      | int      | Total requests since creation                    |
| `requests.last_30_days`  | array    | Daily request counts for last 30 days            |
| `tokens.total`           | int      | Total tokens consumed                            |
| `tokens.average_per_user`| float    | Average tokens per user                          |
| `tools`                  | array    | Most used tools (sorted by count)                |
| `intents`                | array    | Most common intents (sorted by count)            |
| `error_rate`             | float    | Percentage of failed requests (0-100)            |
| `average_response_time_ms`| float   | Average response time in milliseconds            |

**Notes:**
- `last_30_days` includes dates with zero requests for continuous timeline
- All dates are in UTC
- `error_rate` = (failed requests / total requests) × 100
- `tools` and `intents` arrays show top 10 items

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist

---

## 6. Knowledge Base Management

Knowledge entries can be:
- **Curated** — Manually added by admin
- **Auto-learned** — Created by the agent after answering new questions

Both types are listed, editable, and deletable.

### GET /projects/{project_id}/knowledge

List all knowledge entries for a project (curated + auto-learned).

**Query Parameters:**
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/projects/3f2a…c9e1/knowledge?limit=50&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "entry-uuid",
        "project_id": "3f2a…c9e1",
        "category": "shipping",
        "trigger_text": "How long does delivery take?",
        "response_text": "Standard delivery takes 3-5 business days across Bangladesh.",
        "source": "manual",
        "active": true,
        "created_at": "2026-08-20T12:00:00",
        "updated_at": "2026-08-20T12:00:00"
      },
      {
        "id": "entry-uuid-2",
        "project_id": "3f2a…c9e1",
        "category": "returns",
        "trigger_text": "Can I return an item?",
        "response_text": "Yes, you can return items within 30 days of purchase.",
        "source": "auto_learned",
        "active": true,
        "created_at": "2026-08-21T04:00:00",
        "updated_at": "2026-08-21T04:00:00"
      }
    ],
    "total": 2,
    "limit": 50,
    "offset": 0
  },
  "message": "knowledge entries retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Source Field Values:**
- `manual` — Added by admin
- `auto_learned` — Learned by AI automatically

---

### POST /projects/{project_id}/knowledge

Add a new knowledge entry.

**Request:**
```bash
curl -X POST http://localhost:8000/projects/3f2a…c9e1/knowledge \
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

**Request Fields:**

| Field          | Type   | Required | Description                                    |
|----------------|--------|----------|------------------------------------------------|
| `category`     | string | Yes      | Category for organization (e.g., "shipping")   |
| `trigger_text` | string | Yes      | Question/phrase that triggers this knowledge   |
| `response_text`| string | Yes      | Answer/response text                           |
| `tool_calls`   | array  | No       | Optional tool calls to execute                 |
| `active`       | bool   | No       | Whether this entry is active (default: true)   |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "entry-uuid",
    "project_id": "3f2a…c9e1",
    "category": "shipping",
    "trigger_text": "How long does delivery take?",
    "response_text": "Standard delivery takes 3-5 business days across Bangladesh.",
    "source": "manual",
    "active": true,
    "created_at": "2026-08-21T04:31:41",
    "updated_at": "2026-08-21T04:31:41"
  },
  "message": "knowledge entry created",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Project does not exist
- `400 VALIDATION_ERROR` — Missing required fields

---

### GET /projects/{project_id}/knowledge/{entry_id}

Get a single knowledge entry.

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/projects/3f2a…c9e1/knowledge/entry-uuid
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "entry-uuid",
    "project_id": "3f2a…c9e1",
    "category": "shipping",
    "trigger_text": "How long does delivery take?",
    "response_text": "Standard delivery takes 3-5 business days across Bangladesh.",
    "source": "manual",
    "active": true,
    "created_at": "2026-08-20T12:00:00",
    "updated_at": "2026-08-20T12:00:00"
  },
  "message": "knowledge entry retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Entry does not exist or belongs to another project

---

### PUT /projects/{project_id}/knowledge/{entry_id}

Update a knowledge entry. Works for both manual and auto-learned entries. The embedding is recomputed automatically when `trigger_text` changes.

**Request:**
```bash
curl -X PUT http://localhost:8000/projects/3f2a…c9e1/knowledge/entry-uuid \
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "entry-uuid",
    "project_id": "3f2a…c9e1",
    "category": "shipping",
    "trigger_text": "How long does delivery take?",
    "response_text": "Standard delivery takes 2-4 business days across Bangladesh.",
    "source": "manual",
    "active": true,
    "created_at": "2026-08-20T12:00:00",
    "updated_at": "2026-08-21T04:31:41"
  },
  "message": "knowledge entry updated",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Entry does not exist or belongs to another project
- `400 VALIDATION_ERROR` — Invalid field values

---

### DELETE /projects/{project_id}/knowledge/{entry_id}

Delete a knowledge entry. Works for both manual and auto-learned entries.

**Request:**
```bash
curl -X DELETE http://localhost:8000/projects/3f2a…c9e1/knowledge/entry-uuid \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": null,
  "message": "knowledge entry deleted",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Entry does not exist or belongs to another project

---

## 7. Tool Management

Tools power the agent's actions. Two types:

- **server** tools — Executed inside HighLyAgent (must use a known built-in implementation name, e.g., `weather.fetch`)
- **client** tools — Dispatched to a connected client over WebSocket

### GET /tools

List all tools with pagination.

**Query Parameters:**
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/tools?limit=50&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "tool-uuid",
        "name": "weather.fetch",
        "type": "server",
        "description": "Fetch current weather for a location",
        "schema": {
          "type": "object",
          "properties": { "location": { "type": "string" } },
          "required": ["location"],
          "additionalProperties": false
        },
        "enabled": true,
        "created_at": "2026-08-20T12:00:00",
        "updated_at": "2026-08-20T12:00:00"
      }
    ],
    "total": 3,
    "limit": 50,
    "offset": 0
  },
  "message": "tools retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

---

### POST /tools

Register a new tool.

**Request:**
```bash
curl -X POST http://localhost:8000/tools \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{
    "name": "orders.lookup",
    "type": "client",
    "description": "Look up an order by id on the client app.",
    "schema": {
      "type": "object",
      "properties": { "order_id": { "type": "string" } },
      "required": ["order_id"],
      "additionalProperties": false
    }
  }'
```

**Request Fields:**

| Field         | Type   | Required | Description                                    |
|---------------|--------|----------|------------------------------------------------|
| `name`        | string | Yes      | Unique tool name (e.g., `orders.lookup`)       |
| `type`        | string | Yes      | `server` or `client`                           |
| `description` | string | Yes      | Human-readable description                     |
| `schema`      | object | Yes      | JSON Schema defining arguments                 |
| `enabled`     | bool   | No       | Whether tool is enabled (default: true)        |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tool-uuid",
    "name": "orders.lookup",
    "type": "client",
    "description": "Look up an order by id on the client app.",
    "schema": {
      "type": "object",
      "properties": { "order_id": { "type": "string" } },
      "required": ["order_id"],
      "additionalProperties": false
    },
    "enabled": true,
    "created_at": "2026-08-21T04:31:41",
    "updated_at": "2026-08-21T04:31:41"
  },
  "message": "tool registered",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `409 DUPLICATE_NAME` — Tool name already exists
- `400 VALIDATION_ERROR` — Invalid schema or missing fields

---

### PATCH /tools/{tool_id}

Update a tool (enable/disable or modify schema).

**Request:**
```bash
curl -X PATCH http://localhost:8000/tools/tool-uuid \
  -H "Content-Type: application/json" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  -d '{ "enabled": false }'
```

**Updatable Fields:**
- `enabled`
- `description`
- `schema`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "tool-uuid",
    "name": "orders.lookup",
    "type": "client",
    "description": "Look up an order by id on the client app.",
    "schema": { ... },
    "enabled": false,
    "created_at": "2026-08-20T12:00:00",
    "updated_at": "2026-08-21T04:31:41"
  },
  "message": "tool updated",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Tool does not exist
- `400 VALIDATION_ERROR` — Invalid schema

---

### DELETE /tools/{tool_id}

Delete a tool from **every project**. Requires explicit confirmation via `?confirm=true`.

**Request:**
```bash
curl -X DELETE "http://localhost:8000/tools/tool-uuid?confirm=true" \
  -H "X-Management-Key: $MANAGEMENT_API_KEY"
```

**Confirmation Requirement:**
- Without `?confirm=true`: Returns `400 CONFIRMATION_REQUIRED`
- With `?confirm=true`: Proceeds with deletion

**Response (Success):**
```json
{
  "success": true,
  "data": null,
  "message": "tool deleted from all projects",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Response (Without Confirmation):**
```json
{
  "success": false,
  "error_code": "CONFIRMATION_REQUIRED",
  "detail": "Deletion requires ?confirm=true query parameter",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Error Responses:**
- `404 NOT_FOUND` — Tool does not exist
- `400 CONFIRMATION_REQUIRED` — Missing `?confirm=true`

---

## 8. Project Users

### GET /projects/{project_id}/users

List users and their usage statistics for a project.

**Query Parameters:**
- `limit` (default: 50, max: 500)
- `offset` (default: 0)

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  "http://localhost:8000/projects/3f2a…c9e1/users?limit=50&offset=0"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "user_id": "user-uuid",
        "total_requests": 150,
        "total_tokens": 45000,
        "last_active": "2026-08-21T04:00:00"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  },
  "message": "users retrieved",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

---

## 9. System Health

### GET /system/health

Check database, Redis, and AI provider connectivity.

**Request:**
```bash
curl -H "X-Management-Key: $MANAGEMENT_API_KEY" \
  http://localhost:8000/system/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "database": "connected",
    "redis": "connected",
    "providers": {
      "openai": "configured",
      "claude": "configured",
      "gemini": "not_configured",
      "deepseek": "configured"
    }
  },
  "message": "system healthy",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

**Status Values:**
- `connected` / `configured` — Service is available
- `disconnected` / `not_configured` — Service unavailable

---

## Error Codes Reference

| HTTP | Code                    | Meaning                                            |
|------|-------------------------|----------------------------------------------------|
| 200  | —                       | Success                                            |
| 400  | `VALIDATION_ERROR`      | Request validation failed (see `detail`)           |
| 400  | `CONFIRMATION_REQUIRED` | Destructive action needs `?confirm=true`           |
| 401  | `INVALID_KEY`           | Missing/invalid management key or JWT              |
| 401  | `INVALID_CREDENTIALS`   | Wrong username or password                         |
| 401  | `INVALID_TOKEN`         | Expired or invalid token                           |
| 403  | `INSUFFICIENT`          | JWT role lacks the required permission             |
| 404  | —                       | Resource not found                                 |
| 409  | `DUPLICATE_NAME`        | Name already exists                                |
| 402  | `LIMIT_EXCEEDED`        | Project user usage limit reached                   |
| 429  | —                       | Rate limit exceeded                                |
| 500  | `INTERNAL`              | Unexpected server error                            |

---

## Example Usage (Python)

```python
import httpx

MGMT_KEY = "hl_mgmt_your_key"
BASE = "http://localhost:8000"

headers = {"X-Management-Key": MGMT_KEY}

# Create a project
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

# Get analytics
r = httpx.get(
    f"{BASE}/projects/{project_id}/analytics",
    headers=headers,
)
print(r.json())

# Delete a tool with confirmation
r = httpx.delete(
    f"{BASE}/tools/{tool_id}?confirm=true",
    headers=headers,
)
print(r.json())
```

---

## Environment Variables Reference

```bash
# Management API Key (for dashboard authentication)
MANAGEMENT_API_KEY=hl_mgmt_secure_random_string_here

# Admin Account (created on first boot)
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@highlyagent.com
ADMIN_PASSWORD=your_secure_password_here

# AI Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
DEEPSEEK_API_KEY=...

# Provider Configuration
DEFAULT_PROVIDER=openai
FALLBACK_CHAIN=openai,claude,gemini,deepseek
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# JWT Configuration
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
JWT_SECRET_KEY=your_jwt_secret_here

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/highlyagent

# Redis
REDIS_URL=redis://localhost:6379/0
```

---

## Changelog

- **v1.0** — Initial complete API reference
- All endpoints documented with request/response examples
- Authentication, authorization, and error handling clarified
- Provider selection and fallback behavior documented
