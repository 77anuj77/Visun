from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models import ActionApproval, ActionEvent, ActivityEvent, utcnow


def test_health_reports_modes(api):
    response = api.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["authMode"] == "demo"
    assert body["providerMode"] == "simulated"
    assert body["providers"]["paypal"]["mode"] == "simulated"


def test_bootstrap_matches_demo_seed(api):
    response = api.get("/api/v1/bootstrap")
    assert response.status_code == 200
    body = response.json()
    assert body["workspace"]["id"] == "ws-paroha"
    assert body["state"]["version"] == 1
    assert len(body["reference"]["projects"]) == 5
    assert len(body["state"]["conversations"]) == 4
    assert len(body["state"]["leads"]) == 5


def test_dashboard_outstanding_is_grounded(api):
    response = api.get("/api/v1/dashboard")
    assert response.status_code == 200
    metrics = response.json()["metrics"]
    assert metrics["outstanding"] == 3200.0
    assert metrics["outstandingCount"] == 3
    assert metrics["activeProjects"] == 3


def test_scope_review_persists(api):
    response = api.patch(
        "/api/v1/scope-findings/sf-1", json={"review_state": "accepted"}
    )
    assert response.status_code == 200
    assert response.json()["finding"]["reviewState"] == "accepted"
    again = api.get("/api/v1/projects/p-northwind")
    finding = next(
        row for row in again.json()["scopeFindings"] if row["id"] == "sf-1"
    )
    assert finding["reviewState"] == "accepted"


def test_grounded_agent_uses_persisted_invoices(api):
    response = api.post(
        "/api/v1/agent/chat",
        json={"message": "What is unpaid on the Northwind project?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["backend"] == "deterministic"
    tool_names = {tool["name"] for tool in body["tools"]}
    assert "get_pending_payments" in tool_names
    assert "1,800" in body["message"]["text"]
    assert body["conversationId"].startswith("conv-")


def test_agent_prepares_reminder_without_sending(api):
    response = api.post(
        "/api/v1/agent/chat",
        json={"message": "Draft a reminder for the overdue Okafor invoice."},
    )
    assert response.status_code == 200
    body = response.json()
    action = body["action"]
    assert action is not None
    assert action["status"] == "pending_approval"
    assert action["simulated"] is False
    assert "not been sent" in body["message"]["text"]

    listed = api.get("/api/v1/actions").json()["actions"]
    stored = next(row for row in listed if row["id"] == action["id"])
    assert stored["status"] == "pending_approval"
    assert stored.get("providerId") is None


def test_approval_executes_once_and_is_idempotent(api):
    prepared = api.post(
        "/api/v1/actions/prepare",
        json={
            "kind": "email",
            "title": "Test reminder",
            "recipient": "daniel@okaforlegal.com",
            "subject": "Test reminder",
            "body": "Grounded body",
            "amount": 800,
            "currency": "USD",
            "provider": "Gmail",
        },
    )
    assert prepared.status_code == 201
    action = prepared.json()["action"]
    assert action["simulated"] is False

    approved = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": action["canonicalHash"]},
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["action"]["status"] == "succeeded"
    assert body["simulated"] is True
    assert body["action"]["providerId"].startswith("sim-gmail-")

    replay = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": action["canonicalHash"]},
    )
    assert replay.status_code == 200
    assert replay.json()["action"]["providerId"] == body["action"]["providerId"]

    with Session(engine) as session:
        stored = session.get(ActionApproval, action["id"])
        assert stored is not None
        assert stored.status == "completed"
        assert stored.simulated is True
        events = session.exec(
            select(ActionEvent).where(ActionEvent.action_id == action["id"])
        ).all()
        transitions = [(event.from_status, event.to_status) for event in events]
        assert ("draft", "pending_approval") in transitions
        assert ("executing", "completed") in transitions
        activity = session.exec(
            select(ActivityEvent).where(ActivityEvent.reference == action["id"])
        ).all()
        assert any("Simulated" in event.title for event in activity)


def test_approval_rejects_stale_hash(api):
    prepared = api.post(
        "/api/v1/actions/prepare",
        json={
            "kind": "email",
            "title": "Hash check",
            "recipient": "daniel@okaforlegal.com",
            "subject": "Hash check",
            "body": "Body",
            "provider": "Gmail",
        },
    )
    action = prepared.json()["action"]
    rejected = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": "not-the-hash"},
    )
    assert rejected.status_code == 409
    assert "hash" in rejected.json()["error"]["message"].lower()


