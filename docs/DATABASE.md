# HighLyAgent — Database Schema (PostgreSQL 16 + pgvector)

Conventions: UUIDv7 PKs, `created_at`/`updated_at` timestamptz, soft-delete only where noted,
append-only audit. Vector index: HNSW cosine on `knowledge_entries.embedding`.

## admin_users — dashboard login
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| username | citext UNIQUE | login identifier #1 |
| email | citext UNIQUE | login identifier #2 |
| password_hash | text | bcrypt (cost 12) |
| role | text | `admin` (RBAC extensible) |
| created_at | timestamptz | |

## sessions — refresh tokens
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| admin_id | uuid FK→admin_users | |
| refresh_hash | text UNIQUE | SHA-256 of refresh JWT (raw never stored) |
| expires_at | timestamptz | default +7 days |
| revoked_at | timestamptz NULL | logout / rotation |

## clients (projects)
| column | type | notes |
|---|---|---|
| id | uuid PK | == `X-Client-Id` header value |
| name | text | |
| platform | text CHECK | web / mobile / desktop / iot |
| allowed_origins | text[] | CORS allowlist per project |
| rate_limit_per_min | int | default 60 |
| ai_provider | text NULL | manual choice, NULL until configured |
| ai_model | text NULL | |
| temperature | numeric(3,2) | |
| max_tokens | int | |
| system_prompt | text | per-project instruction |
| webhook_url | text NULL | client-tool callback |
| suspended | bool | hard block, 403 on ingest |
| created_at | timestamptz | |

## api_keys — project-scoped, hash-only storage
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK→clients | **binding verified on every call** |
| key_hash | text UNIQUE | SHA-256(`hl_live_…`) |
| last4 | char(4) | display only |
| label | text | e.g. "production" |
| created_at / last_used_at / revoked_at | timestamptz | raw key shown exactly once |

## knowledge_entries — the self-learning core
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK→clients | scoped per project |
| category / language | text | |
| trigger_text | text | normalized question |
| response_text | text | cached answer |
| tool_calls | jsonb | tools that produced it |
| embedding | **vector(1536)** | `text-embedding-3-small` |
| hit_count | int | cache-hit counter |
| learned | bool | AI-learned vs manual/training |
| active | bool | |
| index | `USING hnsw (embedding vector_cosine_ops)` | |

## conversations / messages — long-term memory
`conversations(id, client_id FK, user_id FK, summary text, created_at)`
`messages(id, conversation_id FK, role, content, tokens int, created_at)` — idx (conversation_id, created_at)

## tools / tool_invocations
`tools(id, name UNIQUE, description, type server|client, schema jsonb, enabled bool)`
`tool_invocations(id, tool_id FK, client_id FK, args jsonb, result jsonb, ok bool, ms int, created_at)`

## users — multi-user per client + token ledger
| column | type | notes |
|---|---|---|
| id / client_id FK | | thousands per client |
| external_ref | text | id in the client's own system |
| plan | text | free / trial / unlimited |
| daily_used / monthly_used | int | tokens |
| daily_limit / monthly_limit | int | 0 = plan default |
| status | text | active / blocked (LIMIT_EXCEEDED) |

## workflows / workflow_runs
`workflows(id, client_id FK, name, trigger text, steps jsonb, active bool)`
`workflow_runs(id, workflow_id FK, status running|done|cancelled|failed, progress int, result jsonb, started_at, finished_at)`

## audit_logs — append-only, no UPDATE/DELETE grants
`(id, ts, actor, action, detail, ip)` — idx (ts DESC)

## Redis key plan
`stm:{conv}:{user}` list (40 turns, TTL 30 min) · `kb:{client}:{sha16}` hot-cache (TTL 5 min) ·
`rl:{client}:{user}:{minute}` rate counter · Celery broker db=1
