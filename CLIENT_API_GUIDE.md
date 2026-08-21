# HighLyAgent — Client API Guide

This guide is for **client projects** (websites, mobile apps, desktop apps, and
IoT devices) that consume the AI backend. Every client request must present the
project's **Project ID** and its **Project API Key** together.

## Base URL

```text
http://localhost:8000
```

## Authentication — Project ID + API Key

- **`X-Client-Id`** — the project UUID returned when the project was created.
- **`X-API-Key`** — the `hl_live_...` key issued when the project was created
  (or regenerated via `POST /projects/{project_id}/keys/rotate`).

Both headers are **required and must match** the same project:

- Missing either header → `401 INVALID_KEY`
- Unknown or revoked key → `401 INVALID_KEY`
- Key does not belong to the stated project → `403 ACCESS_DENIED`
- Project suspended → `403 SUSPENDED`

> A project API key only grants access to **that project's** endpoints. It can
> never be used to call management endpoints.

## Endpoints overview

| Method   | Path             | Description                        |
|----------|------------------|------------------------------------|
| POST     | `/agent/process` | Process a user message (REST)      |
| WS       | `/ws`            | Real-time chat / progress / tools  |
| GET      | `/health`        | Liveness probe                     |

## POST /agent/process

Process a single user message and get an answer. The answer may come from the
**knowledge base** (`source: "knowledge"`, 0 tokens) or from an **AI provider**
(`source: "ai"`).

### Request

```bash
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: <PROJECT_ID>" \
  -H "X-API-Key: <PROJECT_API_KEY>" \
  -d '{
    "user_ref": "user-123",
    "text": "How long does delivery take?",
    "conversation_id": null
  }'
```

Body fields:

| Field           | Type   | Required | Description                              |
|-----------------|--------|----------|------------------------------------------|
| `user_ref`      | string | no       | Your user id (drives quotas), default `anonymous` |
| `text`          | string | yes      | The user message (1–4000 chars)          |
| `conversation_id` | string/UUID | no | Optional conversation continuity id     |

### Response

Responses use the standard envelope: `success` / `data` / `message` /
`timestamp`. The agent output is inside `data`:

```json
{
  "success": true,
  "data": {
    "task_id": "b7f0…",
    "text": "Standard delivery takes 3-5 business days across Bangladesh.",
    "source": "knowledge",
    "similarity": 0.87,
    "tools": [],
    "tokens": 0,
    "cost_usd": 0.0,
    "latency_ms": 42
  },
  "message": "ok",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

`data` fields:

| Field        | Description                                      |
|--------------|--------------------------------------------------|
| `source`     | `"knowledge"` (cached) or `"ai"` (generated)     |
| `similarity` | Knowledge-base cosine similarity (0–1)           |
| `tools`      | Tool calls replayed with the cached answer       |
| `tokens`     | Tokens billed to the user quota                  |
| `cost_usd`   | Estimated provider cost for this request         |

Errors also use the envelope and add `error_code` + `detail`:

```json
{
  "success": false,
  "data": null,
  "message": "daily request limit reached",
  "error_code": "LIMIT_EXCEEDED",
  "detail": "daily request limit reached",
  "timestamp": "2026-08-21T04:31:41+00:00"
}
```

> WebSocket `/ws` frames are **not** wrapped in the envelope — they keep the
> `{type, task_id, ...}` protocol described below.

## WebSocket /ws

The WebSocket gateway streams **progress**, **answers**, **errors**, **client
tool requests**, and **cancellation** in real time.

### Connecting

```text
ws://localhost:8000/ws?client_id=<PROJECT_ID>&api_key=<PROJECT_API_KEY>
```

Example with `websockets`:

```python
import asyncio
import json
import websockets

async def main():
    uri = "ws://localhost:8000/ws?client_id=<PROJECT_ID>&api_key=<PROJECT_API_KEY>"
    async with websockets.connect(uri) as ws:
        hello = json.loads(await ws.recv())
        print("hello:", hello)

        # send a chat message
        await ws.send(json.dumps({
            "type": "chat",
            "task_id": None,
            "text": "What is the refund policy?",
        }))

        # read frames until we get the answer or an error
        while True:
            frame = json.loads(await ws.recv())
            print(frame)
            if frame.get("type") in ("answer", "error", "cancelled"):
                break

