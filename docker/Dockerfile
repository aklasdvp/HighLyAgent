# Container image for the HighLyAgent FastAPI and Celery processes.
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PYTHONPATH=/app/src
WORKDIR /app
RUN groupadd -r agent && useradd -r -g agent agent
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY src ./src
COPY main.py .
COPY alembic.ini .
COPY migrations ./migrations
RUN chown -R agent:agent /app
USER agent
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=4s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)"
CMD ["python", "main.py"]
