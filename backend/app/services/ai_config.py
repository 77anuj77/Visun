"""Resolve the AI model configuration for one workspace.

Order of precedence: credentials saved in Settings → deployment environment
variables. Secrets stay on the server; callers only ever receive the provider,
model ids, and where the values came from.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlmodel import Session

from ..core.config import DEFAULT_LIVE_MODEL, DEFAULT_TEXT_MODEL, settings
from .credentials import CredentialError, resolve_values

log = logging.getLogger(__name__)


def normalize_model_id(model: str) -> str:
    """Accept model ids with or without the ``models/`` resource prefix."""
    return (model or "").strip().removeprefix("models/")


def is_live_model(model: str) -> bool:
    """Whether a model id belongs to the bidirectional Live model family.

    Live models only answer through ``bidiGenerateContent``; sending one to
    ``generateContent`` fails with INVALID_ARGUMENT. This guards both fields:
    text-only ids are kept out of voice and Live ids are kept out of chat.
    """
    value = normalize_model_id(model).lower()
    return bool(value) and ("live" in value or "native-audio" in value)


def _text_model(values: dict[str, str], workspace_id: str) -> str:
    """The model used for chat/tools, never a Live-only id.

    Any model supporting ``generateContent`` is accepted as-is. A Live-only id
    saved by mistake falls back to the deployment text model, then to the
    documented default, so chat keeps working instead of failing mid-turn.
    """
    requested = normalize_model_id(values.get("text_model") or "")
    if not requested:
        return ""
    if not is_live_model(requested):
        return requested
    fallback = normalize_model_id(settings.gemini_text_model)
    if not fallback or is_live_model(fallback):
        fallback = DEFAULT_TEXT_MODEL
    log.warning(
        "ignoring live-only model for text chat",
        extra={"workspace_id": workspace_id, "model": requested, "fallback": fallback},
    )
    return fallback


def text_model_fallback(model: str, error: str) -> str | None:
    """A different text model to try when the provider rejects ``model``.

    Handles retired ids (``404 NOT_FOUND``) and Live ids sent to the text API;
    any other error (auth, quota, network) is not a model problem."""
    message = (error or "").lower()
    if not any(
        marker in message
        for marker in (
            "not_found",
            "not found",
            "no longer available",
            "does not support generatecontent",
            "only supports real-time bidirectional streaming",
        )
    ):
        return None
    configured = normalize_model_id(model)
    for candidate in (normalize_model_id(settings.gemini_text_model), DEFAULT_TEXT_MODEL):
        if candidate and candidate != configured and not is_live_model(candidate):
            return candidate
    return None


def _live_model(values: dict[str, str], workspace_id: str) -> str:
    requested = normalize_model_id(values.get("live_model") or "")
    if not requested:
        return DEFAULT_LIVE_MODEL
    if is_live_model(requested):
        return requested
    log.warning(
        "ignoring non-live model for voice",
        extra={"workspace_id": workspace_id, "model": requested},
    )
    return DEFAULT_LIVE_MODEL


@dataclass(slots=True)
class AiConfig:
    api_key: str
    text_model: str
    live_model: str
    source: str

    @property
    def voice_capable(self) -> bool:
        return bool(self.live_model)


@dataclass(slots=True)
class LiveConfig:
    """Resolved Live/voice credentials for one workspace."""

    api_key: str
    model: str
    source: str


def _resolve_gemini_values(
    session: Session, workspace_id: str
) -> tuple[dict[str, str], str | None]:
    try:
        return resolve_values(session, workspace_id, "gemini")
    except CredentialError:
        return {}, None


def resolve_live_config(session: Session, workspace_id: str) -> LiveConfig | None:
    """Resolve the Live API key and model without requiring a text model.

    A workspace can enable voice even when it has not picked a text model yet.
    An empty Live model means the documented native-audio default.
    """
    values, source = _resolve_gemini_values(session, workspace_id)
    api_key = (values.get("api_key") or "").strip()
    if not api_key:
        return None
    return LiveConfig(
        api_key=api_key,
        model=_live_model(values, workspace_id),
        source=source or "environment",
    )



def resolve_ai_config(session: Session, workspace_id: str) -> AiConfig | None:
    values, source = _resolve_gemini_values(session, workspace_id)
    api_key = (values.get("api_key") or "").strip()
    text_model = _text_model(values, workspace_id)
    if not api_key or not text_model:
        return None
    return AiConfig(
        api_key=api_key,
        text_model=text_model,
        live_model=_live_model(values, workspace_id),
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
