# HighLyAgent Backend

FastAPI backend for HighLyAgent: REST admin API, WebSocket gateway, PostgreSQL/pgvector knowledge store, Redis cache, and Celery workers.

## Quick start

```bash
cp backend/.env.example backend/.env
# Set real secrets and provider keys in backend/.env
$env:DB_PASSWORD = "replace-me" # PowerShell
docker compose up -d --build
```

API health: `http://localhost:8000/health`. Interactive OpenAPI docs are available at `/docs` outside production.

See [BACKEND_SETUP.md](BACKEND_SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md), [DATABASE_GUIDE.md](DATABASE_GUIDE.md), and [API_REFERENCE.md](API_REFERENCE.md).
