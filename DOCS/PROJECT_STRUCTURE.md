# Project Structure

```text
main.py                   # executable entry point
src/                      # all application modules
  application.py          # FastAPI application
  core.py                 # settings, database, Redis, auth/RBAC
  routes.py               # REST endpoints
  gateway.py              # WebSocket gateway
  models.py, schemas.py   # persistence and API contracts
  agent.py, knowledge.py  # agent and vector knowledge logic
  providers.py, tools.py  # AI providers and tool registry
  runtime.py              # Celery/runtime services
tests/                    # unit tests
migrations/               # Alembic environment and revisions
docker/                   # container and database bootstrap assets
DOCS/                     # setup, deployment, API, and structure guides
```

Add new application modules directly under `src/`, with clearly named responsibility and matching tests in `tests/`.