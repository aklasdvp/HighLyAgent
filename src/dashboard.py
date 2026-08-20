"""
HighLyAgent Dashboard — status, health, and system overview.
Renders different views for development vs production.
"""
from __future__ import annotations

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import get_db, get_redis, settings
from models import AdminUser, Client, Message, User
from providers import factory

log = logging.getLogger("dashboard")
router = APIRouter(prefix="", tags=["dashboard"])


async def get_system_status(db: AsyncSession) -> dict:
    """Gather system health and metrics."""
    status = {"db": False, "redis": False}
    metrics = {"projects": 0, "users": 0, "messages": 0, "admins": 0}

    # Database health
    try:
        result = await db.execute(select(1))
        status["db"] = result.scalar() == 1
    except Exception as e:
        log.warning("db check failed: %s", str(e))

    # Redis health
    try:
        redis = await get_redis()
        pong = await redis.ping()
        status["redis"] = pong is True or pong == b"PONG"
    except Exception as e:
        log.warning("redis check failed: %s", str(e))

    # Counts (only if DB is up)
    if status["db"]:
        try:
            metrics["projects"] = (
                await db.execute(select(Client)))
            ).scalar_one_or_none() or 0
            metrics["projects"] = len((await db.execute(select(Client))).scalars().all())

            metrics["users"] = len((await db.execute(select(User))).scalars().all())
            metrics["messages"] = len((await db.execute(select(Message))).scalars().all())
            metrics["admins"] = len((await db.execute(select(AdminUser))).scalars().all())
        except Exception as e:
            log.warning("metrics fetch failed: %s", str(e))

    return {
        "status": status,
        "metrics": metrics,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
    }


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(db: AsyncSession = Depends(get_db)):
    """Main dashboard page — shows system status, health, and project info."""
    sys_status = await get_system_status(db)

    db_ok = sys_status["status"]["db"]
    redis_ok = sys_status["status"]["redis"]
    environment = sys_status["environment"]

    # Production: minimal view
    if environment == "production":
        return _render_production(sys_status)

    # Development: full dashboard
    return _render_development(sys_status)


