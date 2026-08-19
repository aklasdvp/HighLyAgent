# Local Setup

## 1. Python environment

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

Requires Python 3.11+.

## 2. Configure `.env`

```bash
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux
```

Fill in at minimum:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET_KEY` — a long random string
- `OPENAI_API_KEY` (and any other provider keys you use)

> For local (non-Docker) services use `localhost`:
> `DATABASE_URL=postgresql+asyncpg://highlyagent:pass@localhost:5432/highlyagent`

## 3. Run migrations

```bash
alembic upgrade head
```

This creates all tables plus the pgvector extension and HNSW index.

## 4. Start the API

```bash
python main.py
```

- API: http://localhost:8000
- Health: http://localhost:8000/health
- Docs (dev only): http://localhost:8000/docs

## 5. First admin

Create the admin once (no auto-configuration ever happens):

```bash
curl -X POST http://localhost:8000/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"you@example.com","password":"strong-password-123"}'
```

## 6. Optional — Celery workers

```bash
celery -A runtime.celery_app worker --loglevel=info
celery -A runtime.celery_app beat --loglevel=info
```

## Lint & test

```bash
ruff check src tests main.py
pytest tests -q
```
