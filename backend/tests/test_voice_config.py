"""Live voice configuration and persisted voice preferences.

The suite never calls Gemini. These tests pin the model defaults, the
workspace/environment credential resolution, and the preference round-trip the
Copilot voice panel depends on.
"""

from __future__ import annotations

from sqlmodel import Session

from app.core.config import DEFAULT_LIVE_MODEL, DEFAULT_TEXT_MODEL
from app.core.database import engine
from app.services.ai_config import (
    normalize_model_id,
    resolve_ai_config,
    resolve_live_config,
    text_model_fallback,
)


def test_default_live_model_and_capability(monkeypatch, demo_settings):
    monkeypatch.setattr(demo_settings, "google_api_key", "test-key")
    monkeypatch.setattr(demo_settings, "gemini_live_model", "")
    monkeypatch.setattr(demo_settings, "voice_backend", "auto")

    assert demo_settings.live_model == DEFAULT_LIVE_MODEL
    assert demo_settings.gemini_live_configured is True

    # The browser fallback stays available even with a key configured.
    monkeypatch.setattr(demo_settings, "voice_backend", "browser")
    assert demo_settings.gemini_live_configured is False

    monkeypatch.setattr(demo_settings, "voice_backend", "auto")
    monkeypatch.setattr(demo_settings, "google_api_key", "")
    assert demo_settings.gemini_live_configured is False


def test_live_config_resolution(monkeypatch, demo_settings):
    monkeypatch.setattr(demo_settings, "google_api_key", "test-key")
    monkeypatch.setattr(demo_settings, "gemini_live_model", "")
    monkeypatch.setattr(demo_settings, "gemini_text_model", "")

    with Session(engine) as session:
        config = resolve_live_config(session, "ws-paroha")
        assert config is not None
        assert config.api_key == "test-key"
        # Voice works without a text model; the documented default fills in.
        assert config.model == DEFAULT_LIVE_MODEL

        monkeypatch.setattr(
            demo_settings,
            "gemini_live_model",
            "gemini-2.5-flash-preview-native-audio-dialog",
        )
        override = resolve_live_config(session, "ws-paroha")
        assert override is not None
        assert override.model == "gemini-2.5-flash-preview-native-audio-dialog"

        monkeypatch.setattr(demo_settings, "google_api_key", "")
        assert resolve_live_config(session, "ws-paroha") is None


def test_live_config_gates_legacy_fields_by_model_family():
    from google.genai import types

    from app.services.voice import _live_config

    prefs = {"voiceName": "Sulafat", "voiceLanguage": "hindi", "voiceStyle": "energetic"}

    # Gemini 3.8 Live enables affective dialog and proactivity by default and
    # rejects the legacy fields, so they must not be sent.
    live_38 = _live_config(types, "gemini-3.8-live", prefs)
    assert live_38.enable_affective_dialog is None
    assert live_38.proactivity is None
    assert live_38.response_modalities == ["AUDIO"]
    assert (
        live_38.speech_config.voice_config.prebuilt_voice_config.voice_name
        == "Sulafat"
    )

    # The 2.5 native-audio family needs the explicit opt-in.
    live_25 = _live_config(
        types, "gemini-live-2.5-flash-native-audio", prefs
    )
    assert live_25.enable_affective_dialog is True
    assert live_25.proactivity is not None
    assert live_25.proactivity.proactive_audio is False


def test_voice_preferences_reach_live_config(api):
    from google.genai import types

    from app.services.voice import _live_config, _voice_preferences

    api.patch(
        "/api/v1/preferences",
        json={
            "voiceName": "Puck",
            "voiceLanguage": "english",
            "voiceStyle": "professional",
        },
    )
    with Session(engine) as session:
        prefs = _voice_preferences(session, "ws-paroha")
    assert prefs == {
        "voiceName": "Puck",
        "voiceLanguage": "english",
        "voiceStyle": "professional",
    }

    config = _live_config(types, "gemini-3.8-live", prefs)
    assert (
        config.speech_config.voice_config.prebuilt_voice_config.voice_name
        == "Puck"
    )
    assert "Indian English" in config.system_instruction
    assert "composed" in config.system_instruction


