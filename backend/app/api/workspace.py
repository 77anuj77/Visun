from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlmodel import Session, select

from ..core.config import settings
from ..core.security import PrincipalDep, SessionDep, WriterDep
from ..models import (
    ActivityEvent,
    Agreement,
    Client,
    ExternalMessage,
    IntegrationConnection,
    Invoice,
    Lead,
    Milestone,
    Payment,
    Preference,
    Project,
    Report,
    ScopeFinding,
    Workspace,
    utcnow,
)
from ..schemas import (
    ActionPrepare,
    ActivityCreate,
    AgreementChangeRequest,
    IntegrationCredentialsUpdate,
    LeadCreate,
    LeadUpdate,
    MilestoneCreate,
    MilestoneUpdate,
    PreferencesUpdate,
    ProjectCreate,
    ProjectUpdate,
    ReportCreate,
    ReportPreviewRequest,
    ScopeReviewRequest,
)
from ..serializers import (
    activity_out,
    client_message_out,
    client_out,
    finding_out,
    integration_out,
    invoice_out,
    lead_out,
    milestone_out,
    project_out,
    report_out,
)
from ..services.actions import prepare_action, record_activity
from ..services.credentials import (
    PROVIDER_SPECS,
    CredentialError,
    clear_values,
    credential_source,
    credential_status,
    resolve_values,
    save_values,
    verify_provider,
)
from ..services.providers import PayPalAdapter, ProviderError
from ..services.reports import (
    build_report_pdf,
    project_facts,
    report_preview,
    workspace_facts,
)
from ..timeutil import dollars, parse_dt, to_iso

router = APIRouter()


def _workspace_invoices(session: Session, workspace_id: str) -> list[Invoice]:
    return session.exec(
        select(Invoice).where(Invoice.workspace_id == workspace_id).order_by(Invoice.due_at)
    ).all()


def _outstanding(session: Session, workspace_id: str) -> list[Invoice]:
    return [
        invoice
        for invoice in _workspace_invoices(session, workspace_id)
        if invoice.status not in {"paid", "draft", "refunded"}
        and invoice.amount_cents > invoice.amount_paid_cents
    ]


