# API Reference

Base URL is the FastAPI host; current default prefix is `/api/v1`.

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/` | none | service metadata |
| GET | `/health` | none | liveness |
| POST | `/api/v1/auth/setup` | none | create the first admin; only succeeds once |
| POST | `/api/v1/auth/login` | none | JWT access/refresh pair |
| POST | `/api/v1/auth/refresh` | none | rotate refresh token |
| GET | `/api/v1/auth/me` | Bearer JWT | current token subject/role |
| GET, POST | `/api/v1/projects` | Bearer JWT | list/create project |
| PATCH, DELETE | `/api/v1/projects/{project_id}` | Bearer JWT | update/delete project |
| POST | `/api/v1/projects/{project_id}/keys/rotate` | Bearer JWT | rotate project API key |
| GET, POST | `/api/v1/projects/{project_id}/knowledge` | Bearer JWT | list/add knowledge |
| GET | `/api/v1/tools` | Bearer JWT | list registered tools |
| GET | `/api/v1/projects/{project_id}/users` | Bearer JWT | list project users |
| GET | `/api/v1/system/health` | Bearer JWT | database/Redis/provider state |
| POST | `/api/v1/agent/process` | X-Client-Id + X-API-Key | process client request |

## Client request

```http
POST /api/v1/agent/process
X-Client-Id: <project UUID>
X-API-Key: <project-scoped key>
Content-Type: application/json

{"user_ref":"user-1","text":"Hello","conversation_id":null}
```

Both headers are required and must belong to the same project.

## WebSocket

Connect to `/ws?token=<JWT-or-api-key>&client_id=<optional-project-UUID>`. Frames include `chat`, `cancel`, `tool_result`, and `pong`; server frames include `hello`, `ping`, `progress`, `answer`, `cancelled`, and `error`. A mismatched API key/project pair closes with code 4403.
