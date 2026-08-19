# Docker Setup

Install Docker Engine/Desktop and Docker Compose v2. Create `.env` from `.env.example`, set real secrets, then:

```bash
export DB_PASSWORD='replace-me' # PowerShell: $env:DB_PASSWORD='replace-me'
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Control services with `docker compose restart`, `docker compose stop`, and `docker compose start`. Run a migration from the API image with `docker compose exec api alembic upgrade head`. Keep database and Redis ports private on production hosts.