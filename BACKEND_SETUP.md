# Backend Setup

## Python environment

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Set `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET_KEY` in `.env`. For a local non-Docker database, use `localhost` rather than the Compose service name `db`.

## Docker Compose

Set `DB_PASSWORD` in the environment, copy `backend/.env.example` to `backend/.env`, then run:

```bash
docker compose up -d --build
docker compose ps
```

The stack starts PostgreSQL 16 + pgvector, Redis, FastAPI, Celery worker, and Celery beat.

## Database / migrations

The existing service uses SQLAlchemy models and initializes pgvector with `backend/migrations/init.sql`. No Alembic revision history is present in this repository, so do **not** claim Alembic migrations have run. Add and review a versioned Alembic baseline before using `alembic upgrade head` in production. See [DATABASE_GUIDE.md](DATABASE_GUIDE.md).

## Checks

```bash
ruff check backend/app backend/tests
pytest backend/tests -q
```
