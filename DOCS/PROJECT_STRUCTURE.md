# Project Structure

```text
main.py                   # thin executable entry point
src/highlyagent/          # application package
  main.py                 # FastAPI application factory/module
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

Add new features inside `src/highlyagent`, keep HTTP handlers in `routes.py` or a clearly named future router module, and add matching tests under `tests/`.