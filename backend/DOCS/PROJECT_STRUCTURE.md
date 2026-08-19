# Project Structure

All application modules are **flat inside `src/`** (no package nesting). The root
`main.py` adds `src/` to `sys.path` and imports the app from `application.py`.

```
HighLyAgent/
├── main.py                  # entry point — adds src/ to sys.path, exposes `app`
├── alembic.ini              # Alembic config (script_location = migrations)
├── requirements.txt
├── ruff.toml                # pinned lint rules
├── docker-compose.yml       # db + redis + api + worker + beat
├── .env.example
├── docker/
│   └── Dockerfile           # API image (non-root, PYTHONPATH=/app/src)
├── migrations/
│   ├── env.py               # async Alembic env (reads DATABASE_URL)
│   └── versions/
│       └── 0001_initial.py  # full schema incl. pgvector index
├── src/
│   ├── application.py       # FastAPI app assembly (CORS, limiter, routers, /, /health)
│   ├── core.py              # Settings, async DB, Redis, bcrypt, JWT, RBAC
│   ├── models.py            # SQLAlchemy models (clients, keys, knowledge, users…)
│   ├── schemas.py           # Pydantic request/response contracts
│   ├── routes.py            # REST API — auth, projects, agent/process (security layer)
│   ├── gateway.py           # WebSocket gateway (progress, cancel, client-tools)
│   ├── agent.py             # Agent Core — self-learning pipeline
│   ├── knowledge.py         # Knowledge Engine (pgvector + Redis cache + learn)
│   ├── providers.py         # AI Provider Layer (OpenAI/Gemini/Claude/DeepSeek + fallback)
│   ├── runtime.py           # Memory Manager + Workflow Engine + Celery app
│   └── tools.py             # Tool registry + JSON-Schema validation + executors
└── tests/
    └── test_unit.py         # pure-logic unit tests (no DB/Redis/network)
```

## Import convention

Because `main.py` (and the Docker image via `PYTHONPATH=/app/src`) puts `src/` on
`sys.path`, modules import each other as **top-level** names:

```python
from core import settings          # not  from app.core import settings
from models import Client
from routes import router
```

## Entry points

| Run | Command |
|---|---|
| API | `python main.py` (uvicorn on :8000) |
| Celery worker | `celery -A runtime.celery_app worker` |
| Celery beat | `celery -A runtime.celery_app beat` |
| Migrations | `alembic upgrade head` |
| Lint | `ruff check src tests main.py` |
| Test | `pytest tests -q` |
