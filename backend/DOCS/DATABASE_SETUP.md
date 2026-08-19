# Database Setup

HighLyAgent uses **PostgreSQL 16 + pgvector**. The easiest path is Docker
(see [DOCKER_SETUP.md](DOCKER_SETUP.md)) — the `pgvector/pgvector:pg16` image
already includes the extension.

## Schema

Everything is managed by **Alembic**. After configuring `DATABASE_URL` in `.env`:

```bash
alembic upgrade head
```

The initial migration (`migrations/versions/0001_initial.py`) creates:

| Table | Purpose |
|---|---|
| `clients` | Projects (web / mobile / desktop / iot) + AI config |
| `api_keys` | Project-scoped keys — SHA-256 hash only, raw never stored |
| `knowledge_entries` | Self-learning KB with `embedding vector(1536)` + HNSW cosine index |
| `users` | Per-client end-users + token/quota ledger |
| `conversations` / `messages` | Long-term memory |
| `tools` / `workflows` | Tool registry + multi-step workflows |
| `audit_logs` | Append-only audit trail |
| `admin_users` / `sessions` | Dashboard login + refresh-token registry |

It also runs `CREATE EXTENSION IF NOT EXISTS vector`.

## Manual (non-Docker) PostgreSQL

If you run PostgreSQL yourself:

```bash
# install pgvector (Debian/Ubuntu)
sudo apt install postgresql-16-pgvector

# create the database
createdb highlyagent
```

Then set `DATABASE_URL` in `.env` and run `alembic upgrade head`.

## Notes

- The knowledge engine uses **cosine distance** with an HNSW index for fast
  similarity search.
- `VECTOR_DIM` (default 1536) must match your embedding model
  (`text-embedding-3-small`). If you swap models, update `VECTOR_DIM` and run a
  reindex.
- Redis is used separately for short-term memory, the knowledge hot-cache and as
  the Celery broker.
