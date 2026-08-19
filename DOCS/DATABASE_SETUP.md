# Database Setup

Install PostgreSQL 16 on Linux, Windows, or macOS using the platform package manager/installer, then install pgvector for that PostgreSQL version. Connect as a PostgreSQL administrator:

```sql
CREATE USER highlyagent WITH PASSWORD 'replace-me';
CREATE DATABASE highlyagent OWNER highlyagent;
\c highlyagent
CREATE EXTENSION IF NOT EXISTS vector;
```

Set `DATABASE_URL=postgresql+asyncpg://highlyagent:replace-me@localhost:5432/highlyagent`, then initialize the versioned schema:

```bash
alembic upgrade head
```

Backup and restore:
```bash
pg_dump -U highlyagent highlyagent > highlyagent.sql
psql -U highlyagent -d highlyagent < highlyagent.sql
```
Test restores in a separate database before production use.