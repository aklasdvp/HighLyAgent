# HighLyAgent — PROJECT_OVERVIEW

## What is HighLyAgent?

**HighLyAgent** is a **FastAPI-based AI middleware platform**. It acts as a
secure, self-learning AI backend for any client — a **website, mobile app,
desktop app, or IoT device**. Instead of wiring each client directly to an AI
provider, clients talk to HighLyAgent, which handles authentication, knowledge
retrieval, AI provider routing, cost tracking, and learning — behind a single,
simple API.

## How it works

Every client request is validated with a **Project ID + API Key** pair. The
platform then:

1. **Sanitizes** the input and checks the user's token quota.
2. **Searches the knowledge base** (pgvector semantic search, backed by a Redis
   hot-cache).
   - On a **match**, it returns the cached/learned answer immediately — **zero
     AI provider tokens spent**.
   - On a **miss**, it plans and executes **tools** (e.g. weather, math,
     currency) if applicable, then calls the configured **AI provider chain**
     (OpenAI → Claude → Gemini → DeepSeek) with automatic fallback.
3. **Auto-learns**: the freshly generated answer is embedded and stored in the
   knowledge base, so the *next similar question is free* (70–80% cost
   reduction on repeat topics).
4. **Tracks** token usage, cost, cache hits, and per-user quota.
5. **Streams** progress, answers, cancellation, and client-tool requests in
   real time over WebSocket.

## Request flow

```text
Client App
  → POST /agent/process  or  WebSocket /ws
  → Project ID + API Key / Management Key / JWT validation
  → Redis + pgvector knowledge search
  → knowledge response (0 tokens)  or  AI provider fallback chain
  → usage / audit data saved
  → JSON response  or  real-time WebSocket frame
```

## Architecture overview

```text
                        ┌──────────────────────────┐
                        │  Admin Dashboard / API    │  X-Management-Key or JWT
                        └────────────┬─────────────┘
                                     │ management endpoints
                                     ▼
   ┌──────────────────  FastAPI Application  ──────────────────┐
   │  routes.py (REST)          gateway.py (WebSocket /ws)      │
   │  api_key_manager.py (two-layer key auth)                   │
   │  agent.py (pipeline)       knowledge.py (pgvector + Redis) │
   │  providers.py (fallback)   tools.py (server/client tools)  │
   │  runtime.py (memory/Celery) core.py (settings/auth/RBAC)   │
   └───────────────┬─────────────────────────┬─────────────────┘
                   ▼                         ▼
        PostgreSQL 16 + pgvector      Redis (cache + Celery broker)
```

- **PostgreSQL 16 + pgvector** — durable data and embeddings.
- **Redis** — short-term memory, knowledge hot-cache, Celery broker/backend.
- **Celery** — background task/queue infrastructure.
- **SQLAlchemy async + Alembic** — ORM and schema migrations.

## Key features

- **Two-layer API key system** — a static `MANAGEMENT_API_KEY` for the admin
  dashboard and auto-generated, per-project keys for clients (see
  [MANAGEMENT_API_GUIDE.md](MANAGEMENT_API_GUIDE.md) and
  [CLIENT_API_GUIDE.md](CLIENT_API_GUIDE.md)).
- **Project behavior configuration** — each project carries a
  `behavior_description` that steers how the AI answers (e.g. "This is an
  e-commerce website — be helpful with product questions").
- **Self-learning knowledge base** — semantic search with auto-learn, Redis
  hot-cache, and re-indexing.
- **Multi-provider fallback chain** — OpenAI, Claude, Gemini, DeepSeek with a
  per-model cost table.
- **Tool system** — server-side tools (weather, math, currency, time) and
  client-side tools dispatched over WebSocket, validated with JSON Schema.
- **Real-time WebSocket gateway** — progress frames, cancellation, ping/pong
  heartbeat, and client-tool round trips.
- **Security** — dual-factor client auth (project id + key must match), API
  keys stored as SHA-256 hashes (shown once), bcrypt passwords, JWT with
  refresh-token rotation, RBAC roles, rate limiting, and production-safe docs.
- **Usage & cost tracking** — per-user token quotas, cache-hit counters, audit
  logs, and a cost table.

## Technology stack

| Layer            | Technology                                    |
|------------------|-----------------------------------------------|
| API framework    | FastAPI, uvicorn, pydantic v2                 |
| Language         | Python 3.11                                   |
| Database         | PostgreSQL 16 + pgvector                      |
| ORM / migrations | SQLAlchemy 2.0 (async), Alembic               |
| Cache / queue    | Redis, Celery                                 |
| Auth / security  | python-jose (JWT), passlib (bcrypt), slowapi  |
| AI providers     | openai, google-genai, anthropic SDKs          |
| Deployment       | Docker Compose (db, redis, api, worker, beat) |

## Documentation

- [MANAGEMENT_API_GUIDE.md](MANAGEMENT_API_GUIDE.md) — admin/management API.
- [CLIENT_API_GUIDE.md](CLIENT_API_GUIDE.md) — client-facing API and WebSocket.
- [README.md](README.md) — quick start and setup.