def test_real_mode_without_credentials_fails_honestly(api, monkeypatch, demo_settings):
    monkeypatch.setattr(demo_settings, "provider_mode", "real")
    prepared = api.post(
        "/api/v1/actions/prepare",
        json={
            "kind": "email",
            "title": "Real provider check",
            "recipient": "daniel@okaforlegal.com",
            "subject": "Real provider check",
            "body": "Body",
            "provider": "Gmail",
        },
    )
    action = prepared.json()["action"]
    approved = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": action["canonicalHash"]},
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["action"]["status"] == "failed"
    assert body["action"]["simulated"] is False
    assert "not configured" in body["action"]["error"].lower()


def test_disconnected_provider_blocks_execution(api):
    prepared = api.post(
        "/api/v1/actions/prepare",
        json={
            "kind": "calendar",
            "title": "Deadline event",
            "recipient": "",
            "subject": "Deadline event",
            "body": "Add the launch deadline",
            "provider": "Google Calendar",
        },
    )
    action = prepared.json()["action"]
    approved = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": action["canonicalHash"]},
    )
    assert approved.status_code == 200
    body = approved.json()
    assert body["action"]["status"] == "failed"
    assert "not connected" in body["action"]["error"].lower()


def test_expired_approval_cannot_execute(api):
    prepared = api.post(
        "/api/v1/actions/prepare",
        json={
            "kind": "email",
            "title": "Expiry check",
            "recipient": "daniel@okaforlegal.com",
            "subject": "Expiry check",
            "body": "Body",
            "provider": "Gmail",
        },
    )
    action = prepared.json()["action"]
    with Session(engine) as session:
        stored = session.get(ActionApproval, action["id"])
        stored.expires_at = utcnow() - timedelta(minutes=1)
        session.add(stored)
        session.commit()
    approved = api.post(
        f"/api/v1/actions/{action['id']}/approve",
        json={"expected_hash": action["canonicalHash"]},
    )
    assert approved.status_code == 409
    assert "expired" in approved.json()["error"]["message"].lower()


def test_reports_preview_is_source_backed(api):
    response = api.post(
        "/api/v1/reports/preview",
        json={"project_id": "p-northwind", "include_narrative": False},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] == "p-northwind"
    assert any("INV-1044" in fact for fact in body["facts"])
    assert body["sources"]["milestones"]


def test_lead_create_and_update(api):
    created = api.post(
        "/api/v1/leads",
        json={
            "name": "Test Lead",
            "company": "Test Co",
            "email": "lead@example.com",
            "stage": "new",
            "value": 1200,
        },
    )
    assert created.status_code == 201
    lead = created.json()["lead"]
    updated = api.patch(
        f"/api/v1/leads/{lead['id']}", json={"stage": "qualified"}
    )
    assert updated.status_code == 200
    assert updated.json()["lead"]["stage"] == "qualified"


def test_webhooks_are_503_when_unconfigured(api):
    telegram = api.post("/api/v1/integrations/telegram/webhook", json={})
    assert telegram.status_code == 503
    paypal = api.post("/api/v1/integrations/paypal/webhook", json={})
    assert paypal.status_code == 503


def test_voice_transcript_uses_same_history(api):
    with api.websocket_connect("/api/v1/agent/voice") as socket:
        socket.send_json({})
        ready = socket.receive_json()
        assert ready["mode"] == "transcript"
        socket.send_json(
            {
                "type": "transcript",
                "text": "What is outstanding right now?",
            }
        )
        user = socket.receive_json()
        assert user["role"] == "user"
        while True:
            frame = socket.receive_json()
            if frame["type"] == "assistant":
                assert frame["message"]["role"] == "assistant"
                assert "3,200" in frame["message"]["text"]
                break
        socket.send_json({"type": "close"})


def test_tool_executions_are_persisted(api):
    api.post("/api/v1/agent/chat", json={"message": "How much is unpaid?"})
    response = api.get("/api/v1/tool-executions")
    assert response.status_code == 200
    rows = response.json()["toolExecutions"]
    assert any(row["tool"] == "get_pending_payments" for row in rows)
    assert all(row["status"] == "done" for row in rows)
