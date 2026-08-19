# Local Setup

Run the HighLyAgent backend on your own machine (Windows / macOS / Linux).

## 1. Prerequisites

- Python **3.11+**
- PostgreSQL 16 with the **pgvector** extension (or use Docker — see [DOCKER_SETUP.md](DOCKER_SETUP.md))
- Redis 7

## 2. Create the environment

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## 3. Configure `.env`

```bash
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux
```

At minimum set:
- `DATABASE_URL` — e.g. `postgresql+asyncpg://highlyagent:password@localhost:5432/highlyagent`
- `REDIS_URL` — e.g. `redis://localhost:6379/0`
- `JWT_SECRET_KEY` — a long random string
- Provider keys for the models you plan to use (`OPENAI_API_KEY`, `GEMINI_API_KEY`, …)

Nothing is auto-configured — the fallback chain (`FALLBACK_CHAIN`) and every
provider must be set manually.

## 4. Create the schema

```bash
alembic upgrade head
```

This installs the pgvector extension and all tables (see [DATABASE_SETUP.md](DATABASE_SETUP.md)).

## 5. Start the API

```bash
python main.py
```

- API: `http://localhost:8000`
- Health: `http://localhost:8000/health`
- Interactive docs (non-production): `http://localhost:8000/docs`

## 6. Create the first admin

```bash
curl -X POST http://localhost:8000/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"you@example.com","password":"strong-password-123"}'
```

## 7. Optional: Celery worker (workflows / background tasks)

```bash
celery -A runtime.celery_app worker --loglevel=info
```

## Tests & lint

```bash
pytest tests -q
ruff check src tests main.py
```
