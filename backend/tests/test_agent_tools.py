"""Agent tools execute real writes inside one workspace; ADK falls back honestly."""

from __future__ import annotations

import pytest
from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import _provision
from app.models import ActionApproval, ActivityEvent, Lead, Milestone, Project, Report
from app.seed import SAMPLE_CLERK_ID, SAMPLE_EMAIL
from app.services.agent import AdkAgent, DeterministicAgent, configured_agent
from app.services.credentials import save_values
from app.services.workspace_tools import ToolDenied, build_tools


def _tools_by_name(session: Session, principal) -> dict:
    return {tool.__name__: tool for tool in build_tools(session, principal)}


def test_agent_creates_project_and_deadline_in_its_own_workspace():
    with Session(engine) as session:
        principal = _provision(
            session, {"sub": "user_agent_writes", "given_name": "Agent", "family_name": "Writer"}
        )
        tools = _tools_by_name(session, principal)

        created = tools["create_project"](
            "Website redesign", client_company="Rahul Studio", budget_usd=2400, due_date="2026-12-15"
        )
        assert created["ok"] is True
        project_id = created["project"]["id"]
        stored = session.get(Project, project_id)
        assert stored is not None and stored.workspace_id == principal.workspace_id

        deadline = tools["create_deadline"]("Website redesign", "Launch review", "2026-11-20")
        assert deadline["ok"] is True
        milestone = session.get(Milestone, deadline["deadline"]["id"])
        assert milestone is not None and milestone.project_id == project_id

        lead = tools["create_lead"]("Priya", company="Saffron", email="priya@example.com")
        assert lead["ok"] is True
        assert session.get(Lead, lead["lead"]["id"]) is not None

        report = tools["generate_report"]("Website redesign", "November 2026")
        assert report["ok"] is True
        assert session.get(Report, report["report"]["id"]) is not None

        summary = tools["workspace_summary"]()
        assert summary["projects"] == 1
        assert summary["leads"] == 1

        events = session.exec(
            select(ActivityEvent).where(ActivityEvent.workspace_id == principal.workspace_id)
        ).all()
        assert len(events) >= 4


def test_tools_cannot_cross_workspace_boundaries():
    with Session(engine) as session:
        owner = _provision(Session(engine), {"sub": "user_owner_ws", "given_name": "Owner"})
    with Session(engine) as session:
        other = _provision(Session(engine), {"sub": "user_other_ws", "given_name": "Other"})
        owner_tools = _tools_by_name(session, owner)
        owner_tools["create_project"]("Secret project", client_company="Owner Co")

        other_tools = _tools_by_name(session, other)
        assert other_tools["list_projects"]()["projects"] == []
        assert other_tools["workspace_summary"]()["projects"] == 0

        missing = other_tools["create_deadline"]("Secret project", "Nope", "2026-11-20")
        assert missing["ok"] is False
        assert "No project matching" in missing["error"]


def test_read_only_role_cannot_write():
    with Session(engine) as session:
        principal = _provision(
            session, {"sub": "user_reader", "given_name": "Read", "family_name": "Only"}
        )
        from dataclasses import replace

        reader = replace(principal, role="viewer")
        tools = _tools_by_name(session, reader)
        with pytest.raises(ToolDenied):
            tools["create_project"]("Blocked project")


def test_reminder_requires_approval_and_is_not_sent():
    with Session(engine) as session:
        principal = _provision(
            session,
            {
                "sub": SAMPLE_CLERK_ID,
                "given_name": "Ayush",
                "family_name": "P",
                "email": SAMPLE_EMAIL,
            },
        )
        tools = _tools_by_name(session, principal)
        from app.models import Invoice

        invoice = session.exec(
            select(Invoice).where(Invoice.workspace_id == principal.workspace_id)
        ).first()
        assert invoice is not None

        result = tools["prepare_payment_reminder"](invoice.number)
        assert result["ok"] is True
        assert result["requiresApproval"] is True
        action = session.get(ActionApproval, result["actionId"])
        assert action is not None
        assert action.status == "pending_approval"


def test_adk_agent_is_selected_only_with_workspace_credentials_and_falls_back(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "agent_backend", "auto")
    with Session(engine) as session:
        principal = _provision(
            session, {"sub": "user_adk_selection", "given_name": "Adk", "family_name": "User"}
        )
        assert isinstance(configured_agent(session, principal.workspace_id), DeterministicAgent)

        save_values(
            session,
            principal.workspace_id,
            "gemini",
            {"api_key": "test-key", "text_model": "gemini-2.5-flash", "live_model": ""},
        )
        agent = configured_agent(session, principal.workspace_id)
        assert isinstance(agent, AdkAgent)

        # Force the ADK runtime to fail: the answer must be the grounded
        # fallback with an explicit note, never a fabricated success.
        import app.services.adk_agent as adk_module

        def fail(**_: object):
            raise adk_module.AdkUnavailable("simulated failure")

        original = adk_module.run_adk
        adk_module.run_adk = fail
        try:
            reply = agent.respond(
                session=session,
                principal=principal,
                message="what needs my attention today?",
                project_id=None,
            )
        finally:
            adk_module.run_adk = original
        assert reply.backend == "deterministic"
        assert "could not be used" in reply.text
