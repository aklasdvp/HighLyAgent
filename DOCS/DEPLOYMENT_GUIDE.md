# Deployment Guide

Target: a VPS (e.g. DigitalOcean droplet) running the Docker stack. The Admin
Dashboard runs **only on your local machine** — it is never deployed publicly.

## 1. Provision the server

- Ubuntu 22.04+, 2 GB RAM minimum (4 GB recommended).
- Install Docker + Docker Compose plugin.
- Open only the ports you need (8000 for the API, or put it behind a reverse
  proxy on 443).

## 2. Deploy

```bash
git clone <your-backend-repo> /opt/highlyagent
cd /opt/highlyagent

cp .env.example .env
# edit .env: strong JWT_SECRET_KEY, provider keys, ENVIRONMENT=production
export DB_PASSWORD="a-strong-password"

docker compose up -d --build
docker compose exec api alembic upgrade head
```

All services are `restart: unless-stopped` → they survive reboots and crashes.

## 3. TLS (recommended)

Put the API behind a reverse proxy (nginx / Caddy / Traefik) that terminates TLS
and forwards to `127.0.0.1:8000`. Then:
- Set `ALLOWED_ORIGINS` in `.env` to your local dashboard origin
  (`http://127.0.0.1:5173` or `http://127.0.0.1:8090`).
- Point the frontend `.env` at `https://api.your-domain.com`.

## 4. Create the first admin

```bash
curl -X POST https://api.your-domain.com/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"you@example.com","password":"strong-password-123"}'
```

## 5. Connect the local dashboard

On your local machine, in the **frontend** repo:

```
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com/ws
VITE_SIMULATED=false
```

Rebuild and run it locally (PM2 / systemd / Electron — see the frontend README).

## 6. Operations

```bash
docker compose logs -f api worker      # watch logs
docker compose exec api alembic upgrade head   # apply new migrations
docker compose restart api             # restart a service
```

## Security checklist

- [ ] `JWT_SECRET_KEY` and `DB_PASSWORD` are strong random values
- [ ] Provider keys are set only in `.env` (never committed)
- [ ] TLS terminated at the proxy; API not exposed on plain HTTP
- [ ] Admin created via `/auth/setup`; dashboard stays local-only
- [ ] Client calls always send **both** `X-Client-Id` and `X-API-Key`