def test_health_reports_voice_capabilities(api, monkeypatch, demo_settings):
    monkeypatch.setattr(demo_settings, "google_api_key", "")
    monkeypatch.setattr(demo_settings, "voice_backend", "auto")
    body = api.get("/api/v1/health").json()
    voice = body["voice"]

    assert voice["backend"] == "browser_fallback"
    assert voice["configured"] is False
    assert voice["defaultModel"] == DEFAULT_LIVE_MODEL
    assert voice["voices"] == ["Achird", "Sulafat", "Aoede", "Puck"]
    assert voice["affectiveDialog"] is False

    # Affective dialogue only turns on for the 2.5 native-audio family.
    monkeypatch.setattr(
        demo_settings, "gemini_live_model", "gemini-live-2.5-flash-native-audio"
    )
    body = api.get("/api/v1/health").json()
    assert body["voice"]["affectiveDialog"] is True


def test_text_model_in_live_field_falls_back_to_default(api, monkeypatch, demo_settings):
    from app.services.ai_config import is_live_model
    from app.services.credentials import save_values

    monkeypatch.setattr(demo_settings, "voice_backend", "auto")
    monkeypatch.setattr(demo_settings, "google_api_key", "")
    with Session(engine) as session:
        save_values(
            session,
            "ws-paroha",
            "gemini",
            {
                "api_key": "workspace-key-not-a-secret",
                "text_model": "gemini-2.5-flash",
                # A text-only id saved by mistake used to be passed straight to
                # Live, where Gemini rejects it at connect.
                "live_model": "gemini-2.5-flash-preview",
            },
        )
        live = resolve_live_config(session, "ws-paroha")

    assert live is not None
    assert live.model == DEFAULT_LIVE_MODEL
    assert is_live_model("gemini-3.8-live")
    assert is_live_model("gemini-live-2.5-flash-native-audio")
    assert not is_live_model("gemini-2.5-flash-preview")
    assert not is_live_model("")


def test_health_reflects_workspace_credentials(api, monkeypatch, demo_settings):
    from app.services.credentials import save_values

    monkeypatch.setattr(demo_settings, "voice_backend", "auto")
    monkeypatch.setattr(demo_settings, "google_api_key", "")
    monkeypatch.setattr(demo_settings, "gemini_live_model", "")
    with Session(engine) as session:
        save_values(
            session,
            "ws-paroha",
            "gemini",
            {
                "api_key": "workspace-key-not-a-secret",
                "text_model": "gemini-2.5-flash",
                "live_model": "gemini-2.5-flash-preview",
            },
        )

    voice = api.get("/api/v1/health").json()["voice"]
    assert voice["workspace"] == {
        "configured": True,
        "model": DEFAULT_LIVE_MODEL,
        "source": "workspace",
    }
    assert voice["configured"] is True
    assert voice["backend"] == "gemini_live"
    assert voice["source"] == "workspace"
    assert voice["model"] == DEFAULT_LIVE_MODEL
    assert "workspace-key-not-a-secret" not in str(voice)

    # Deployment env still wins when the workspace has nothing saved.
    with Session(engine) as session:
        from app.services.credentials import clear_values

        clear_values(session, "ws-paroha", "gemini")
    voice = api.get("/api/v1/health").json()["voice"]
    assert voice["workspace"] == {"configured": False, "model": None, "source": None}
    assert voice["configured"] is False

    # Anonymous callers only ever see deployment-level information.
    monkeypatch.setattr(demo_settings, "auth_mode", "clerk")
    anonymous = api.get("/api/v1/health").json()["voice"]
    assert "workspace" not in anonymous
    assert anonymous["configured"] is False


