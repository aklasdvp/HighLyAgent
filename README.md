# HighLyAgent

HighLyAgent হলো একটি **FastAPI-based AI middleware platform**। এটি কোনো website, mobile app, desktop app বা IoT client-এর জন্য একটি secure AI backend প্রদান করে।

## এটি কী কাজ করে

- Admin dashboard/API থেকে নতুন project তৈরি ও project-specific API key issue করে।
- Client message গ্রহণ করে এবং প্রতিটি request-এর জন্য **Project ID + API Key** মিলিয়ে access যাচাই করে।
- আগে project-এর knowledge base-এ semantic search করে; match পেলে cached/learned response দেয়।
- Knowledge match না পেলে configured AI provider chain (OpenAI, Claude, Gemini, DeepSeek) ব্যবহার করে উত্তর তৈরি করে।
- Token usage, cost, cache hit ও user quota track করে।
- WebSocket-এর মাধ্যমে chat progress, answer, cancellation এবং client-tool request real time-এ পাঠায়।
- PostgreSQL + pgvector-এ durable data/embeddings, Redis-এ short-term cache ও Celery queue ব্যবহার করে।

## Request flow

```text
Client App
  → POST /agent/process  অথবা  WebSocket /ws
  → Project ID + API Key/JWT validation
  → Redis + pgvector knowledge search
  → knowledge response অথবা AI provider fallback
  → usage/audit data save
  → JSON response বা real-time WebSocket frame
```

## Security model

Client request-এর জন্য `X-Client-Id` এবং `X-API-Key` দুটিই লাগে। API key অবশ্যই ওই Project ID-এর সঙ্গে যুক্ত হতে হবে; mismatch হলে request reject হয়। Admin endpoints JWT bearer token ও role permission দিয়ে সুরক্ষিত।

## Technology

- **API:** FastAPI / Python 3.11
- **Database:** PostgreSQL 16 + pgvector
- **Cache & queue:** Redis + Celery
- **ORM:** SQLAlchemy async
- **Migration:** Alembic
- **Deployment:** Docker Compose

## Quick start

```bash
python3 -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# .env-এ database, Redis, JWT secret ও provider key configure করুন
alembic upgrade head
python3 main.py
```

API: `http://localhost:8000`  
Health check: `http://localhost:8000/health`  
Development API docs: `http://localhost:8000/docs`

## Documentation

- [Local setup](DOCS/LOCAL_SETUP.md)
- [Database setup](DOCS/DATABASE_SETUP.md)
- [Docker setup](DOCS/DOCKER_SETUP.md)
- [Deployment guide](DOCS/DEPLOYMENT_GUIDE.md)
- [API reference](DOCS/API_REFERENCE.md)
- [Project structure](DOCS/PROJECT_STRUCTURE.md)

## Project layout

All application modules are directly inside `src/`; root `main.py` is the executable entry point. See [PROJECT_STRUCTURE.md](DOCS/PROJECT_STRUCTURE.md) for the full layout.
