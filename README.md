# HighLyAgent — Workspace

HighLyAgent হলো একটি **Universal AI Middleware Platform**। এই workspace-এ দুইটি
আলাদা অংশ আছে, যাদের প্রতিটি নিজ নিজ GitHub repository-তে থাকে:

| Folder | Repository | কী | কোথায় চলে |
|---|---|---|---|
| `backend/` | Backend repo | FastAPI + PostgreSQL(pgvector) + Redis + Celery | **Server** (VPS/DigitalOcean, Docker) |
| `frontend/` | Frontend repo | React + Tailwind Admin Dashboard | **Local machine** (PM2 / Electron / systemd) |

দুইটি আলাদা repository — কিন্তু একই API contract-এ বাঁধা, তাই একসাথে কাজ করে।

## Backend (`backend/`)

GitHub backend repo-র হুবহু mirror — **flat `src/` layout**, root `main.py`,
root-এ endpoints (কোনো `/api/v1` prefix নেই)।

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env            # configure করুন
alembic upgrade head
python main.py                  # → http://localhost:8000
```

বিস্তারিত: [`backend/README.md`](backend/README.md) ও [`backend/DOCS/`](backend/DOCS/)

### Client request-এ dual-factor security

```
POST /agent/process
X-Client-Id: <project-id>      ← দুটোই লাগবে
X-API-Key:   hl_live_...       ← mismatch হলে 403 ACCESS_DENIED
```

## Frontend (`frontend/`)

Admin Dashboard — শুধু আপনার লোকাল মেশিনে চলে, কখনো public deploy হয় না।
এটি আলাদা repo হিসেবে push করতে `frontend/README.md` দেখুন।

```bash
cd frontend
npm install
npm run build && npm run serve  # → http://127.0.0.1:8090
```

Backend-এর সাথে সংযোগ `.env`-এ (`VITE_API_URL`, `VITE_WS_URL`)।

## গুরুত্বপূর্ণ নোট

- এই workspace-এর root-এ React source (`src/`, `package.json`, `vite.config.js`)
  আছে শুধুমাত্র একটি **live demo build** serve করার জন্য। Frontend-এর canonical
  home হলো আলাদা `frontend/` repository।
- Backend-এর canonical home হলো আপনার GitHub backend repo; `backend/` folder
  সেটির mirror।
