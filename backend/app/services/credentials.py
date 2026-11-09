"""Per-workspace provider credentials, encrypted at rest and verified for real.

Settings can store the same values a deployment would put in `.env` (Client ID,
refresh token, bot token…). Values are encrypted with `APP_ENCRYPTION_KEY` and
never returned by an endpoint; reads are reduced to a masked preview.

Verification is honest: `test_provider` performs one read-only call against the
provider's own API with the resolved credentials and reports what came back. It
never claims success without a provider response, and it never echoes a secret
in an error message.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
from sqlmodel import Session, select

from ..core.config import settings
from ..core.logging import log
from ..models import ProviderCredential, utcnow
from ..timeutil import to_iso
from .crypto import decrypt_secret, encrypt_secret

HTTP_TIMEOUT = 10.0


class CredentialError(RuntimeError):
    """Credentials are missing, encrypted with another key, or were rejected."""


# The field list is the contract shared with the Settings UI: every entry names
# the environment variable it stands in for.
PROVIDER_SPECS: dict[str, dict[str, Any]] = {
    "paypal": {
        "label": "PayPal",
        "docs": "https://developer.paypal.com/api/rest/",
        "fields": [
            {"key": "client_id", "label": "Client ID", "envVar": "PAYPAL_CLIENT_ID"},
            {
                "key": "client_secret",
                "label": "Client secret",
                "envVar": "PAYPAL_CLIENT_SECRET",
                "secret": True,
            },
            {
                "key": "environment",
                "label": "Environment",
                "envVar": "PAYPAL_ENVIRONMENT",
                "options": ["sandbox", "live"],
                "default": "sandbox",
            },
        ],
    },
    "gmail": {
        "label": "Gmail",
        "docs": "https://developers.google.com/gmail/api/auth/web-server",
        "fields": [
            {"key": "client_id", "label": "OAuth client ID", "envVar": "GOOGLE_OAUTH_CLIENT_ID"},
            {
                "key": "client_secret",
                "label": "OAuth client secret",
                "envVar": "GOOGLE_OAUTH_CLIENT_SECRET",
                "secret": True,
            },
            {
                "key": "refresh_token",
                "label": "Refresh token",
                "envVar": "GOOGLE_REFRESH_TOKEN",
                "secret": True,
            },
        ],
    },
    "gcal": {
        "label": "Google Calendar",
        "docs": "https://developers.google.com/calendar/api/guides/auth",
        "fields": [
            {"key": "client_id", "label": "OAuth client ID", "envVar": "GOOGLE_OAUTH_CLIENT_ID"},
            {
                "key": "client_secret",
                "label": "OAuth client secret",
                "envVar": "GOOGLE_OAUTH_CLIENT_SECRET",
                "secret": True,
            },
            {
                "key": "refresh_token",
                "label": "Refresh token",
                "envVar": "GOOGLE_REFRESH_TOKEN",
                "secret": True,
            },
        ],
    },
    "telegram": {
        "label": "Telegram",
        "docs": "https://core.telegram.org/bots/api#getme",
        "fields": [
            {
                "key": "bot_token",
                "label": "Bot token",
                "envVar": "TELEGRAM_BOT_TOKEN",
                "secret": True,
            }
        ],
    },
    "discord": {
        "label": "Discord",
        "docs": "https://discord.com/developers/docs/resources/user#get-current-user",
        "fields": [
            {
                "key": "bot_token",
                "label": "Bot token",
                "envVar": "DISCORD_BOT_TOKEN",
                "secret": True,
            }
        ],
    },
    "gemini": {
        "label": "Google Gemini",
        "docs": "https://ai.google.dev/gemini-api/docs/models",
        "fields": [
            {
                "key": "api_key",
                "label": "API key",
                "envVar": "GOOGLE_API_KEY",
                "secret": True,
            },
            {
                "key": "text_model",
                "label": "Text model ID",
                "envVar": "GEMINI_TEXT_MODEL",
                "placeholder": "gemini-2.5-flash",
            },
            {
                "key": "live_model",
                "label": "Live / voice model ID",
                "envVar": "GEMINI_LIVE_MODEL",
                "placeholder": "gemini-live-2.5-flash-preview",
                "optional": True,
            },
        ],
    },
}


def spec_for(provider: str) -> dict[str, Any]:
    spec = PROVIDER_SPECS.get(provider)
    if spec is None:
        raise CredentialError(f"Unknown provider '{provider}'.")
    return spec


def _mask(value: str) -> str:
    if not value:
        return ""
    tail = value[-4:] if len(value) > 8 else ""
    return f"••••{tail}"


def _env_values(provider: str) -> dict[str, str]:
    """The deployment-level values this workspace can fall back to."""
    if provider == "paypal":
        values = {
            "client_id": settings.paypal_client_id,
            "client_secret": settings.paypal_client_secret,
            "environment": settings.paypal_environment or "sandbox",
        }
    elif provider in {"gmail", "gcal"}:
        values = {
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "refresh_token": settings.google_refresh_token,
        }
    elif provider == "telegram":
        values = {"bot_token": settings.telegram_bot_token}
    elif provider == "discord":
        values = {"bot_token": settings.discord_bot_token}
    elif provider == "gemini":
        values = {
            "api_key": settings.google_api_key,
            "text_model": settings.gemini_text_model,
            "live_model": settings.gemini_live_model,
        }
    else:
        raise CredentialError(f"Unknown provider '{provider}'.")
    return {key: str(value or "") for key, value in values.items()}


def _row(session: Session, workspace_id: str, provider: str) -> ProviderCredential | None:
    return session.exec(
        select(ProviderCredential).where(
            ProviderCredential.workspace_id == workspace_id,
            ProviderCredential.provider == provider,
        )
    ).first()


def stored_values(
    session: Session, workspace_id: str, provider: str
) -> dict[str, str] | None:
    row = _row(session, workspace_id, provider)
    if row is None:
        return None
    try:
        payload = json.loads(decrypt_secret(row.ciphertext))
    except RuntimeError as exc:
        raise CredentialError(str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise CredentialError("Stored credentials are unreadable.") from exc
    return {str(key): str(value) for key, value in payload.items()}


def resolve_values(
    session: Session, workspace_id: str, provider: str
) -> tuple[dict[str, str], str | None]:
    """Workspace credentials first, then deployment environment values."""
    stored = stored_values(session, workspace_id, provider)
    if stored:
        return stored, "workspace"
    env_values = _env_values(provider)
    required = [field["key"] for field in spec_for(provider)["fields"] if not field.get("options") and not field.get("optional")]
    if all(env_values.get(key) for key in required):
        return env_values, "environment"
    return env_values, None


def credential_source(session: Session, workspace_id: str, provider: str) -> str | None:
    """Cheap badge value for the integrations list: where would a call get keys?"""
    if _row(session, workspace_id, provider) is not None:
        return "workspace"
    values = _env_values(provider)
    required = [field["key"] for field in spec_for(provider)["fields"] if not field.get("options") and not field.get("optional")]
    return "environment" if all(values.get(key) for key in required) else None


def credential_status(session: Session, workspace_id: str, provider: str) -> dict[str, Any]:
    spec = spec_for(provider)
    try:
        values, source = resolve_values(session, workspace_id, provider)
    except CredentialError:
        values, source = _env_values(provider), None
    row = _row(session, workspace_id, provider)
    fields = []
    for field in spec["fields"]:
        key = field["key"]
        value = values.get(key) or field.get("default", "")
        fields.append(
            {
                **field,
                "configured": bool(value),
                "preview": _mask(value) if field.get("secret") and value else None,
                "value": None if field.get("secret") else (value or None),
            }
        )
    required = [field["key"] for field in spec["fields"] if not field.get("options") and not field.get("optional")]
    return {
        "provider": provider,
        "label": spec["label"],
        "docs": spec["docs"],
        "fields": fields,
        "source": source,
        "configured": all(values.get(key) for key in required),
        "encryptionReady": bool(settings.app_encryption_key),
        "updatedAt": to_iso(row.updated_at) if row else None,
    }


def save_values(
    session: Session, workspace_id: str, provider: str, values: dict[str, str]
) -> ProviderCredential:
    spec = spec_for(provider)
    allowed = {field["key"] for field in spec["fields"]}
    cleaned = {
        key: str(value).strip()
        for key, value in values.items()
        if key in allowed and str(value).strip()
    }
    if not cleaned:
        raise CredentialError("Provide at least one credential value to save.")

    # Merge with what is already stored so a user can rotate a single field
    # without retyping the rest.
    merged = dict(stored_values(session, workspace_id, provider) or {})
    merged.update(cleaned)
    required = [field["key"] for field in spec["fields"] if not field.get("options") and not field.get("optional")]
    missing = [field["key"] for field in spec["fields"] if field["key"] in required and not merged.get(field["key"])]
    if missing:
        labels = [field["label"] for field in spec["fields"] if field["key"] in missing]
        raise CredentialError(f"Missing required credentials: {', '.join(labels)}.")

    if not settings.app_encryption_key:
        raise CredentialError(
            "APP_ENCRYPTION_KEY is not set on the backend, so credentials cannot be "
            "encrypted. Add it to backend/.env and restart the API."
        )

    ciphertext = encrypt_secret(json.dumps(merged, sort_keys=True))
    row = _row(session, workspace_id, provider)
    if row is None:
        row = ProviderCredential(
            id=f"pc-{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            provider=provider,
            ciphertext=ciphertext,
        )
    else:
        row.ciphertext = ciphertext
        row.updated_at = utcnow()
    session.add(row)
    session.commit()
    session.refresh(row)
    log.info(
        "provider_credentials_saved",
        workspace_id=workspace_id,
        provider=provider,
        fields=sorted(cleaned),
    )
    return row


def clear_values(session: Session, workspace_id: str, provider: str) -> bool:
    spec_for(provider)
    row = _row(session, workspace_id, provider)
    if row is None:
        return False
    session.delete(row)
    session.commit()
    log.info("provider_credentials_cleared", workspace_id=workspace_id, provider=provider)
    return True


# --------------------------------------------------------------------------- #
# Live verification                                                           #
# --------------------------------------------------------------------------- #


def _provider_error(response: httpx.Response, provider: str) -> str:
    """A readable message that never contains a credential."""
    detail = ""
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            detail = str(error.get("message") or error.get("error_description") or "")
        elif error:
            detail = str(payload.get("error_description") or error)
        detail = detail or str(payload.get("description") or payload.get("message") or "")
    snippet = detail.strip()[:180]
    suffix = f" — {snippet}" if snippet else ""
    return f"{provider} rejected these credentials (HTTP {response.status_code}){suffix}."


def _verify_paypal(values: dict[str, str]) -> str:
    environment = (values.get("environment") or "sandbox").lower()
    base = "https://api-m.paypal.com" if environment == "live" else "https://api-m.sandbox.paypal.com"
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.post(
            f"{base}/v1/oauth2/token",
            auth=(values["client_id"], values["client_secret"]),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "PayPal"))
        payload = response.json()
    if not payload.get("access_token"):
        raise CredentialError("PayPal returned no access token for these credentials.")
    app_id = str(payload.get("app_id") or values["client_id"])[:8]
    return f"PayPal {environment} app {app_id}… authenticated"


def _google_access_token(values: dict[str, str]) -> str:
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": values["client_id"],
                "client_secret": values["client_secret"],
                "refresh_token": values["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Google"))
        payload = response.json()
    token = payload.get("access_token")
    if not token:
        raise CredentialError("Google returned no access token for this refresh token.")
    return str(token)


def _verify_gmail(values: dict[str, str]) -> str:
    token = _google_access_token(values)
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Gmail"))
        payload = response.json()
    return f"Gmail reachable for {payload.get('emailAddress') or 'the authorized account'}"


def _verify_gcal(values: dict[str, str]) -> str:
    token = _google_access_token(values)
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Google Calendar"))
        payload = response.json()
    return f"Google Calendar reachable: {payload.get('summary') or payload.get('id') or 'primary'}"


def _verify_telegram(values: dict[str, str]) -> str:
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(f"https://api.telegram.org/bot{values['bot_token']}/getMe")
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Telegram"))
        payload = response.json()
    if not payload.get("ok"):
        raise CredentialError("Telegram rejected the bot token.")
    username = (payload.get("result") or {}).get("username")
    return f"Telegram bot @{username} authenticated" if username else "Telegram bot authenticated"


def _verify_gemini(values: dict[str, str]) -> str:
    """Validate the key and the exact model capabilities from Google's own list."""
    headers = {"x-goog-api-key": values["api_key"]}
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            params={"pageSize": 1000},
            headers=headers,
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Google Gemini"))
        payload = response.json()

    models = {
        str(model.get("name", "")).removeprefix("models/"): model
        for model in payload.get("models", [])
    }
    text_id = values["text_model"].removeprefix("models/")
    text_model = models.get(text_id)
    if text_model is None:
        raise CredentialError(
            f"Model '{text_id}' is not available to this API key. "
            "Pick a model ID from the provider's model list."
        )
    text_methods = text_model.get("supportedGenerationMethods") or []
    if "generateContent" not in text_methods:
        raise CredentialError(
            f"Model '{text_id}' does not support generateContent, so it cannot answer chat."
        )

    detail = f"Gemini key valid · {text_id} supports generateContent"
    live_id = values.get("live_model", "").removeprefix("models/")
    if live_id:
        live_model = models.get(live_id)
        if live_model is None:
            raise CredentialError(f"Live model '{live_id}' is not available to this API key.")
        live_methods = live_model.get("supportedGenerationMethods") or []
        # A name containing "live" proves nothing; ask the API.
        if "bidiGenerateContent" not in live_methods:
            raise CredentialError(
                f"Model '{live_id}' does not advertise bidiGenerateContent, so voice is "
                "not supported by it. Text chat still works."
            )
        detail += f" · {live_id} supports bidiGenerateContent (voice)"
    return detail


