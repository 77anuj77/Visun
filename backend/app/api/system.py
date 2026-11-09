from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..core.config import settings
from ..core.database import reset_demo
from ..core.security import PrincipalDep, SessionDep
from ..models import User, Workspace, utcnow
from ..serializers import snapshot
from ..services.agent import agent_status
from ..services.providers import adapter_status
from ..timeutil import to_iso

router = APIRouter()


@router.get("/health", tags=["system"])
def health(session: SessionDep) -> dict[str, Any]:
    database = "ok"
    try:
        session.exec(select(User).limit(1)).first()  # type: ignore[attr-defined]
    except Exception as exc:  # noqa: BLE001
        database = f"error: {type(exc).__name__}"
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
        "voice": {
            "backend": "gemini_live" if settings.gemini_live_configured else "browser_fallback",
            "configured": settings.gemini_live_configured,
            "model": settings.gemini_live_model or None,
        },
    }


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


@router.post("/reset-demo", tags=["system"])
def reset_workspace(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    if settings.environment == "production" or settings.auth_mode != "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo reset is disabled outside local demo mode.",
        )
    if principal.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can reset the demo.",
        )
    reset_demo(session)
    return {"reset": True, "sample": True}
