# Local Setup

## Python environment
```bash
python3 -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```
Set `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, and any enabled provider keys in `.env`.

## PostgreSQL, pgvector and Redis
Install PostgreSQL 16 with pgvector and Redis locally, or use only their Compose services:
```bash
$env:DB_PASSWORD="replace-me"
docker compose up -d db redis
```
For local host processes use `localhost` in URLs; Compose containers use `db` and `redis`.

## Migrate and run
```bash
alembic upgrade head
python3 main.py
```
The API runs at `http://localhost:8000`; development OpenAPI docs are at `/docs`.
