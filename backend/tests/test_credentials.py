"""Provider credentials from Settings: encryption, masking, verification.

Verification itself is monkeypatched here — the suite must never call a real
provider API — but everything around it is exercised for real: encryption at
rest, per-workspace isolation, masked reads, the demo-workspace guard, and the
honest failure path.
"""

from __future__ import annotations

import json

import pytest
from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import _provision
from app.models import ProviderCredential
from app.services import credentials


@pytest.fixture
def workspace():
    claims = {"sub": "user_credentials_account", "given_name": "Cred", "family_name": "Tester"}
    with Session(engine) as session:
        principal = _provision(session, claims)
    return principal


def test_credentials_are_encrypted_and_masked(workspace):
    with Session(engine) as session:
        status = credentials.save_values(
            session,
            workspace.workspace_id,
            "telegram",
            {"bot_token": "123456:super-secret-token"},
        )
        assert status.provider == "telegram"

        row = session.exec(
            select(ProviderCredential).where(
                ProviderCredential.workspace_id == workspace.workspace_id,
                ProviderCredential.provider == "telegram",
            )
        ).one()
        assert "super-secret-token" not in row.ciphertext

        stored = credentials.stored_values(session, workspace.workspace_id, "telegram")
        assert stored == {"bot_token": "123456:super-secret-token"}

        view = credentials.credential_status(session, workspace.workspace_id, "telegram")
        assert view["configured"] is True
        assert view["source"] == "workspace"
        field = view["fields"][0]
        assert field["value"] is None
        assert field["preview"].endswith("oken")
        assert "super-secret-token" not in json.dumps(view)


def test_credentials_are_workspace_scoped(workspace):
    other = _provision(
        Session(engine), {"sub": "user_credentials_other", "given_name": "Other"}
    )
    with Session(engine) as session:
        credentials.save_values(
            session, workspace.workspace_id, "telegram", {"bot_token": "token-for-first"}
        )
        assert credentials.stored_values(session, other.workspace_id, "telegram") is None
        view = credentials.credential_status(session, other.workspace_id, "telegram")
        assert view["source"] != "workspace"


def test_partial_update_keeps_existing_values(workspace):
    with Session(engine) as session:
        credentials.save_values(
            session,
            workspace.workspace_id,
            "paypal",
            {"client_id": "client-abc", "client_secret": "secret-xyz"},
        )
        # Rotating one secret alone must not drop the rest of the config.
        credentials.save_values(
            session, workspace.workspace_id, "paypal", {"client_secret": "rotated-secret"}
        )
        assert credentials.stored_values(session, workspace.workspace_id, "paypal") == {
            "client_id": "client-abc",
            "client_secret": "rotated-secret",
        }

        # A first save without the required fields is refused with the labels.
        with pytest.raises(credentials.CredentialError) as exc:
            credentials.save_values(
                session, workspace.workspace_id, "gmail", {"refresh_token": "only-this"}
            )
        assert "OAuth client ID" in str(exc.value)


def test_verification_reports_provider_answers_and_errors(workspace, monkeypatch):
    calls: list[tuple[str, dict[str, str]]] = []

    def fake_telegram(values: dict[str, str]) -> str:
        calls.append(("telegram", values))
        return "Telegram bot @visun_bot authenticated"

    def fake_gmail(values: dict[str, str]) -> str:
        calls.append(("gmail", values))
        raise credentials.CredentialError("Gmail rejected these credentials (HTTP 401).")

    monkeypatch.setattr(
        credentials, "_VERIFIERS", {"gmail": fake_gmail, "telegram": fake_telegram}
    )

    with Session(engine) as session:
        credentials.save_values(
            session, workspace.workspace_id, "telegram", {"bot_token": "abcdef123456"}
        )
        passed = credentials.verify_provider(
            "telegram", credentials.stored_values(session, workspace.workspace_id, "telegram") or {}
        )
        assert passed["ok"] is True
        assert "visun_bot" in passed["detail"]

        failed = credentials.verify_provider("gmail", {"client_id": "a", "client_secret": "b", "refresh_token": "c"})
        assert failed["ok"] is False
        assert "rejected" in failed["detail"]

    assert calls and calls[0][1]["bot_token"] == "abcdef123456"


def test_verification_without_credentials_is_honest():
    result = credentials.verify_provider("telegram", {})
    assert result["ok"] is False
    assert "Missing credentials" in result["detail"]


def test_shared_demo_workspace_cannot_store_secrets(api):
    response = api.put(
        "/api/v1/integrations/telegram/credentials",
        json={"values": {"bot_token": "should-not-be-stored"}},
    )
    assert response.status_code == 403
    body = response.json()
    message = body.get("detail") or (body.get("error") or {}).get("message", "")
    assert "demo workspace" in message