def test_live_model_in_text_field_falls_back_to_text_model(
    api, monkeypatch, demo_settings
):
    """A Live id saved in the text field must never reach generateContent."""
    from app.services.credentials import save_values

    monkeypatch.setattr(demo_settings, "google_api_key", "")
    monkeypatch.setattr(demo_settings, "gemini_text_model", "")
    with Session(engine) as session:
        save_values(
            session,
            "ws-paroha",
            "gemini",
            {
                "api_key": "workspace-key-not-a-secret",
                "text_model": "gemini-3.8-live",
                "live_model": "models/gemini-3.8-live",
            },
        )
        config = resolve_ai_config(session, "ws-paroha")

    assert config is not None
    # Text chat uses a text model; voice keeps the chosen Live model.
    assert config.text_model == DEFAULT_TEXT_MODEL
    assert config.live_model == "gemini-3.8-live"


def test_model_ids_accept_resource_prefix_and_any_text_model(monkeypatch, demo_settings):
    from app.services.credentials import save_values

    monkeypatch.setattr(demo_settings, "google_api_key", "")
    monkeypatch.setattr(demo_settings, "gemini_text_model", "")
    with Session(engine) as session:
        save_values(
            session,
            "ws-paroha",
            "gemini",
            {
                "api_key": "workspace-key-not-a-secret",
                # Any model supporting generateContent is accepted as-is.
                "text_model": "models/gemini-3.1-pro-preview",
                "live_model": "gemini-3.8-live",
            },
        )
        config = resolve_ai_config(session, "ws-paroha")

    assert config is not None
    assert config.text_model == "gemini-3.1-pro-preview"
    assert normalize_model_id("models/gemini-3.8-flash") == "gemini-3.8-flash"
    assert normalize_model_id("  gemini-3.8-flash  ") == "gemini-3.8-flash"


def test_text_model_fallback_only_for_model_errors(monkeypatch, demo_settings):
    monkeypatch.setattr(demo_settings, "gemini_text_model", "")
    assert (
        text_model_fallback("gemini-2.5-flash", "404 NOT_FOUND: no longer available")
        == DEFAULT_TEXT_MODEL
    )
    assert (
        text_model_fallback(
            "gemini-3.8-live",
            "INVALID_ARGUMENT: only supports real-time bidirectional streaming",
        )
        == DEFAULT_TEXT_MODEL
    )
    # Auth, quota and transient failures are not fixed by swapping models.
    assert text_model_fallback("gemini-3.8-flash", "401 API key not valid") is None
    assert text_model_fallback("gemini-3.8-flash", "429 quota exhausted") is None
    assert text_model_fallback("gemini-3.8-flash", "503 UNAVAILABLE") is None
    # The working model is never swapped for itself.
    assert text_model_fallback(DEFAULT_TEXT_MODEL, "404 NOT_FOUND") is None


# The voice settings panel persists through the same preferences endpoint.
def test_preferences_round_trip_voice_settings(api):
    response = api.patch(
        "/api/v1/preferences",
        json={
            "voiceName": "Aoede",
            "voiceLanguage": "hindi",
            "voiceStyle": "energetic",
        },
    )
    assert response.status_code == 200
    prefs = response.json()["preferences"]
    assert prefs["voiceName"] == "Aoede"
    assert prefs["voiceLanguage"] == "hindi"
    assert prefs["voiceStyle"] == "energetic"

    fetched = api.get("/api/v1/preferences").json()["preferences"]
    assert fetched["voiceName"] == "Aoede"
    assert fetched["voiceLanguage"] == "hindi"
    assert fetched["voiceStyle"] == "energetic"

    # Unrelated updates must not disturb the stored voice choices.
    api.patch("/api/v1/preferences", json={"reducedMotion": True})
    fetched = api.get("/api/v1/preferences").json()["preferences"]
    assert fetched["reducedMotion"] is True
    assert fetched["voiceName"] == "Aoede"

    # Unknown voice values are rejected at the schema boundary. The app maps
    # Pydantic's 422 to its 400 validation envelope.
    bad = api.patch("/api/v1/preferences", json={"voiceName": "NotAVoice"})
    assert bad.status_code == 400
