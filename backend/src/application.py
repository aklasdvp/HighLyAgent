"""FastAPI application assembly for HighLyAgent."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core import init_redis, settings
from gateway import router as ws_router
from routes import router as api_router
from tools import registry

__version__ = "2.4.1"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
)
log = logging.getLogger("highlyagent")

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])

@asynccontextmanager
async def lifespan(_: FastAPI):
    """Initialize shared Redis infrastructure for the API lifespan."""
    await init_redis()
    log.info("redis connected")
    log.info("provider chain: %s", " → ".join(__import__("providers", fromlist=["factory"]).factory.chain))
    log.info("server tools: %s", ", ".join(sorted(registry._server)))
    yield
    log.info("shutdown complete")

app = FastAPI(
    title="HighLyAgent",
    version=__version__,
    description="Universal AI Middleware — self-learning agent core for Web, Mobile, Desktop & IoT clients.",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

app.include_router(api_router)
app.include_router(ws_router)

@app.get("/")
async def root():
    """Return public service metadata."""
    return {
        "service": settings.APP_NAME,
        "version": __version__,
        "gateway": "wss://<host>/ws",
        "api": settings.API_V1_PREFIX or "/",
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "disabled",
    }

@app.get("/health")
async def health_ping():
    """Return a lightweight liveness response."""
    return {"status": "ok", "version": __version__}
