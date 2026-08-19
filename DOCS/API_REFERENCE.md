# API Reference

Base URL is the FastAPI host. API prefix: `/api/v1`.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/`, `/health` | none | service metadata / liveness |
| POST | `/api/v1/auth/setup` | none | create first admin |
| POST | `/api/v1/auth/login`, `/auth/refresh` | none | issue/rotate JWT pair |
| GET | `/api/v1/auth/me` | Bearer JWT | current admin identity |
| GET, POST | `/api/v1/projects` | Bearer JWT | list/create projects |
| PATCH, DELETE | `/api/v1/projects/{project_id}` | Bearer JWT | update/delete project |
| POST | `/api/v1/projects/{project_id}/keys/rotate` | Bearer JWT | rotate API key |
| GET, POST | `/api/v1/projects/{project_id}/knowledge` | Bearer JWT | list/add knowledge |
| GET | `/api/v1/tools`, `/api/v1/system/health` | Bearer JWT | tools / system state |
| POST | `/api/v1/agent/process` | X-Client-Id + X-API-Key | client message |

Client body: `{"user_ref":"user-1","text":"Hello","conversation_id":null}`. The project ID and API key must belong together.

WebSocket: connect to `/ws?token=<JWT-or-api-key>&client_id=<optional-project-UUID>`. Client frames: `chat`, `cancel`, `tool_result`, `pong`; server frames: `hello`, `ping`, `progress`, `answer`, `cancelled`, `error`.