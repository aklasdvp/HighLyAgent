"""FastAPI application assembly for HighLyAgent."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from core import init_redis, settings
from gateway import router as ws_router
from landing import render as render_landing
from routes import router as api_router
from tools import registry

__version__ = "2.4.1"

# Process boot time — the only dynamic value exposed on the public landing page.
_BOOT_MS = int(time.time() * 1000)

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
async def root(request: Request):
    """Public face of the service.

    Browsers receive the crafted landing page; API clients receive a minimal,
    non-sensitive JSON body. Deliberately reveals no version, internal hosts,
    gateway paths or docs location.
    """
    if "text/html" in request.headers.get("accept", ""):
        return HTMLResponse(render_landing(_BOOT_MS))
    return {
        "service": settings.APP_NAME,
        "status": "ok",
        "about": "Universal AI Middleware — self-learning agent core. Open this URL in a browser for details.",
    }

@app.get("/health")
async def health_ping():
    """Return a lightweight liveness response."""
    return {"status": "ok", "version": __version__}
