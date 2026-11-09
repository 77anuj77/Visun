from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import select

from ..core.config import DEFAULT_LIVE_MODEL, settings
from ..core.database import reset_demo_workspace
from ..core.security import (
    OptionalPrincipalDep,
    Principal,
    PrincipalDep,
    RateLimiter,
    SessionDep,
)
from ..models import User, Workspace, utcnow
from ..serializers import snapshot
from ..services.agent import agent_status
from ..services.ai_config import resolve_live_config
from ..services.providers import adapter_status
from ..timeutil import to_iso

router = APIRouter()


@router.get("/health", tags=["system"])
def health(session: SessionDep, principal: OptionalPrincipalDep) -> dict[str, Any]:
    database = "ok"
    try:
        session.exec(select(User).limit(1)).first()  # type: ignore[attr-defined]
    except Exception as exc:  # noqa: BLE001
        database = f"error: {type(exc).__name__}"
    voice = _voice_status(session, principal)
    return {
        "status": "ok" if database == "ok" else "degraded",
        "time": to_iso(utcnow()),
        "environment": settings.environment,
        "database": database,
        "databaseUrl": settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url.split("///")[-1],
        "authMode": settings.auth_mode,
        "publicDemo": settings.allow_public_demo,
        "providerMode": settings.provider_mode,
        "providers": adapter_status(),
        "agent": agent_status(),
        "voice": voice,
    }


def _voice_status(session: SessionDep, principal: Principal | None) -> dict[str, Any]:
    """Deployment defaults, upgraded to the caller's own workspace when signed in.

    Health previously reported only environment variables, so a workspace that
    saved a Gemini key in Settings looked unconfigured even though the Live
    bridge would use that key. The workspace block makes the distinction
    explicit without exposing any secret.
    """
    voice: dict[str, Any] = {
        "backend": "gemini_live" if settings.gemini_live_configured else "browser_fallback",
        "configured": settings.gemini_live_configured,
        "model": settings.live_model,
        "defaultModel": DEFAULT_LIVE_MODEL,
        "voices": ["Achird", "Sulafat", "Aoede", "Puck"],
        "affectiveDialog": "2.5" in settings.live_model,
        "source": "environment" if settings.gemini_live_configured else None,
    }
    if principal is None:
        return voice

    resolved = None
    try:
        resolved = resolve_live_config(session, principal.workspace_id)
    except Exception as exc:  # noqa: BLE001 - health must never fail on this
        voice["workspace"] = {
            "configured": False,
            "model": None,
            "source": None,
            "error": type(exc).__name__,
        }
        return voice

    enabled = resolved is not None and settings.voice_backend != "browser"
    voice["workspace"] = {
        "configured": enabled,
        "model": resolved.model if enabled else None,
        "source": resolved.source if enabled else None,
    }
    if enabled and resolved is not None:
        voice.update(
            backend="gemini_live",
            configured=True,
            model=resolved.model,
            source=resolved.source,
            affectiveDialog="2.5" in resolved.model,
        )
    return voice


@router.get("/bootstrap", tags=["system"])
def bootstrap(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    user = session.get(User, principal.user_id)
    workspace = session.get(Workspace, principal.workspace_id)
    if user is None or workspace is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workspace is not initialized.",
        )
    payload = snapshot(session, principal.workspace_id, user, workspace)
    payload["authMode"] = settings.auth_mode
    payload["publicDemo"] = settings.allow_public_demo
    payload["providerMode"] = settings.provider_mode
    payload["providers"] = adapter_status()
    payload["agent"] = agent_status(session, principal.workspace_id)
    return payload


demo_reset_limiter = RateLimiter(limit=3, window_seconds=60)


@router.post("/reset-demo", tags=["system"])
def reset_workspace(
    session: SessionDep, principal: PrincipalDep, request: Request
) -> dict[str, Any]:
    """Restore the shared demo workspace without touching customer data.

    Available in local demo mode and in an explicitly opted-in public demo. A
    reset only deletes rows whose workspace is the seeded demo workspace.
    """
    from ..seed import WORKSPACE_ID as DEMO_WORKSPACE_ID

    if settings.auth_mode != "demo" and not settings.allow_public_demo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo reset is disabled on this installation.",
        )
    if principal.workspace_id != DEMO_WORKSPACE_ID or principal.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the demo workspace can be reset.",
        )
    client = request.client.host if request.client else "unknown"
    demo_reset_limiter.check(f"reset-demo:{client}")
    reset_demo_workspace(session)
    return {"reset": True, "sample": True}
