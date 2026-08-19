# ── HighLyAgent API ─────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# security: run as non-root user
RUN groupadd -r agent && useradd -r -g agent agent

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY ./src ./src
COPY ./main.py ./alembic.ini ./
COPY ./migrations ./migrations

# flat src/ modules must be importable (main.py also adds this at runtime)
ENV PYTHONPATH=/app/src

RUN chown -R agent:agent /app
USER agent

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=4s --retries=3 \
  CMD python -c "import httpx,sys; sys.exit(0 if httpx.get('http://localhost:8000/health',timeout=3).status_code==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
