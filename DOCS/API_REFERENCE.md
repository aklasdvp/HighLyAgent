# API Reference

Base URL is the FastAPI host. API prefix: ``.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/`, `/health` | none | service metadata / liveness |
| POST | `/auth/setup` | none | create first admin |
| POST | `/auth/login`, `/auth/refresh` | none | issue/rotate JWT pair |
| GET | `/auth/me` | Bearer JWT | current admin identity |
| GET, POST | `/projects` | Bearer JWT | list/create projects |
| PATCH, DELETE | `/projects/{project_id}` | Bearer JWT | update/delete project |
| POST | `/projects/{project_id}/keys/rotate` | Bearer JWT | rotate API key |
| GET, POST | `/projects/{project_id}/knowledge` | Bearer JWT | list/add knowledge |
| GET | `/tools`, `/system/health` | Bearer JWT | tools / system state |
| POST | `/agent/process` | X-Client-Id + X-API-Key | client message |

Client body: `{"user_ref":"user-1","text":"Hello","conversation_id":null}`. The project ID and API key must belong together.

WebSocket: connect to `/ws?token=<JWT-or-api-key>&client_id=<optional-project-UUID>`. Client frames: `chat`, `cancel`, `tool_result`, `pong`; server frames: `hello`, `ping`, `progress`, `answer`, `cancelled`, `error`.