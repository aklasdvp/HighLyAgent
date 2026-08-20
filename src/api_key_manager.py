"""Two-layer API key system.

Layer A — Management API Key (``MANAGEMENT_API_KEY`` env var):
    Used only by the Admin Dashboard (HighLyAgent Manager) to call management
    endpoints (project create/edit/delete, knowledge, tools, users, health).
    It is a static server-side secret and must never be handed to a client
    project. It is an alternative to a JWT bearer token: the management key
    grants full admin access without a login session.

Layer B — Project API Key (``hl_live_...``):
    Generated automatically when a project (Client) is created and shown to the
    operator exactly once. A project key grants access only to that project's
    endpoints (``/agent/process``) and must be paired with the matching
    ``X-Client-Id`` header. It can be rotated via
    ``POST /projects/{project_id}/keys/rotate``, which instantly revokes the old
    key. Only the SHA-256 hash of the key is ever stored.
"""
from __future__ import annotations

import hmac
import secrets
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import ROLE_PERMISSIONS, decode_token, generate_api_key, get_db, hash_api_key, settings
from models import ApiKey, Client

bearer_scheme = HTTPBearer(auto_error=False)

# ── Layer A: Management API Key ─────────────────────────
def generate_management_key() -> str:
    """Generate a new management key (used once to seed the environment)."""
    return f"hl_mgmt_{secrets.token_urlsafe(32)}"


def verify_management_key(provided: str | None) -> bool:
    """Constant-time check of a candidate against the configured management key."""
    if not provided or not settings.MANAGEMENT_API_KEY:
        return False
    return hmac.compare_digest(provided, settings.MANAGEMENT_API_KEY)


def require_management(*permissions: str):
    """Dependency factory for management endpoints.

    Accepts either the ``X-Management-Key`` header (full admin) or a JWT bearer
    token whose role carries every requested permission.
    """
    async def _check(request: Request,
                     creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
        mgmt = request.headers.get("X-Management-Key")
        if verify_management_key(mgmt):
            return {"sub": "management", "role": "admin", "auth": "management-key"}
        if creds is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token or management key")
        payload = decode_token(creds.credentials)
        granted = ROLE_PERMISSIONS.get(payload.get("role", ""), set())
        if not all(p in granted for p in permissions):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return payload
    return _check


# ── Layer B: Project API Key ────────────────────────────
def generate_project_key() -> tuple[str, str]:
    """Return ``(visible_key, stored_hash)``. The visible key is shown once."""
    return generate_api_key()


def project_key_matches(visible: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key(visible), stored_hash)


async def authenticate_project_key(db: AsyncSession, client_id: str | None,
                                   api_key: str | None) -> tuple[Client, ApiKey]:
    """Dual-factor client authentication.

    Both ``X-Client-Id`` and ``X-API-Key`` are required and must belong to the
    same project. Raises ``HTTPException`` (401/403) on any mismatch.
    """
    if not client_id or not api_key:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            {"code": "INVALID_KEY",
             "message": "Both X-Client-Id and X-API-Key headers are required"},
        )

    key = (await db.execute(select(ApiKey).where(
        ApiKey.key_hash == hash_api_key(api_key), ApiKey.revoked.is_(False)
    ))).scalar_one_or_none()
    if key is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            {"code": "INVALID_KEY", "message": "unknown or revoked API key"},
        )
    if str(key.client_id) != client_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            {"code": "ACCESS_DENIED",
             "message": "API key does not belong to this project (id/key mismatch)"},
        )

    client = await db.get(Client, key.client_id)
    if client is None or client.suspended:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            {"code": "SUSPENDED", "message": "project is suspended"},
        )
    return client, key


async def get_project_client(request: Request,
                             db: AsyncSession = Depends(get_db)) -> tuple[Client, ApiKey]:
    """FastAPI dependency wrapping ``authenticate_project_key``."""
    return await authenticate_project_key(
        db, request.headers.get("X-Client-Id"), request.headers.get("X-API-Key"),
    )


def management_key_id() -> uuid.UUID:
    """Stable pseudo-id for the management principal (audit trail only)."""
    return uuid.uuid5(uuid.NAMESPACE_OID, "management-key")
