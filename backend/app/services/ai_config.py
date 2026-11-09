"""Resolve the AI model configuration for one workspace.

Order of precedence: credentials saved in Settings → deployment environment
variables. Secrets stay on the server; callers only ever receive the provider,
model ids, and where the values came from.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlmodel import Session

from ..core.config import settings
from .credentials import CredentialError, resolve_values


@dataclass(slots=True)
class AiConfig:
    api_key: str
    text_model: str
    live_model: str
    source: str

    @property
    def voice_capable(self) -> bool:
        return bool(self.live_model)


def resolve_ai_config(session: Session, workspace_id: str) -> AiConfig | None:
    try:
        values, source = resolve_values(session, workspace_id, "gemini")
    except CredentialError:
        values, source = {}, None
    api_key = (values.get("api_key") or "").strip()
    text_model = (values.get("text_model") or "").strip()
    if not api_key or not text_model:
        return None
    return AiConfig(
        api_key=api_key,
        text_model=text_model,
        live_model=(values.get("live_model") or "").strip(),
        source=source or "environment",
    )


def ai_status(session: Session, workspace_id: str) -> dict[str, object]:
    config = resolve_ai_config(session, workspace_id)
    return {
        "configured": config is not None,
        "provider": "Google Gemini" if config else None,
        "textModel": config.text_model if config else None,
        "liveModel": config.live_model or None if config else None,
        "source": config.source if config else None,
        "voiceCapable": bool(config and config.voice_capable),
        "agentBackendSetting": settings.agent_backend,
    }
