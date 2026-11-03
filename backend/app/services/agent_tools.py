"""Grounded read tools shared by the deterministic and Gemini agents.

Every tool is workspace-scoped and returns both structured data and citation
metadata. No tool invents a figure; numbers come from persisted rows.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from sqlmodel import Session, select

from ..models import (
    ActionApproval,
    IntegrationConnection,
    Invoice,
    Lead,
    Milestone,
    Project,
    Report,
    ScopeFinding,
    utcnow,
)
from ..schemas import ActionPrepare
from ..timeutil import dollars, to_iso
from .actions import prepare_action


@dataclass(slots=True)
class ToolResult:
    name: str
    args: str
    status: str
    result: str
    data: dict[str, Any]
    sources: list[dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    error: str | None = None

    def frontend(self, index: int) -> dict[str, Any]:
        return {
            "id": f"tool-{index}",
            "name": self.name,
            "args": self.args,
            "status": self.status,
            "duration": f"{max(self.duration_ms, 1)}ms",
            "result": self.result,
        }


def _source(kind: str, label: str, identifier: str, checked_at: str | None = None) -> dict[str, Any]:
    return {
        "kind": kind,
        "label": label,
        "id": identifier,
        "checkedAt": checked_at or to_iso(utcnow()),
    }


def _timed(name: str, args: str, fn: Callable[[], tuple[dict[str, Any], list[dict[str, Any]], str]]) -> ToolResult:
    started = time.perf_counter()
    try:
        data, sources, summary = fn()
        status = "done"
        error = None
    except Exception as exc:  # noqa: BLE001 - tool failures are returned, not hidden
        data, sources, summary = {}, [], "Tool failed."
        status = "failed"
        error = str(exc)
    return ToolResult(
        name=name,
        args=args,
        status=status,
        result=summary,
        data=data,
        sources=sources,
        duration_ms=int((time.perf_counter() - started) * 1000),
        error=error,
    )


def open_invoices(session: Session, workspace_id: str, project_id: str | None = None) -> list[Invoice]:
    statement = select(Invoice).where(Invoice.workspace_id == workspace_id)
    if project_id:
        statement = statement.where(Invoice.project_id == project_id)
    rows = session.exec(statement.order_by(Invoice.due_at)).all()
    return [
        invoice
        for invoice in rows
        if invoice.status not in {"paid", "draft", "refunded"}
        and invoice.amount_cents > invoice.amount_paid_cents
    ]


def get_pending_payments(
    session: Session, workspace_id: str, project_id: str | None = None
) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        invoices = open_invoices(session, workspace_id, project_id)
        now = utcnow()
        rows = []
        for invoice in invoices:
            outstanding = invoice.amount_cents - invoice.amount_paid_cents
            rows.append(
                {
                    "id": invoice.id,
                    "number": invoice.number,
                    "projectId": invoice.project_id,
                    "amount": dollars(invoice.amount_cents),
                    "outstanding": dollars(outstanding),
                    "currency": invoice.currency,
                    "dueAt": to_iso(invoice.due_at),
                    "status": invoice.status,
                    "overdue": invoice.due_at < now,
                    "lastVerifiedAt": to_iso(invoice.last_verified_at),
                    "provider": invoice.provider,
                }
            )
        total = sum(row["outstanding"] or 0 for row in rows)
        sources = [
            _source(
                "Invoice",
                f"{row['number']} · ${row['outstanding']:.0f} · {row['status']}",
                row["id"],
                row["lastVerifiedAt"] or None,
            )
            for row in rows
        ]
        summary = f"{len(rows)} open invoice(s) · ${total:,.2f} USD outstanding"
        return {"invoices": rows, "totalOutstanding": round(total, 2)}, sources, summary

    return _timed(
        "get_pending_payments",
        f"project_id: {project_id or 'all'}",
        run,
    )


def get_deadlines(
    session: Session, workspace_id: str, days: int = 14, project_id: str | None = None
) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        project_ids = [
            row.id
            for row in session.exec(
                select(Project).where(Project.workspace_id == workspace_id)
            ).all()
        ]
        if project_id:
            project_ids = [project_id] if project_id in project_ids else []
        rows = session.exec(
            select(Milestone)
            .where(Milestone.project_id.in_(project_ids))  # type: ignore[attr-defined]
            .where(Milestone.status != "done")
            .order_by(Milestone.due_at)
        ).all()
        horizon = utcnow() + timedelta(days=days)
        upcoming = [milestone for milestone in rows if milestone.due_at <= horizon]
        names = {
            project.id: project.name
            for project in session.exec(
                select(Project).where(Project.id.in_(project_ids))  # type: ignore[attr-defined]
            ).all()
        }
        payload = [
            {
                "id": milestone.id,
                "projectId": milestone.project_id,
                "project": names.get(milestone.project_id, ""),
                "title": milestone.title,
                "dueAt": to_iso(milestone.due_at),
                "status": milestone.status,
                "value": dollars(milestone.value_cents),
            }
            for milestone in upcoming
        ]
        sources = [
            _source(
                "Milestone",
                f"{row['title']} · {row['dueAt'][:10]}",
                row["id"],
            )
            for row in payload
        ]
        summary = f"{len(upcoming)} deadline(s) in the next {days} days"
        return {"deadlines": payload}, sources, summary

    return _timed(
        "get_deadlines",
        f"days: {days}, project_id: {project_id or 'all'}",
        run,
    )


def detect_scope_changes(
    session: Session, workspace_id: str, project_id: str | None = None
) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        statement = select(ScopeFinding).where(ScopeFinding.workspace_id == workspace_id)
        if project_id:
            statement = statement.where(ScopeFinding.project_id == project_id)
        findings = session.exec(statement.order_by(ScopeFinding.received_at.desc())).all()
        rows = []
        sources = []
        for finding in findings:
            rows.append(
                {
                    "id": finding.id,
                    "projectId": finding.project_id,
                    "title": finding.title,
                    "classification": finding.classification,
                    "reviewState": finding.review_state,
                    "clauseId": finding.clause_id,
                    "confidence": finding.confidence,
                    "estimate": dollars(finding.estimate_cents),
                    "message": finding.message,
                }
            )
            sources.append(
                _source(
                    "Agreement clause",
                    f"{finding.clause_id} · {finding.title}",
                    finding.clause_id,
                    to_iso(finding.received_at),
                )
            )
        potential = [
            row
            for row in rows
            if row["classification"] == "potential_change" and row["reviewState"] == "potential"
        ]
        summary = (
            f"{len(potential)} potential change(s) needing review · "
            f"{len(rows)} finding(s) checked"
        )
        return {"findings": rows}, sources, summary

    return _timed("detect_scope_changes", f"project_id: {project_id or 'all'}", run)


def get_leads(session: Session, workspace_id: str) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        leads = session.exec(
            select(Lead)
            .where(Lead.workspace_id == workspace_id)
            .order_by(Lead.received_at.desc())
        ).all()
        rows = [
            {
                "id": lead.id,
                "name": lead.name,
                "company": lead.company,
                "stage": lead.stage,
                "value": dollars(lead.value_cents),
                "nextAction": lead.next_action,
                "nextActionAt": to_iso(lead.next_action_at),
            }
            for lead in leads
        ]
        sources = [
            _source("Lead", f"{row['name']} · {row['stage']}", row["id"]) for row in rows
        ]
        pipeline = sum(row["value"] or 0 for row in rows if row["stage"] != "won")
        summary = f"{len(rows)} lead(s) · ${pipeline:,.2f} open pipeline"
        return {"leads": rows, "openPipeline": round(pipeline, 2)}, sources, summary

    return _timed("get_leads", "all", run)


def get_reports(session: Session, workspace_id: str) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        reports = session.exec(
            select(Report)
            .where(Report.workspace_id == workspace_id)
            .order_by(Report.created_at.desc())
        ).all()
        rows = [
            {
                "id": report.id,
                "title": report.title,
                "status": report.status,
                "period": report.period,
                "simulated": report.simulated,
                "providerMessageId": report.provider_message_id,
            }
            for report in reports
        ]
        sources = [
            _source("Report", f"{row['title']} · {row['status']}", row["id"]) for row in rows
        ]
        summary = f"{len(rows)} report(s) · {sum(1 for row in rows if row['status'] == 'draft')} draft"
        return {"reports": rows}, sources, summary

    return _timed("get_reports", "all", run)


def get_integrations(session: Session, workspace_id: str) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        integrations = session.exec(
            select(IntegrationConnection).where(
                IntegrationConnection.workspace_id == workspace_id
            )
        ).all()
        rows = [
            {
                "id": row.provider,
                "name": row.name,
                "connected": row.connected,
                "simulated": row.simulated,
                "env": row.env,
                "lastSync": to_iso(row.last_sync),
            }
            for row in integrations
        ]
        sources = [
            _source("Integration", f"{row['name']} · {'connected' if row['connected'] else 'off'}", row["id"])
            for row in rows
        ]
        summary = f"{sum(1 for row in rows if row['connected'])} connected integration(s)"
        return {"integrations": rows}, sources, summary

    return _timed("get_integrations", "all", run)


def get_project_summary(
    session: Session, workspace_id: str, project_id: str | None = None
) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        statement = select(Project).where(Project.workspace_id == workspace_id)
        if project_id:
            statement = statement.where(Project.id == project_id)
        projects = session.exec(statement.order_by(Project.due_at)).all()
        rows = [
            {
                "id": project.id,
                "name": project.name,
                "status": project.status,
                "health": project.health,
                "progress": project.progress,
                "budget": dollars(project.budget_cents),
                "paid": dollars(project.paid_cents),
                "dueAt": to_iso(project.due_at),
            }
            for project in projects
        ]
        sources = [
            _source("Project", f"{row['name']} · {row['progress']}%", row["id"])
            for row in rows
        ]
        summary = f"{len(rows)} project(s) checked"
        return {"projects": rows}, sources, summary

    return _timed("get_project_summary", f"project_id: {project_id or 'all'}", run)


def draft_payment_reminder(
    session: Session,
    principal,
    invoice: Invoice,
    project: Project | None,
) -> ToolResult:
    def run() -> tuple[dict[str, Any], list[dict[str, Any]], str]:
        outstanding = invoice.amount_cents - invoice.amount_paid_cents
        days_overdue = max((utcnow() - invoice.due_at).days, 0)
        # Keep the message grounded in persisted values only.
        body = (
            "Hi,\n\n"
            f"A quick nudge on {invoice.number} for {project.name if project else 'the project'} — "
            f"{invoice.currency} {outstanding / 100:,.2f}, due {invoice.due_at:%d %B %Y}"
            + (" and now overdue" if days_overdue else "")
            + ".\n\n"
            f"The PayPal Sandbox invoice reference is {invoice.provider_id or invoice.number}. "
            "Happy to resend it if helpful.\n\nThanks,\nAyush"
        )
        existing = session.exec(
            select(ActionApproval).where(
                ActionApproval.workspace_id == principal.workspace_id,
                ActionApproval.kind == "email",
                ActionApproval.subject == f"Payment reminder — {invoice.number}",
                ActionApproval.status == "pending_approval",
            )
        ).first()
        if existing is not None:
            action = existing
        else:
            action = prepare_action(
                session,
                principal,
                ActionPrepare(
                    kind="email",
                    title=f"Payment reminder — {invoice.number}",
                    recipient=_client_email(session, invoice.client_id),
                    subject=f"Payment reminder — {invoice.number}",
                    body=body,
                    amount=outstanding / 100,
                    currency=invoice.currency,
                    provider="Gmail",
                ),
            )
        sources = [
            _source(
                "Invoice",
                f"{invoice.number} · ${outstanding / 100:,.2f} · due {invoice.due_at:%d %b}",
                invoice.id,
                to_iso(invoice.last_verified_at),
            )
        ]
        summary = f"Draft ready · awaiting approval · action {action.id}"
        return (
            {
                "invoice": invoice.id,
                "actionId": action.id,
                "amount": dollars(outstanding),
                "provider": action.provider,
                "simulated": action.simulated,
            },
            sources,
            summary,
        )

    return _timed("draft_payment_reminder", f"invoice_id: {invoice.id}", run)


def _client_email(session: Session, client_id: str) -> str:
    from ..models import Client

    client = session.get(Client, client_id)
    return client.email if client else ""
