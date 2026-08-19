# Docker Setup

`docker-compose.yml` runs the full stack: **db (pgvector) + redis + api + worker + beat**.

## 1. Configure

Create `.env` from `.env.example` and set at least:
- `JWT_SECRET_KEY`
- Your provider keys (`OPENAI_API_KEY`, etc.)

The compose file reads `DB_PASSWORD` from the environment:

```bash
export DB_PASSWORD="a-strong-password"      # macOS / Linux
# Windows PowerShell:  $env:DB_PASSWORD="a-strong-password"
```

## 2. Build & start

```bash
docker compose up -d --build
```

Services:
| Service | Port | Notes |
|---|---|---|
| `db` | 5432 | `pgvector/pgvector:pg16`, healthchecked |
| `redis` | 6379 | AOF persistence, healthchecked |
| `api` | 8000 | FastAPI via uvicorn (2 workers) |
| `worker` | — | Celery worker (`runtime.celery_app`) |
| `beat` | — | Celery beat scheduler |

Every service uses `restart: unless-stopped`, so the stack comes back after a
crash or a host reboot (always-on).

## 3. Run migrations

The API image includes `alembic.ini` + `migrations/`. Run once against the db
container:

```bash
docker compose exec api alembic upgrade head
```

## 4. Verify

```bash
curl http://localhost:8000/health
# {"status":"ok","version":"2.4.1"}
```

Dev docs are disabled when `ENVIRONMENT=production`; set it to `development` in
`.env` to enable `/docs`.

## 5. Common operations

```bash
docker compose logs -f api          # follow API logs
docker compose ps                   # service status
docker compose down                 # stop (keeps volumes)
docker compose down -v              # stop + wipe data
```

## Image details (`docker/Dockerfile`)

- Based on `python:3.11-slim`, non-root user.
- Copies `src/`, `main.py`, `alembic.ini`, `migrations/`.
- Sets `PYTHONPATH=/app/src` so the flat modules import cleanly.
- Built-in `HEALTHCHECK` hits `/health`.
