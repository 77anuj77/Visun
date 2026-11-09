"""Workspace-bound tools the ADK agent can call.

Every function closes over the authenticated `Session` and `Principal`, so a
tool can only read or write the caller's workspace. Read tools are safe to run
automatically. Writes are ordinary local records (project, milestone, lead,
report) and are audited. Anything that leaves the building (email, payment
request, agreement change) goes through `prepare_action` and therefore waits for
an explicit approval — the model cannot approve its own action.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import Session, select

from ..models import (
    ActivityEvent,
    Client,
    Invoice,
    Lead,
    Milestone,
    Project,
    Report,
    ScopeFinding,
    User,
    utcnow,
)
from ..timeutil import dollars, parse_dt, to_iso
from .actions import record_activity
from .agent_tools import draft_payment_reminder, get_pending_payments
from .reports import project_facts, report_preview


class ToolDenied(RuntimeError):
    """The caller may not perform this write."""


def _require_writer(principal) -> None:
    if principal.role == "viewer":
        raise ToolDenied("This workspace role is read-only.")


def _find_project(session: Session, workspace_id: str, name: str) -> Project | None:
    needle = (name or "").strip().lower()
    if not needle:
        return None
    projects = session.exec(select(Project).where(Project.workspace_id == workspace_id)).all()
    for project in projects:
        if needle in project.name.lower() or needle in (project.codename or "").lower():
            return project
    return None


def _parse_date(value: str, timezone: str) -> datetime:
    text = (value or "").strip()
    if not text:
        raise ValueError("A date is required (YYYY-MM-DD or YYYY-MM-DDTHH:MM).")
    try:
        parsed = parse_dt(text)
    except Exception as exc:
        raise ValueError(f"'{value}' is not a date I can resolve.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=utcnow().tzinfo)
    return parsed


def _timezone(session: Session, principal) -> str:
    user = session.get(User, principal.user_id)
    return user.timezone if user and user.timezone else "Asia/Kolkata"


def build_tools(session: Session, principal) -> list[Any]:
    """Return ADK-compatible callables bound to this session and principal."""
    workspace_id = principal.workspace_id

    def workspace_summary() -> dict[str, Any]:
        """Summarize the workspace: projects, outstanding money, deadlines, leads."""
        projects = session.exec(
            select(Project).where(Project.workspace_id == workspace_id)
        ).all()
        invoices = session.exec(
            select(Invoice).where(Invoice.workspace_id == workspace_id)
        ).all()
        leads = session.exec(select(Lead).where(Lead.workspace_id == workspace_id)).all()
        milestones = session.exec(
            select(Milestone).where(
                Milestone.project_id.in_([project.id for project in projects] or [""])
            )
        ).all()
        outstanding = sum(
            invoice.amount_cents - invoice.amount_paid_cents
            for invoice in invoices
            if invoice.status in {"sent", "overdue", "partially_paid"}
        )
        upcoming = sorted(
            (row for row in milestones if row.status != "done"), key=lambda row: row.due_at
        )[:5]
        return {
            "ok": True,
            "projects": len(projects),
            "activeProjects": sum(1 for project in projects if project.status == "active"),
            "outstanding": dollars(outstanding),
            "openInvoices": sum(
                1
                for invoice in invoices
                if invoice.status in {"sent", "overdue", "partially_paid"}
            ),
            "leads": len(leads),
            "nextDeadlines": [
                {"title": row.title, "dueAt": to_iso(row.due_at)} for row in upcoming
            ],
        }

    def list_projects() -> dict[str, Any]:
        """List this workspace's projects with progress, budget, and due date."""
        projects = session.exec(
            select(Project).where(Project.workspace_id == workspace_id).order_by(Project.due_at)
        ).all()
        return {
            "ok": True,
            "projects": [
                {
                    "id": project.id,
                    "name": project.name,
                    "codename": project.codename,
                    "status": project.status,
                    "progress": project.progress,
                    "budget": dollars(project.budget_cents),
                    "paid": dollars(project.paid_cents),
                    "dueAt": to_iso(project.due_at),
                }
                for project in projects
            ],
        }

    def create_project(
        name: str,
        client_company: str = "",
        client_email: str = "",
        budget_usd: float = 0,
        due_date: str = "",
    ) -> dict[str, Any]:
        """Create a project (and its client if new). Use ISO dates like 2026-11-20."""
        _require_writer(principal)
        company = (client_company or name).strip()
        client = session.exec(
            select(Client).where(
                Client.workspace_id == workspace_id, Client.company == company
            )
        ).first()
        if client is None:
            client = Client(
                id=f"c-{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                name=company,
                company=company,
                email=client_email or "",
                initials="".join(part[0] for part in company.split()[:2]).upper() or "CL",
            )
            session.add(client)
            session.flush()
        project = Project(
            id=f"p-{uuid.uuid4().hex[:10]}",
            workspace_id=workspace_id,
            client_id=client.id,
            name=name.strip(),
            codename=(name.strip().split()[0] if name.strip() else "Project").upper(),
            budget_cents=round(max(budget_usd, 0) * 100),
            due_at=_parse_date(due_date, _timezone(session, principal))
            if due_date
            else utcnow(),
        )
        session.add(project)
        record_activity(
            session,
            workspace_id=workspace_id,
            type="project",
            actor="Visun",
            title=f"Project created · {project.name}",
            detail=f"Created by the agent for {client.company}.",
            status="success",
            reference=project.id,
            project_id=project.id,
        )
        session.commit()
        session.refresh(project)
        return {
            "ok": True,
            "project": {
                "id": project.id,
                "name": project.name,
                "client": client.company,
                "dueAt": to_iso(project.due_at),
            },
        }

    def list_deadlines(days: int = 14) -> dict[str, Any]:
        """List upcoming milestones and deadlines for the next N days."""
        projects = session.exec(
            select(Project).where(Project.workspace_id == workspace_id)
        ).all()
        by_id = {project.id: project for project in projects}
        rows = session.exec(
            select(Milestone)
            .where(Milestone.project_id.in_(list(by_id) or [""]))
            .order_by(Milestone.due_at)
        ).all()
        horizon = utcnow().timestamp() + max(days, 1) * 86400
        upcoming = [
            {
                "id": row.id,
                "title": row.title,
                "project": by_id[row.project_id].name,
                "dueAt": to_iso(row.due_at),
                "status": row.status,
            }
            for row in rows
            if row.status != "done" and row.due_at.timestamp() <= horizon
        ]
        return {"ok": True, "deadlines": upcoming}

    def create_deadline(project_name: str, title: str, due_date: str) -> dict[str, Any]:
        """Add a deadline/milestone to a project. Dates are ISO (2026-11-20)."""
        _require_writer(principal)
        project = _find_project(session, workspace_id, project_name)
        if project is None:
            return {
                "ok": False,
                "error": f"No project matching '{project_name}' in this workspace.",
            }
        milestone = Milestone(
            id=f"m-{uuid.uuid4().hex[:10]}",
            project_id=project.id,
            title=title.strip(),
            due_at=_parse_date(due_date, _timezone(session, principal)),
        )
        session.add(milestone)
        record_activity(
            session,
            workspace_id=workspace_id,
            type="project",
            actor="Visun",
            title=f"Deadline added · {milestone.title}",
            detail=f"Due {to_iso(milestone.due_at)} on {project.name}.",
            status="success",
            reference=milestone.id,
            project_id=project.id,
        )
        session.commit()
        session.refresh(milestone)
        return {
            "ok": True,
            "deadline": {
                "id": milestone.id,
                "title": milestone.title,
                "project": project.name,
                "dueAt": to_iso(milestone.due_at),
            },
        }

    def outstanding_payments() -> dict[str, Any]:
        """List unpaid invoices and the total outstanding amount."""
        tool = get_pending_payments(session, workspace_id)
        return {"ok": True, **tool.data}

    def list_leads() -> dict[str, Any]:
        """List leads in the pipeline with stage and next action."""
        leads = session.exec(
            select(Lead).where(Lead.workspace_id == workspace_id).order_by(Lead.received_at)
        ).all()
        return {
            "ok": True,
            "leads": [
                {
                    "id": lead.id,
                    "name": lead.name,
                    "company": lead.company,
                    "stage": lead.stage,
                    "value": dollars(lead.value_cents),
                    "nextAction": lead.next_action,
                }
                for lead in leads
            ],
        }

    def create_lead(
        name: str, company: str = "", email: str = "", interest: str = ""
    ) -> dict[str, Any]:
        """Add a lead to the pipeline."""
        _require_writer(principal)
        lead = Lead(
            id=f"l-{uuid.uuid4().hex[:10]}",
            workspace_id=workspace_id,
            name=name.strip(),
            company=company.strip(),
            email=email.strip(),
            source="Agent",
            interest=interest.strip(),
        )
        session.add(lead)
        record_activity(
            session,
            workspace_id=workspace_id,
            type="lead",
            actor="Visun",
            title=f"Lead added · {lead.name}",
            detail=f"{lead.company or 'No company'} · stage {lead.stage}.",
            status="success",
            reference=lead.id,
        )
        session.commit()
        session.refresh(lead)
        return {"ok": True, "lead": {"id": lead.id, "name": lead.name, "stage": lead.stage}}

    def list_scope_findings() -> dict[str, Any]:
        """List client messages flagged as possible scope changes."""
        findings = session.exec(
            select(ScopeFinding).where(ScopeFinding.workspace_id == workspace_id)
        ).all()
        return {
            "ok": True,
            "findings": [
                {
                    "id": row.id,
                    "title": row.title,
                    "reviewState": row.review_state,
                    "classification": row.classification,
                    "projectId": row.project_id,
                }
                for row in findings
            ],
        }

    def list_reports() -> dict[str, Any]:
        """List report drafts and their delivery status."""
        reports = session.exec(
            select(Report).where(Report.workspace_id == workspace_id).order_by(Report.created_at)
        ).all()
        return {
            "ok": True,
            "reports": [
                {
                    "id": report.id,
                    "title": report.title,
                    "period": report.period,
                    "status": report.status,
                    "projectId": report.project_id,
                }
                for report in reports
            ],
        }

    def generate_report(project_name: str = "", period: str = "") -> dict[str, Any]:
        """Create a report draft from stored records for a project (or the workspace)."""
        _require_writer(principal)
        project = _find_project(session, workspace_id, project_name) if project_name else None
        if project_name and project is None:
            return {
                "ok": False,
                "error": f"No project matching '{project_name}' in this workspace.",
            }
        preview = report_preview(
            session,
            workspace_id,
            project_id=project.id if project else None,
            period=period or None,
            include_narrative=False,
        )
        if project is None:
            return {
                "ok": False,
                "error": "Name a project so the report can be stored against it.",
                "preview": preview,
            }
        report = Report(
            id=f"rep-{uuid.uuid4().hex[:10]}",
            workspace_id=workspace_id,
            title=preview["title"],
            project_id=project.id,
            client_id=project.client_id,
            period=preview["period"],
            summary=preview["summary"],
            pages=max(1, (len(preview["facts"]) + 5) // 6),
            status="draft",
        )
        session.add(report)
        record_activity(
            session,
            workspace_id=workspace_id,
            type="report",
            actor="Visun",
            title="Report draft generated",
            detail=f"{report.title} built from {len(preview['facts'])} stored fact(s). Not sent.",
            status="info",
            reference=report.id,
            project_id=project.id,
        )
        session.commit()
        session.refresh(report)
        return {
            "ok": True,
            "report": {
                "id": report.id,
                "title": report.title,
                "period": report.period,
                "facts": len(preview["facts"]),
                "status": report.status,
            },
        }

    def prepare_payment_reminder(invoice_number: str) -> dict[str, Any]:
        """Prepare (not send) a reminder for an unpaid invoice; needs approval."""
        _require_writer(principal)
        invoice = session.exec(
            select(Invoice).where(
                Invoice.workspace_id == workspace_id, Invoice.number == invoice_number
            )
        ).first()
        if invoice is None:
            return {"ok": False, "error": f"Invoice {invoice_number} was not found."}
        project = session.get(Project, invoice.project_id)
        tool = draft_payment_reminder(session, principal, invoice, project)
        if tool.error:
            return {"ok": False, "error": tool.error}
        return {
            "ok": True,
            "requiresApproval": True,
            "actionId": tool.data.get("actionId"),
            "invoice": invoice.number,
            "amount": tool.data.get("amount"),
        }

    def list_activity(limit: int = 10) -> dict[str, Any]:
        """Recent audit events for this workspace."""
        events = session.exec(
            select(ActivityEvent)
            .where(ActivityEvent.workspace_id == workspace_id)
            .order_by(ActivityEvent.at.desc())
        ).all()[: max(1, min(limit, 50))]
        return {
            "ok": True,
            "activity": [
                {"title": event.title, "at": to_iso(event.at), "status": event.status}
                for event in events
            ],
        }

    return [
        workspace_summary,
        list_projects,
        create_project,
        list_deadlines,
        create_deadline,
        outstanding_payments,
        list_leads,
        create_lead,
        list_scope_findings,
        list_reports,
        generate_report,
        prepare_payment_reminder,
        list_activity,
    ]


__all__ = ["ToolDenied", "build_tools", "project_facts"]
