# HighLyAgent — Admin Control Center (Frontend)

Local-only React dashboard for the **HighLyAgent Universal AI Middleware**.
It runs on **your machine** (never on a public server) and manages the backend —
projects, AI providers, API keys, knowledge/training, tools, users, logs and the
real-time WebSocket gateway — that runs on your VPS via Docker Compose.

```
┌──────────────────────────┐        HTTPS / WSS        ┌──────────────────────────┐
│  THIS REPO (local)       │ ────────────────────────► │  backend repo (VPS)      │
│  127.0.0.1:8090          │   Admin JWT (no API key)  │  docker compose · always │
│  PM2 / systemd / Electron│                           │  FastAPI + pgvector +    │
│  VITE_API_URL → backend  │                           │  Redis + Celery          │
└──────────────────────────┘                           └──────────────────────────┘
```

> দুইটি আলাদা repository — কিন্তু একই API contract (`/auth/*`, `/projects`, `/agent/process`, `/ws`)।
> Admin dashboard লগইন করে **JWT** দিয়ে; ক্লায়েন্ট অ্যাপ কল করে **X-Client-Id + X-API-Key** দিয়ে।

---

## 1 · Repo structure

```
frontend/
├── .env                     ← backend connection (API_URL, WS_URL, SIMULATED)
├── .env.example
├── ecosystem.config.cjs     ← PM2 auto-start
├── desktop/                 ← Electron wrapper (main.cjs + preload.cjs)
├── deploy/                  ← systemd unit (Linux auto-start)
├── scripts/
│   ├── serve-dist.mjs       ← zero-dependency local server (loopback only)
│   └── sync-src.mjs         ← one-time pull of src/ from the monorepo workspace
└── src/                     ← full application (React + Tailwind v4)
    ├── App.tsx  main.tsx  index.css
    ├── lib/       api.ts (transport) · data.ts · store.tsx
    ├── components/  ui.tsx · toast.tsx
    └── views/       dashboard, projects, project detail (9 tabs), providers,
                     api keys, settings, logs, test console, backend & prod…
```

## 2 · Local setup

Requirements: **Node.js 20+**

```bash
git clone <this-repo> highlyagent-frontend && cd highlyagent-frontend
npm install
npm run dev          # → http://127.0.0.1:5173  (development)
```

Production build, served locally:

```bash
npm run build
npm run serve        # → http://127.0.0.1:8090  (production assets)
```

## 3 · Connecting to the backend

All connection settings live in **`.env`** (build-time) — no code changes needed:

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `https://api.your-vps.com` | REST API base (`/auth/*`, `/projects`, `/agent/process`, `/health`) |
| `VITE_WS_URL` | `wss://api.your-vps.com/ws` | Real-time WebSocket gateway |
| `VITE_API_PREFIX` | *(empty)* | REST route prefix. The backend serves endpoints at the root now — leave empty. Set only if you re-introduce `/api/v1`. |
| `VITE_SIMULATED` | `true` / `false` | `true` = built-in demo data store (no backend needed) · `false` = real API calls |

```bash
cp .env.example .env
# edit VITE_API_URL / VITE_WS_URL → your server
npm run build        # Vite embeds the values at build time
```

**Runtime override** (no rebuild — handy for the desktop app): the transport layer
(`src/lib/api.ts`) also reads `localStorage` keys `hla.api` / `hla.ws` if present.

### Backend side — one config line

In the backend repo, add this machine's origin to `backend/.env`:

```ini
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://127.0.0.1:8090
```

No backend **code** change is required — CORS and the WS gateway already honour it.

## 4 · Auto-start on this machine

### Option A — PM2 (recommended, cross-platform)

```bash
npm install -g pm2
npm run build
npm run pm2:start    # pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # follow the printed command → starts at boot
```

Stop: `npm run pm2:stop` · Logs: `pm2 logs highlyagent-admin`

### Option B — systemd (Linux)

```bash
sudo cp -r . /opt/highlyagent-frontend
cd /opt/highlyagent-frontend && npm ci && npm run build
sudo cp deploy/highlyagent-admin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now highlyagent-admin
```

### Option C — Electron (native desktop app)

```bash
npm i -D electron
npm run build
npm run electron
```

## 5 · Coming from the monorepo workspace?

This folder ships with everything except the app source **if you cloned it fresh
from the monorepo workspace**. Run once, from `frontend/`:

```bash
node scripts/sync-src.mjs     # copies ../src + ../index.html into this folder
git init && git add -A && git commit -m "HighLyAgent frontend"
git remote add origin <your-new-repo-url> && git push -u origin main
```

After that, this folder is fully standalone — the monorepo is no longer needed.

Alternative with full history (run in the monorepo):

```bash
git subtree split --prefix=frontend -b frontend-only
git push <new-remote> frontend-only:main
```

## 6 · Auth & security notes

- First boot shows the **Admin Setup** screen — the admin account is created
  manually, once. There is no default login.
- Admin plane uses **JWT only** (30-min access + 7-day rotating refresh token).
  The dashboard never sends an API key.
- Client apps use **dual-factor** access: `X-Client-Id` + `X-API-Key` must match;
  a mismatch is rejected with `403 ACCESS_DENIED` (WS close code `4403`).
- The local server binds `127.0.0.1` exclusively and sends a restrictive CSP.
  **Never** expose this dashboard publicly (no `0.0.0.0`, no reverse proxy).

## 7 · Troubleshooting

| Symptom | Fix |
|---|---|
| `CORS` errors in console | Add your local origin to backend `ALLOWED_ORIGINS` (see §3) |
| Login fails with network error | `VITE_SIMULATED=false` but API unreachable — check `VITE_API_URL` + TLS |
| WS closes with `4403` | Project-ID / API-key mismatch — rotate the key in **API Keys** |
| Blank page after build | Run `npm run build` again; the server serves `dist/` only |
| `sync-src.mjs` exits 1 | Already standalone — nothing to sync, continue with `npm install` |
