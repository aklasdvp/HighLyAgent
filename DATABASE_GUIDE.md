# Database Guide

HighLyAgent uses PostgreSQL 16 with the pgvector extension. The Compose database image enables the extension through `backend/migrations/init.sql` on first volume initialization.

## Local Compose database

```bash
$env:DB_PASSWORD = "replace-me"
docker compose up -d db
docker compose exec db psql -U highlyagent -d highlyagent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Use `postgresql+asyncpg://highlyagent:<password>@localhost:5432/highlyagent` outside Docker. The application expects vector dimension `1536`.

## Migrations

This repository currently has no Alembic revision directory. Schema changes must be versioned before production rollout; do not manually alter live tables without a reviewed migration.

## Backup and restore

```bash
docker compose exec -T db pg_dump -U highlyagent highlyagent > highlyagent.sql
Get-Content highlyagent.sql | docker compose exec -T db psql -U highlyagent -d highlyagent
```

Restore only into a deliberate target database after testing the backup.