def _verify_discord(values: dict[str, str]) -> str:
    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        response = client.get(
            "https://discord.com/api/v10/users/@me",
            headers={"Authorization": f"Bot {values['bot_token']}"},
        )
        if response.status_code != 200:
            raise CredentialError(_provider_error(response, "Discord"))
        payload = response.json()
    name = payload.get("username") or payload.get("id")
    return f"Discord bot {name} authenticated"


_VERIFIERS = {
    "gemini": _verify_gemini,
    "paypal": _verify_paypal,
    "gmail": _verify_gmail,
    "gcal": _verify_gcal,
    "telegram": _verify_telegram,
    "discord": _verify_discord,
}


def verify_provider(provider: str, values: dict[str, str]) -> dict[str, Any]:
    """Make one read-only call to the provider and report exactly what happened."""
    spec_for(provider)
    missing = [
        field["label"]
        for field in PROVIDER_SPECS[provider]["fields"]
        if not field.get("options") and not field.get("optional") and not values.get(field["key"])
    ]
    if missing:
        return {
            "ok": False,
            "detail": f"Missing credentials: {', '.join(missing)}.",
            "identity": None,
            "checkedAt": to_iso(utcnow()),
        }
    try:
        identity = _VERIFIERS[provider](values)
    except CredentialError as exc:
        log.warning("provider_verification_failed", provider=provider, reason=str(exc))
        return {
            "ok": False,
            "detail": str(exc),
            "identity": None,
            "checkedAt": to_iso(utcnow()),
        }
    except httpx.HTTPError as exc:
        log.warning("provider_verification_unreachable", provider=provider, error=type(exc).__name__)
        return {
            "ok": False,
            "detail": f"Could not reach {PROVIDER_SPECS[provider]['label']} ({type(exc).__name__}). Nothing was sent.",
            "identity": None,
            "checkedAt": to_iso(utcnow()),
        }
    log.info("provider_verification_ok", provider=provider)
    return {
        "ok": True,
        "detail": identity,
        "identity": identity,
        "checkedAt": to_iso(utcnow()),
    }