@router.get("/dashboard", tags=["workspace"])
def dashboard(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    projects = session.exec(
        select(Project).where(Project.workspace_id == principal.workspace_id)
    ).all()
    outstanding = _outstanding(session, principal.workspace_id)
    findings = session.exec(
        select(ScopeFinding).where(
            ScopeFinding.workspace_id == principal.workspace_id,
            ScopeFinding.review_state.in_(["potential", "reviewing"]),  # type: ignore[attr-defined]
        )
    ).all()
    project_ids = [project.id for project in projects]
    horizon = utcnow() + timedelta(days=7)
    milestones = session.exec(
        select(Milestone)
        .where(Milestone.project_id.in_(project_ids))  # type: ignore[attr-defined]
        .where(Milestone.status != "done")
        .where(Milestone.due_at <= horizon)
        .order_by(Milestone.due_at)
    ).all()
    activities = session.exec(
        select(ActivityEvent)
        .where(ActivityEvent.workspace_id == principal.workspace_id)
        .order_by(ActivityEvent.at.desc())
        .limit(6)
    ).all()
    total_outstanding = sum(
        invoice.amount_cents - invoice.amount_paid_cents for invoice in outstanding
    )
    return {
        "sample": True,
        "metrics": {
            "activeProjects": sum(1 for project in projects if project.status == "active"),
            "totalProjects": len(projects),
            "outstanding": dollars(total_outstanding),
            "outstandingCount": len(outstanding),
            "openScopeFindings": len(findings),
            "deadlinesThisWeek": len(milestones),
            "currency": "USD",
        },
        "upcomingDeadlines": [milestone_out(milestone) for milestone in milestones],
        "scopeFindings": [finding_out(finding) for finding in findings],
        "recentActivity": [activity_out(event) for event in activities],
        "providerMode": settings.provider_mode,
    }


@router.get("/projects", tags=["projects"])
def list_projects(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    projects = session.exec(
        select(Project)
        .where(Project.workspace_id == principal.workspace_id)
        .order_by(Project.due_at)
    ).all()
    clients = {
        client.id: client
        for client in session.exec(
            select(Client).where(Client.workspace_id == principal.workspace_id)
        ).all()
    }
    return {
        "sample": True,
        "projects": [
            {
                "id": project.id,
                "clientId": project.client_id,
                "name": project.name,
                "codename": project.codename,
                "status": project.status,
                "description": project.description,
                "currency": project.currency,
                "budget": dollars(project.budget_cents),
                "paid": dollars(project.paid_cents),
                "dueAt": to_iso(project.due_at),
                "progress": project.progress,
                "health": project.health,
                "nextDeadlineId": project.next_deadline_id,
                "client": {
                    "name": clients[project.client_id].name,
                    "company": clients[project.client_id].company,
                }
                if project.client_id in clients
                else None,
            }
            for project in projects
        ],
    }


CLIENT_HUES = ["orange", "stone", "yellow", "ink"]


def _initials(*values: str) -> str:
    """Two initials from the first value that has any letters in it."""
    for value in values:
        parts = [part for part in value.split() if part]
        if parts:
            return "".join(part[0].upper() for part in parts[:2])
    return "VC"


def _project_in_workspace(
    session: Session, project_id: str, workspace_id: str
) -> Project:
    project = session.get(Project, project_id)
    if project is None or project.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Project not found in this workspace.")
    return project


@router.post("/projects", status_code=status.HTTP_201_CREATED, tags=["projects"])
def create_project(
    payload: ProjectCreate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    """Manual project entry. Works with no provider connected.

    An inline client is created when no `client_id` is supplied, so the very
    first project in an empty workspace needs no CRM or integration setup.
    """
    if not payload.client_id and not (
        payload.client_name.strip() and payload.client_company.strip()
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide an existing client, or a new client name and company.",
        )
    client: Client | None = None
    if payload.client_id:
        client = session.get(Client, payload.client_id)
        if client is None or client.workspace_id != principal.workspace_id:
            raise HTTPException(
                status_code=404, detail="Client not found in this workspace."
            )
    else:
        existing_clients = session.exec(
            select(Client).where(Client.workspace_id == principal.workspace_id)
        ).all()
        client = Client(
            id=f"c-{uuid.uuid4().hex[:10]}",
            workspace_id=principal.workspace_id,
            name=payload.client_name.strip(),
            company=payload.client_company.strip(),
            email=payload.client_email.strip(),
            initials=_initials(payload.client_company, payload.client_name),
            hue=CLIENT_HUES[len(existing_clients) % len(CLIENT_HUES)],
        )
        session.add(client)
    project = Project(
        id=f"p-{uuid.uuid4().hex[:10]}",
        workspace_id=principal.workspace_id,
        client_id=client.id,
        name=payload.name.strip(),
        codename=(payload.codename or payload.name).strip().upper()[:24],
        status=payload.status,
        description=payload.description.strip(),
        currency=payload.currency,
        budget_cents=round(payload.budget * 100),
        due_at=parse_dt(payload.due_at) if payload.due_at else utcnow() + timedelta(days=30),
    )
    session.add(project)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Project created",
        detail=f"{project.name} was added to the workspace manually.",
        status="success",
        reference=project.id,
        project_id=project.id,
    )
    session.commit()
    session.refresh(project)
    session.refresh(client)
    return {
        "project": project_out(project),
        "client": client_out(client),
        "sample": True,
    }


@router.patch("/projects/{project_id}", tags=["projects"])
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    project = _project_in_workspace(session, project_id, principal.workspace_id)
    if payload.client_id is not None:
        client = session.get(Client, payload.client_id)
        if client is None or client.workspace_id != principal.workspace_id:
            raise HTTPException(
                status_code=404, detail="Client not found in this workspace."
            )
        project.client_id = client.id
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.codename is not None:
        project.codename = payload.codename.strip() or project.name.upper()[:24]
    if payload.description is not None:
        project.description = payload.description.strip()
    if payload.status is not None:
        project.status = payload.status
    if payload.currency is not None:
        project.currency = payload.currency
    if payload.budget is not None:
        project.budget_cents = round(payload.budget * 100)
    if payload.due_at is not None:
        project.due_at = parse_dt(payload.due_at)
    session.add(project)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Project updated",
        detail=f"{project.name} was edited manually.",
        status="info",
        reference=project.id,
        project_id=project.id,
    )
    session.commit()
    session.refresh(project)
    return {"project": project_out(project), "sample": True}


@router.delete("/projects/{project_id}", tags=["projects"])
def delete_project(
    project_id: str, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    """Remove a project and the records that only exist because of it."""
    project = _project_in_workspace(session, project_id, principal.workspace_id)
    name = project.name
    deleted_id = project.id
    for model, column in (
        (Milestone, Milestone.project_id),
        (Agreement, Agreement.project_id),
        (ScopeFinding, ScopeFinding.project_id),
        (ExternalMessage, ExternalMessage.project_id),
        (Report, Report.project_id),
    ):
        for row in session.exec(select(model).where(column == project.id)).all():
            session.delete(row)
    invoices = session.exec(
        select(Invoice).where(Invoice.project_id == project.id)
    ).all()
    for invoice in invoices:
        for payment in session.exec(
            select(Payment).where(Payment.invoice_id == invoice.id)
        ).all():
            session.delete(payment)
        session.delete(invoice)
    # Activity stays as history, but it must not point at a deleted project.
    for event in session.exec(
        select(ActivityEvent).where(ActivityEvent.project_id == project.id)
    ).all():
        event.project_id = None
        session.add(event)
    session.delete(project)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Project deleted",
        detail=f"{name} and its milestones, invoices, and findings were removed from the workspace.",
        status="info",
        reference=deleted_id,
    )
    session.commit()
    return {"deleted": True, "id": deleted_id, "sample": True}


@router.post(
    "/projects/{project_id}/milestones",
    status_code=status.HTTP_201_CREATED,
    tags=["projects"],
)
def create_milestone(
    project_id: str,
    payload: MilestoneCreate,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    project = _project_in_workspace(session, project_id, principal.workspace_id)
    milestone = Milestone(
        id=f"m-{uuid.uuid4().hex[:10]}",
        project_id=project.id,
        title=payload.title.strip(),
        due_at=parse_dt(payload.due_at),
        status=payload.status,
        value_cents=round(payload.value * 100),
        acceptance=payload.acceptance.strip(),
    )
    session.add(milestone)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Deadline added",
        detail=f"{milestone.title} is due for {project.name}. Stored in this workspace only.",
        status="success",
        reference=milestone.id,
        project_id=project.id,
    )
    session.commit()
    session.refresh(milestone)
    return {"milestone": milestone_out(milestone), "sample": True}


@router.patch("/milestones/{milestone_id}", tags=["projects"])
def update_milestone(
    milestone_id: str,
    payload: MilestoneUpdate,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    milestone = session.get(Milestone, milestone_id)
    project = (
        session.get(Project, milestone.project_id) if milestone is not None else None
    )
    if (
        milestone is None
        or project is None
        or project.workspace_id != principal.workspace_id
    ):
        raise HTTPException(status_code=404, detail="Deadline not found.")
    if payload.title is not None:
        milestone.title = payload.title.strip()
    if payload.due_at is not None:
        milestone.due_at = parse_dt(payload.due_at)
    if payload.status is not None:
        milestone.status = payload.status
    if payload.value is not None:
        milestone.value_cents = round(payload.value * 100)
    if payload.acceptance is not None:
        milestone.acceptance = payload.acceptance.strip()
    session.add(milestone)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Deadline updated",
        detail=f"{milestone.title} was edited for {project.name}.",
        status="info",
        reference=milestone.id,
        project_id=project.id,
    )
    session.commit()
    session.refresh(milestone)
    return {"milestone": milestone_out(milestone), "sample": True}


@router.delete("/milestones/{milestone_id}", tags=["projects"])
def delete_milestone(
    milestone_id: str, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    milestone = session.get(Milestone, milestone_id)
    project = (
        session.get(Project, milestone.project_id) if milestone is not None else None
    )
    if (
        milestone is None
        or project is None
        or project.workspace_id != principal.workspace_id
    ):
        raise HTTPException(status_code=404, detail="Deadline not found.")
    title = milestone.title
    if project.next_deadline_id == milestone.id:
        project.next_deadline_id = ""
        session.add(project)
    session.delete(milestone)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Deadline removed",
        detail=f"{title} was removed from {project.name}.",
        status="info",
        reference=milestone_id,
        project_id=project.id,
    )
    session.commit()
    return {"deleted": True, "id": milestone_id, "sample": True}


@router.get("/projects/{project_id}", tags=["projects"])
def project_detail(
    project_id: str, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    project = session.get(Project, project_id)
    if project is None or project.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Project not found in this workspace.")
    clients = {
        client.id: client
        for client in session.exec(
            select(Client).where(Client.workspace_id == principal.workspace_id)
        ).all()
    }
    milestones = session.exec(
        select(Milestone)
        .where(Milestone.project_id == project.id)
        .order_by(Milestone.due_at)
    ).all()
    agreement = session.exec(
        select(Agreement).where(Agreement.project_id == project.id)
    ).first()
    findings = session.exec(
        select(ScopeFinding)
        .where(ScopeFinding.project_id == project.id)
        .order_by(ScopeFinding.received_at.desc())
    ).all()
    invoices = session.exec(
        select(Invoice).where(Invoice.project_id == project.id).order_by(Invoice.due_at)
    ).all()
    messages = session.exec(
        select(ExternalMessage)
        .where(ExternalMessage.project_id == project.id)
        .order_by(ExternalMessage.sent_at.desc())
    ).all()
    return {
        "sample": True,
        "project": {
            "id": project.id,
            "clientId": project.client_id,
            "name": project.name,
            "codename": project.codename,
            "status": project.status,
            "description": project.description,
            "currency": project.currency,
            "budget": dollars(project.budget_cents),
            "paid": dollars(project.paid_cents),
            "dueAt": to_iso(project.due_at),
            "progress": project.progress,
            "health": project.health,
            "nextDeadlineId": project.next_deadline_id,
        },
        "client": {
            "id": client.id,
            "name": client.name,
            "company": client.company,
            "email": client.email,
            "initials": client.initials,
            "hue": client.hue,
        }
        if (client := clients.get(project.client_id))
        else None,
        "milestones": [milestone_out(milestone) for milestone in milestones],
        "agreement": {
            "id": agreement.id,
            "projectId": agreement.project_id,
            "version": agreement.version,
            "effectiveAt": to_iso(agreement.effective_at),
            "file": agreement.file,
            "clauses": agreement.clauses,
        }
        if agreement
        else None,
        "scopeFindings": [finding_out(finding) for finding in findings],
        "invoices": [invoice_out(invoice) for invoice in invoices],
        "messages": [client_message_out(message) for message in messages],
    }


@router.patch("/scope-findings/{finding_id}", tags=["projects"])
def review_finding(
    finding_id: str,
    payload: ScopeReviewRequest,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    finding = session.get(ScopeFinding, finding_id)
    if finding is None or finding.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Scope finding not found.")
    previous = finding.review_state
    finding.review_state = payload.review_state
    session.add(finding)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="scope",
        actor="You",
        title=f"Finding {payload.review_state}",
        detail=f"{finding.title} moved from {previous} to {payload.review_state}.",
        status="success" if payload.review_state == "accepted" else "info",
        reference=finding.id,
        project_id=finding.project_id,
    )
    session.commit()
    session.refresh(finding)
    return {"finding": finding_out(finding), "sample": True}


@router.get("/deadlines", tags=["workspace"])
def deadlines(
    session: SessionDep,
    principal: PrincipalDep,
    days: int = Query(default=14, ge=1, le=365),
) -> dict[str, Any]:
    project_ids = [
        project.id
        for project in session.exec(
            select(Project).where(Project.workspace_id == principal.workspace_id)
        ).all()
    ]
    horizon = utcnow() + timedelta(days=days)
    rows = session.exec(
        select(Milestone)
        .where(Milestone.project_id.in_(project_ids))  # type: ignore[attr-defined]
        .where(Milestone.due_at <= horizon)
        .order_by(Milestone.due_at)
    ).all()
    return {"sample": True, "deadlines": [milestone_out(row) for row in rows]}


@router.get("/leads", tags=["leads"])
def list_leads(
    session: SessionDep,
    principal: PrincipalDep,
    date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> dict[str, Any]:
    rows = session.exec(
        select(Lead)
        .where(Lead.workspace_id == principal.workspace_id)
        .order_by(Lead.received_at.desc())
    ).all()
    if date:
        rows = [row for row in rows if row.received_at.date().isoformat() == date]
    return {"sample": True, "leads": [lead_out(row) for row in rows]}


@router.post("/leads", status_code=status.HTTP_201_CREATED, tags=["leads"])
def create_lead(
    payload: LeadCreate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    lead = Lead(
        id=f"lead-{uuid.uuid4().hex[:10]}",
        workspace_id=principal.workspace_id,
        name=payload.name,
        company=payload.company,
        email=str(payload.email),
        source=payload.source,
        stage=payload.stage,
        received_at=utcnow(),
        interest=payload.interest,
        next_action=payload.next_action or "Send an intro note",
        next_action_at=utcnow() + timedelta(days=1),
        value_cents=round(payload.value * 100),
    )
    session.add(lead)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Lead added",
        detail=f"{lead.name} ({lead.company}) entered as {lead.stage}.",
        status="success",
        reference=lead.id,
    )
    session.commit()
    session.refresh(lead)
    return {"lead": lead_out(lead), "sample": True}


@router.patch("/leads/{lead_id}", tags=["leads"])
def update_lead(
    lead_id: str, payload: LeadUpdate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    lead = session.get(Lead, lead_id)
    if lead is None or lead.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Lead not found.")
    if payload.stage is not None:
        lead.stage = payload.stage
    if payload.next_action is not None:
        lead.next_action = payload.next_action
    if payload.interest is not None:
        lead.interest = payload.interest
    session.add(lead)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="system",
        actor="You",
        title="Lead updated",
        detail=f"{lead.name} is now {lead.stage}.",
        status="info",
        reference=lead.id,
    )
    session.commit()
    session.refresh(lead)
    return {"lead": lead_out(lead), "sample": True}


@router.get("/payments/outstanding", tags=["payments"])
def outstanding_payments(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    invoices = _outstanding(session, principal.workspace_id)
    total = sum(invoice.amount_cents - invoice.amount_paid_cents for invoice in invoices)
    return {
        "sample": True,
        "providerMode": settings.provider_mode,
        "simulated": settings.provider_mode == "simulated",
        "totalOutstanding": dollars(total),
        "currency": "USD",
        "invoices": [invoice_out(invoice) for invoice in invoices],
    }


@router.post("/payments/recheck", tags=["payments"])
async def recheck_payments(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    invoices = _workspace_invoices(session, principal.workspace_id)
    updated: list[dict[str, Any]] = []
    if settings.provider_mode == "simulated":
        record_activity(
            session,
            workspace_id=principal.workspace_id,
            type="payment",
            actor="PayPal",
            title="Sandbox recheck (simulated)",
            detail=(
                f"{len(invoices)} invoice records read locally. No PayPal network call was made "
                "in simulated mode."
            ),
            status="info",
            reference="paypal-sync",
        )
        session.commit()
        return {
            "sample": True,
            "simulated": True,
            "checked": len(invoices),
            "updated": [],
            "message": "Simulated mode: local records only, no PayPal request made.",
        }
    adapter = PayPalAdapter()
    try:
        for invoice in invoices:
            if not invoice.provider_id:
                continue
            mapped = await adapter.fetch_invoice_status(invoice.provider_id)
            if mapped and mapped != invoice.status:
                invoice.status = mapped
                if mapped == "paid":
                    invoice.amount_paid_cents = invoice.amount_cents
                invoice.last_verified_at = utcnow()
                session.add(invoice)
                updated.append({"id": invoice.id, "status": mapped})
    except ProviderError as exc:
        session.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="payment",
        actor="PayPal",
        title="PayPal statuses verified",
        detail=f"{len(invoices)} invoice(s) checked with PayPal; {len(updated)} changed.",
        status="success",
        reference="paypal-sync",
    )
    session.commit()
    return {
        "sample": False,
        "simulated": False,
        "checked": len(invoices),
        "updated": updated,
        "message": f"Verified {len(invoices)} invoice(s) with PayPal.",
    }


@router.get("/reports", tags=["reports"])
def list_reports(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    reports = session.exec(
        select(Report)
        .where(Report.workspace_id == principal.workspace_id)
        .order_by(Report.created_at.desc())
    ).all()
    return {"sample": True, "reports": [report_out(report) for report in reports]}


@router.post("/reports/preview", tags=["reports"])
def preview_report(
    payload: ReportPreviewRequest, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    """Facts for a report, from this workspace only. Persists nothing."""
    try:
        return report_preview(
            session,
            principal.workspace_id,
            project_id=payload.project_id,
            period=payload.period,
            include_narrative=payload.include_narrative,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/reports", status_code=status.HTTP_201_CREATED, tags=["reports"])
def create_report(
    payload: ReportCreate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    project = session.get(Project, payload.project_id)
    if project is None or project.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Project not found in this workspace.")
    # An empty summary is filled from stored records rather than left blank, so a
    # report created by the agent or a direct API call is still source-backed.
    summary = payload.summary.strip()
    if not summary:
        summary = report_preview(
            session,
            principal.workspace_id,
            project_id=project.id,
            period=payload.period or None,
            include_narrative=False,
        )["summary"]
    report = Report(
        id=f"rep-{uuid.uuid4().hex[:10]}",
        workspace_id=principal.workspace_id,
        title=payload.title,
        project_id=project.id,
        client_id=project.client_id,
        period=payload.period,
        summary=summary,
        pages=payload.pages,
        status="draft",
    )
    session.add(report)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="report",
        actor="Visun",
        title="Report draft generated",
        detail=f"{report.title} was built from stored records. Not sent.",
        status="info",
        reference=report.id,
        project_id=report.project_id,
    )
    session.commit()
    session.refresh(report)
    return {"report": report_out(report), "sample": True}


@router.post("/reports/{report_id}/send", tags=["reports"])
def prepare_report_send(
    report_id: str, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    report = session.get(Report, report_id)
    if report is None or report.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Report not found.")
    client = session.get(Client, report.client_id)
    if client is None:
        raise HTTPException(status_code=409, detail="Report client is missing.")
    project = session.get(Project, report.project_id)
    body = (
        f"{report.title}\n{report.period}\n\n{report.summary}\n\n"
        f"Source-backed records: {project.progress if project else 0}% project progress. "
        "This message was prepared by Visun and requires explicit approval."
    )
    action = prepare_action(
        session,
        principal,
        ActionPrepare(
            kind="report",
            title=f"Send report: {report.title}",
            recipient=client.email,
            subject=report.title,
            body=body,
            provider="Gmail",
        ),
    )
    return {"action": {"id": action.id, "status": action.status, "canonicalHash": action.canonical_hash}, "sample": True}


@router.get("/reports/{report_id}/pdf", tags=["reports"])
def download_report_pdf(
    report_id: str, session: SessionDep, principal: PrincipalDep
) -> Response:
    """Render the stored report to PDF from this workspace's current records."""
    report = session.get(Report, report_id)
    if report is None or report.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Report not found.")
    project = session.get(Project, report.project_id)
    client = session.get(Client, report.client_id)
    workspace = session.get(Workspace, principal.workspace_id)
    facts = (
        project_facts(session, project)[0]
        if project is not None
        else workspace_facts(session, principal.workspace_id)
    )
    pdf = build_report_pdf(
        report=report,
        project=project,
        client=client,
        workspace=workspace,
        facts=facts,
    )
    stem = "".join(
        character if character.isalnum() or character in {"-", "_"} else "-"
        for character in report.title.lower()
    ).strip("-")[:60] or "report"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{stem}.pdf"'},    )


@router.get("/integrations", tags=["integrations"])
def list_integrations(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    integrations = session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.workspace_id == principal.workspace_id
        )
    ).all()
    items = []
    for row in integrations:
        item = integration_out(row)
        item["credentialSource"] = credential_source(
            session, principal.workspace_id, row.provider
        )
        items.append(item)
    return {
        "sample": True,
        "providerMode": settings.provider_mode,
        "integrations": items,
    }


@router.post("/integrations/{provider}/toggle", tags=["integrations"])
def toggle_integration(
    provider: str,
    connected: bool,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    integration = session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.workspace_id == principal.workspace_id,
            IntegrationConnection.provider == provider,
        )
    ).first()
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found.")
    if connected:
        if settings.provider_mode == "real" and provider in {"paypal", "gmail", "telegram", "gcal"}:
            configured = {
                "paypal": settings.paypal_configured,
                "gmail": settings.gmail_configured,
                "telegram": settings.telegram_configured,
                "gcal": settings.gcal_configured,
            }[provider]
            if not configured:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Real credentials are not configured. Connect the provider first.",
                )
        integration.connected = True
        integration.simulated = settings.provider_mode == "simulated"
        integration.last_sync = utcnow()
    else:
        integration.connected = False
        integration.simulated = False
        integration.last_sync = utcnow()
    session.add(integration)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="integration",
        actor="You",
        title=f"{integration.name} {'connected' if connected else 'disconnected'}",
        detail=(
            f"{integration.name} is now {'connected' if connected else 'disconnected'} "
            f"({'simulated' if integration.simulated else 'real'} mode)."
        ),
        status="success" if connected else "info",
        reference=integration.provider,
    )
    session.commit()
    session.refresh(integration)
    return {"integration": integration_out(integration), "sample": True}


def _reject_shared_demo(principal: PrincipalDep) -> None:
    """The publicly reachable demo workspace must never hold real secrets."""
    from ..seed import WORKSPACE_ID

    if principal.workspace_id == WORKSPACE_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Provider credentials are disabled in the shared demo workspace. "
                "Sign in to configure credentials for your own workspace."
            ),
        )


@router.get("/integrations/{provider}/credentials", tags=["integrations"])
def get_integration_credentials(
    provider: str, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    """Field-by-field status for a provider. Secrets are masked, never returned."""
    try:
        return credential_status(session, principal.workspace_id, provider)
    except CredentialError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/integrations/{provider}/credentials", tags=["integrations"])
def put_integration_credentials(
    provider: str,
    payload: IntegrationCredentialsUpdate,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    _reject_shared_demo(principal)
    try:
        save_values(session, principal.workspace_id, provider, payload.values)
        record_activity(
            session,
            workspace_id=principal.workspace_id,
            type="integration",
            actor="You",
            title=f"{PROVIDER_SPECS[provider]['label']} credentials saved",
            detail=(
                "Credentials were stored encrypted for this workspace. "
                "Run Test connection to verify them against the provider."
            ),
            status="info",
            reference=f"integration-{provider}",
        )
        return credential_status(session, principal.workspace_id, provider)
    except CredentialError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.delete("/integrations/{provider}/credentials", tags=["integrations"])
def delete_integration_credentials(
    provider: str, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    _reject_shared_demo(principal)
    try:
        removed = clear_values(session, principal.workspace_id, provider)
    except CredentialError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="integration",
        actor="You",
        title=f"{PROVIDER_SPECS[provider]['label']} credentials removed",
        detail="Stored credentials were deleted. Environment values, if any, still apply.",
        status="info",
        reference=f"integration-{provider}",
    )
    return {"removed": removed, **credential_status(session, principal.workspace_id, provider)}


@router.post("/integrations/{provider}/test", tags=["integrations"])
def test_integration(
    provider: str, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    """One read-only call to the provider using the resolved credentials."""
    try:
        values, source = resolve_values(session, principal.workspace_id, provider)
    except CredentialError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    result = verify_provider(provider, values)
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="integration",
        actor="Visun",
        title=(
            f"{PROVIDER_SPECS[provider]['label']} test {'passed' if result['ok'] else 'failed'}"
        ),
        detail=result["detail"],
        status="success" if result["ok"] else "failed",
        reference=f"integration-{provider}",
    )
    if result["ok"]:
        integration = session.exec(
            select(IntegrationConnection).where(
                IntegrationConnection.workspace_id == principal.workspace_id,
                IntegrationConnection.provider == provider,
            )
        ).first()
        if integration is not None:
            integration.last_sync = utcnow()
            session.add(integration)
            session.commit()
    return {
        "provider": provider,
        "source": source,
        **result,
    }


@router.get("/preferences", tags=["preferences"])
def get_preferences(session: SessionDep, principal: PrincipalDep) -> dict[str, Any]:
    from ..serializers import preferences_out

    return {
        "sample": True,
        "preferences": preferences_out(session.get(Preference, principal.workspace_id)),
    }


@router.patch("/preferences", tags=["preferences"])
def update_preferences(
    payload: PreferencesUpdate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    from ..serializers import preferences_out

    preference = session.get(Preference, principal.workspace_id)
    if preference is None:
        preference = Preference(workspace_id=principal.workspace_id, values={})
    values = dict(preference.values)
    for key, value in payload.model_dump(exclude_none=True).items():
        values[key] = value
    preference.values = values
    preference.updated_at = utcnow()
    session.add(preference)
    session.commit()
    return {"preferences": preferences_out(preference), "sample": True}


@router.get("/activities", tags=["activity"])
def list_activities(
    session: SessionDep,
    principal: PrincipalDep,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    from ..models import ActivityEvent

    events = session.exec(
        select(ActivityEvent)
        .where(ActivityEvent.workspace_id == principal.workspace_id)
        .order_by(ActivityEvent.at.desc())
        .limit(limit)
    ).all()
    return {"sample": True, "activities": [activity_out(event) for event in events]}


@router.post("/activities", status_code=status.HTTP_201_CREATED, tags=["activity"])
def create_activity(
    payload: dict, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    try:
        parsed = ActivityCreate.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    event = record_activity(
        session,
        workspace_id=principal.workspace_id,
        type=parsed.type,
        actor=parsed.actor,
        title=parsed.title,
        detail=parsed.detail,
        status=parsed.status,
        reference=parsed.reference,
        project_id=parsed.project_id,
    )
    session.commit()
    session.refresh(event)
    return {"activity": activity_out(event), "sample": True}


@router.post("/projects/{project_id}/agreements/{agreement_id}/propose-change", tags=["projects"])
def propose_agreement_change(
    project_id: str,
    agreement_id: str,
    payload: dict,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    from ..schemas import ActionPrepare

    project = session.get(Project, project_id)
    agreement = session.get(Agreement, agreement_id)
    if (
        project is None
        or agreement is None
        or project.workspace_id != principal.workspace_id
        or agreement.project_id != project.id
    ):
        raise HTTPException(status_code=404, detail="Agreement not found for this project.")
    try:
        change = AgreementChangeRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    action = prepare_action(
        session,
        principal,
        ActionPrepare(
            kind="agreement_change",
            title=f"Agreement change · {agreement.version} · {change.clause_id}",
            recipient="",
            subject=f"{project.name} — clause {change.clause_id}",
            body=change.proposed_text,
            provider="Internal",
        ),
    )
    return {"action": {"id": action.id, "status": action.status, "canonicalHash": action.canonical_hash}, "sample": True}


