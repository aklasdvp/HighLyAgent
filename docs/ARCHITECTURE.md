# HighLyAgent — Architecture Design

## Topology

```
┌─────────────────────────────────┐                ┌──────────────────────────────────────────────┐
│ LOCAL MACHINE (admin only)      │   HTTPS / WSS  │ VPS — DigitalOcean                           │
│                                 │ ─────────────► │ docker compose · restart: always             │
│  React Admin Dashboard          │  Authorization:│ ┌──────────────────────────────────────────┐ │
│  served at 127.0.0.1:8090       │  Bearer <JWT>  │ │ FastAPI (uvicorn, 2 workers)               │ │
│  run by: PM2 / systemd /        │  (NO API key   │ │  ├─ /api/v1/*        Admin REST (RBAC)     │ │
│          Electron               │   required)    │ │  ├─ /api/agent/process  client ingest      │ │
│  NEVER deployed publicly        │                │ │  └─ /ws                realtime gateway    │ │
└─────────────────────────────────┘                │ ├─ PostgreSQL 16 + pgvector (long-term KB)   │ │
                                                   │ ├─ Redis 7 (short-term memory, KB hot-cache, │
  Client apps (Web/Mobile/Desktop/IoT) ────────────► │ │           Celery broker)                   │ │
  POST /api/agent/process                          │ └─ Celery worker + beat (workflows)          │ │
  headers: X-Client-Id + X-API-Key  (BOTH)         └──────────────────────────────────────────────┘
  mismatch → 403 ACCESS_DENIED
```

## Repository layout (separate, but contractually coupled)

```
highlyagent/
├── backend/                ← server repo (deployed to VPS)
│   ├── app/                FastAPI application
│   │   ├── main.py         entrypoint, CORS, rate limits, lifespan
│   │   ├── core.py         settings, async DB, JWT, bcrypt, RBAC, client-scope guard
│   │   ├── models.py       SQLAlchemy + pgvector models
│   │   ├── schemas.py      Pydantic contracts (shared with frontend)
│   │   ├── routes.py       REST API v1 + admin auth (setup/login/refresh)
│   │   ├── gateway.py      WebSocket gateway (progress, cancel, client tools)
│   │   ├── agent.py        agent core: intent → knowledge → tools → provider → learn
│   │   ├── knowledge.py    pgvector search + Redis cache + knowledge saver
│   │   ├── providers.py    OpenAI / Gemini / Claude / DeepSeek (manual fallback chain)
│   │   ├── tools.py        registry + JSON-Schema validation + executor
│   │   └── runtime.py      memory manager + workflow engine + Celery
│   ├── Dockerfile          non-root, healthchecked
│   └── requirements.txt
├── src/                    ← frontend repo (React admin dashboard, LOCAL ONLY)
├── desktop/                Electron wrapper (optional)
├── scripts/serve-dist.mjs  local static server for the built dashboard
├── ecosystem.config.cjs    PM2 auto-start
├── deploy/                 systemd unit, k8s manifests, nginx
├── docker-compose.yml      full server stack (auto-restart)
└── docs/                   ARCHITECTURE · DATABASE · API · UI_FLOW
```

## Core principles

1. **Separation** — the dashboard never runs on the server; the agent never runs on the laptop.
   They speak one contract (`schemas.py` / TypeScript mirrors in `src/lib/data.ts`).
2. **Two auth planes**
   - Admin plane: username/email + password → JWT access (30 min) + refresh (7 days).
     Session timeout enforced client-side (auto-refresh) and server-side (exp claim).
   - Client plane: `X-Client-Id` + `X-API-Key`. Keys are stored as SHA-256 hashes only;
     the raw key is shown exactly once. Project-id ↔ key binding is verified on every call.
3. **Zero auto-configuration** — first boot shows the admin *setup* screen; providers stay
   disabled until a key is pasted manually; no default project is ever created.
4. **Self-learning loop** — knowledge-first lookup (pgvector cosine ≥ 0.40) before any
   provider call; every novel answered query is embedded and saved → 70–80% token savings.
5. **Always-on server** — every compose service uses `restart: unless-stopped/always`,
   healthchecks gate the boot order (db → redis → api → worker).

## Request lifecycle — `POST /api/agent/process`

```
1. Guard        verify X-Client-Id + X-API-Key pair (403 on mismatch, 429 on rate limit)
2. Sanitize     length cap, control-char strip, prompt-injection heuristics
3. Quota        user plan daily/monthly token ledger (402 LIMIT_EXCEEDED)
4. Intent       keyword/regex classifier + tool-arg extraction
5. Memory       short-term turns from Redis appended to prompt context
6. Knowledge    pgvector cosine search → HIT? return cached answer (0 tokens)
7. Tools        execute server tools; dispatch client tools over WebSocket
8. Provider     manual fallback chain: openai → claude → gemini → deepseek
9. Learn        embed(trigger) + store answer → next similar query is a cache hit
10. Audit       append-only log (actor, action, ip) + usage ledger update
```

## WebSocket protocol (gateway)

```
→ {type:"chat", text}                       start task
→ {type:"cancel", task_id}                  cancel running task
→ {type:"tool_result", task_id, …}          answer a client-tool request
← {type:"progress", task_id, stage, pct}    auth→intent→vector_search→tool→provider→learn
← {type:"answer", task_id, text, source, tokens, cost_usd, latency_ms}
← {type:"tool_request", task_id, tool_name, args}
← {type:"error", code, message}             LIMIT_EXCEEDED | ACCESS_DENIED | INTERNAL
```