asyncio.run(main())
```

### Frames the server sends

| Type         | Payload                                             |
|--------------|-----------------------------------------------------|
| `hello`      | `{conn_id, auth}` — connection accepted             |
| `ping`       | `{ts}` — heartbeat (send `pong` back)               |
| `progress`   | `{task_id, stage, pct, detail}` — pipeline stage    |
| `answer`     | `{task_id, text, source, tokens, cost_usd, latency_ms, similarity, tools}` |
| `tool_request` | `{task_id, tool_name, args}` — client tool call   |
| `error`      | `{task_id, code, message}`                          |
| `cancelled`  | `{task_id}` — task cancelled                        |

Progress `stage` values: `sanitize`, `quota`, `intent`, `memory`,
`vector_search`, `tool`, `provider`, `learn`, `respond`.

### Frames the client sends

| Type         | Purpose                                               |
|--------------|-------------------------------------------------------|
| `chat`       | Start a task: `{type:"chat", text:"…"}`               |
| `cancel`     | Cancel a task: `{type:"cancel", task_id:"…"}`         |
| `tool_result`| Reply to a `tool_request`: `{type:"tool_result", task_id, tool_name, payload}` |
| `pong`       | Reply to heartbeat `ping`                             |

### Client tool example

If the agent calls a **client tool** (`orders.lookup`), the server sends:

```json
{"type": "tool_request", "task_id": "t1", "tool_name": "orders.lookup", "args": {"order_id": "ORD-99"}}
```

Your app performs the lookup and replies:

```json
{"type": "tool_result", "task_id": "t1", "tool_name": "orders.lookup", "payload": {"status": "shipped", "eta_days": 2}}
```

The agent then continues with the tool result.

## Examples

### cURL

```bash
curl -X POST http://localhost:8000/agent/process \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: <PROJECT_ID>" \
  -H "X-API-Key: <PROJECT_API_KEY>" \
  -d '{"user_ref": "user-123", "text": "Convert 250 usd to bdt"}'
```

### Python (httpx)

```python
import httpx

client_id = "<PROJECT_ID>"
api_key = "<PROJECT_API_KEY>"

resp = httpx.post(
    "http://localhost:8000/agent/process",
    headers={"X-Client-Id": client_id, "X-API-Key": api_key},
    json={"user_ref": "user-123", "text": "What is the refund policy?"},
)
print(resp.json())
```

### JavaScript (fetch)

```js
const res = await fetch("http://localhost:8000/agent/process", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Client-Id": "<PROJECT_ID>",
    "X-API-Key": "<PROJECT_API_KEY>",
  },
  body: JSON.stringify({
    user_ref: "user-123",
    text: "How long does delivery take?",
  }),
});
const data = await res.json();
console.log(data);
```

## Error codes

| HTTP/WS | Code            | Meaning                                          |
|---------|-----------------|--------------------------------------------------|
| 401     | `INVALID_KEY`   | Missing header, unknown key, or revoked key      |
| 403     | `ACCESS_DENIED` | Key does not belong to this project              |
| 403     | `SUSPENDED`     | Project is suspended by an admin                 |
| 402     | `LIMIT_EXCEEDED`| User reached a project limit (requests or tokens, daily or monthly) |
| 400     | `BAD_REQUEST`   | WebSocket missing `client_id` with API key       |
| 4403    | —               | WebSocket close: auth failure / mismatch         |
| 4400    | —               | WebSocket close: bad request                     |
| WS      | `INTERNAL`      | Internal error frame on `/ws`                    |

## Project behavior

Each project may define a **`behavior_description`** (set at creation or via
`PATCH /projects/{project_id}`). HighLyAgent injects it into the AI's system
prompt, e.g.:

> "This project is an e-commerce website. Give helpful, concise answers about
> products, orders, refunds and shipping."

This steers every generated answer so it fits your product.