def _render_production(sys_status: dict) -> str:
    """Minimal production view — no sensitive details."""
    status_overall = "🟢 operational" if (
        sys_status["status"]["db"] and sys_status["status"]["redis"]
    ) else "🔴 degraded"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HighLyAgent</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .container {{
                background: white;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                padding: 60px 40px;
                text-align: center;
                max-width: 500px;
            }}
            h1 {{
                color: #333;
                margin-bottom: 10px;
                font-size: 2.5em;
            }}
            .status {{
                font-size: 1.2em;
                margin: 30px 0;
                padding: 15px;
                background: #f5f5f5;
                border-radius: 8px;
            }}
            .message {{
                color: #666;
                font-size: 1.1em;
                line-height: 1.6;
                margin-top: 20px;
            }}
            .timestamp {{
                color: #999;
                font-size: 0.9em;
                margin-top: 30px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>HighLyAgent</h1>
            <div class="status">{status_overall}</div>
            <div class="message">
                🔒 Production Mode<br>
                <small>Detailed metrics are not visible in production for security reasons.</small>
            </div>
            <div class="timestamp">{sys_status['timestamp']}</div>
        </div>
    </body>
    </html>
    """


def _render_development(sys_status: dict) -> str:
    """Full development dashboard — all metrics and debug info."""
    status = sys_status["status"]
    metrics = sys_status["metrics"]

    db_badge = "✅ Connected" if status["db"] else "❌ Disconnected"
    redis_badge = "✅ Connected" if status["redis"] else "❌ Disconnected"

    provider_chain = " → ".join(factory.chain) if hasattr(factory, 'chain') else "unknown"
    configured_providers = ", ".join(factory.configured()) if hasattr(factory, 'configured') else "unknown"

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HighLyAgent Dashboard</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Monaco, 'Courier New', monospace;
                background: #0f1419;
                color: #e1e8ed;
                padding: 20px;
            }}
            .container {{
                max-width: 1200px;
                margin: 0 auto;
            }}
            header {{
                border-bottom: 2px solid #667eea;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }}
            h1 {{
                font-size: 2.5em;
                color: #667eea;
                margin-bottom: 10px;
            }}
            .header-meta {{
                color: #b0b9c1;
                font-size: 0.95em;
            }}
            .grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }}
            .card {{
                background: #192734;
                border: 1px solid #38444d;
                border-radius: 8px;
                padding: 20px;
            }}
            .card h2 {{
                color: #667eea;
                font-size: 1.3em;
                margin-bottom: 15px;
                border-bottom: 1px solid #38444d;
                padding-bottom: 10px;
            }}
            .metric {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #253549;
            }}
            .metric:last-child {{ border-bottom: none; }}
            .metric-label {{
                color: #b0b9c1;
            }}
            .metric-value {{
                color: #1da1f2;
                font-weight: bold;
            }}
            .status-indicator {{
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
                vertical-align: middle;
            }}
            .status-ok {{
                background-color: #17bf63;
            }}
            .status-error {{
                background-color: #e74c3c;
            }}
            .badge {{
                display: inline-block;
                background: #38444d;
                color: #fff;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.85em;
                margin: 2px;
            }}
            .provider-chain {{
                background: #253549;
                padding: 10px;
                border-radius: 4px;
                font-size: 0.9em;
                word-break: break-word;
                color: #1da1f2;
                font-weight: bold;
            }}
            .timestamp {{
                color: #657786;
                font-size: 0.85em;
                margin-top: 20px;
                text-align: right;
            }}
            .warning {{
                background: #ffd700;
                color: #000;
                padding: 12px;
                border-radius: 4px;
                margin-bottom: 20px;
                font-weight: bold;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <header>
                <h1>🤖 HighLyAgent Dashboard</h1>
                <div class="header-meta">Development Mode — Real-time System Overview</div>
            </header>

            <div class="grid">
                <!-- System Health -->
                <div class="card">
                    <h2>🔌 System Health</h2>
                    <div class="metric">
                        <span class="metric-label">
                            <span class="status-indicator {'status-ok' if status['db'] else 'status-error'}"></span>
                            Database
                        </span>
                        <span class="metric-value">{db_badge}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">
                            <span class="status-indicator {'status-ok' if status['redis'] else 'status-error'}"></span>
                            Redis Cache
                        </span>
                        <span class="metric-value">{redis_badge}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Environment</span>
                        <span class="metric-value">{sys_status['environment'].upper()}</span>
                    </div>
                </div>

                <!-- Project Metrics -->
                <div class="card">
                    <h2>📊 Metrics</h2>
                    <div class="metric">
                        <span class="metric-label">Projects</span>
                        <span class="metric-value">{metrics['projects']}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Users</span>
                        <span class="metric-value">{metrics['users']}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Messages</span>
                        <span class="metric-value">{metrics['messages']}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Admins</span>
                        <span class="metric-value">{metrics['admins']}</span>
                    </div>
                </div>

                <!-- AI Providers -->
                <div class="card">
                    <h2>🧠 AI Providers</h2>
                    <div style="margin-bottom: 10px;">
                        <strong>Fallback Chain:</strong>
                        <div class="provider-chain">{provider_chain}</div>
                    </div>
                    <div>
                        <strong>Available Providers:</strong>
                        <div style="margin-top: 8px;">
                            {' '.join([f'<span class="badge">{p}</span>' for p in configured_providers.split(', ')])}
                        </div>
                    </div>
                </div>
            </div>

            <div style="background: #192734; border: 1px solid #38444d; border-radius: 8px; padding: 20px;">
                <h2 style="color: #667eea; margin-bottom: 15px;">📚 Quick Links</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    <a href="/docs" style="color: #1da1f2; text-decoration: none;">📖 API Documentation</a>
                    <a href="/health" style="color: #1da1f2; text-decoration: none;">❤️ Health Check</a>
                    <a href="/" style="color: #1da1f2; text-decoration: none;">🏠 Service Info</a>
                </div>
            </div>

            <div class="timestamp">Last updated: {sys_status['timestamp']}</div>
        </div>
    </body>
    </html>
    """
