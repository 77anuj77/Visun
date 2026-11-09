"""Source-backed report building and PDF rendering.

Every figure in a report comes from rows this workspace owns: milestones,
invoices, and scope findings. Nothing is templated from sample data, and a
workspace with no records produces an honest empty report instead of invented
numbers. PDFs are rendered with ReportLab, no browser or headless runtime.
"""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlmodel import Session, select

from ..models import Client, Invoice, Milestone, Project, Report, ScopeFinding, Workspace
from ..timeutil import to_iso


def project_facts(
    session: Session, project: Project
) -> tuple[list[str], dict[str, list[dict[str, Any]]]]:
    """Facts and citations for one project, read straight from its rows."""
    milestones = session.exec(
        select(Milestone).where(Milestone.project_id == project.id).order_by(Milestone.due_at)
    ).all()
    invoices = session.exec(
        select(Invoice).where(Invoice.project_id == project.id).order_by(Invoice.due_at)
    ).all()
    findings = session.exec(
        select(ScopeFinding)
        .where(ScopeFinding.project_id == project.id)
        .order_by(ScopeFinding.received_at.desc())
    ).all()

    facts: list[str] = []
    for row in milestones:
        if row.status == "done":
            facts.append(f"Completed {row.title} (due {row.due_at:%d %b %Y}).")
    for invoice in invoices:
        amount = invoice.amount_cents / 100
        paid = invoice.amount_paid_cents / 100
        if invoice.status == "paid":
            facts.append(f"{invoice.number} paid in full (${amount:,.2f}).")
        elif invoice.status == "draft":
            facts.append(f"{invoice.number} remains a draft; nothing was sent.")
        else:
            facts.append(
                f"{invoice.number}: ${amount:,.2f} billed, ${paid:,.2f} received, "
                f"status {invoice.status}."
            )
    for finding in findings:
        facts.append(
            f"Scope finding '{finding.title}' is {finding.review_state} "
            f"(clause {finding.clause_id})."
        )

    sources = {
        "milestones": [
            {"kind": "Milestone", "id": row.id, "label": row.title} for row in milestones
        ],
        "invoices": [
            {"kind": "Invoice", "id": row.id, "label": row.number} for row in invoices
        ],
        "findings": [
            {"kind": "Scope finding", "id": row.id, "label": row.title} for row in findings
        ],
    }
    return facts, sources


def workspace_facts(session: Session, workspace_id: str) -> list[str]:
    """A workspace-wide report reads every project, not a hardcoded one."""
    projects = session.exec(select(Project).where(Project.workspace_id == workspace_id)).all()
    facts: list[str] = []
    for project in projects:
        project_lines, _ = project_facts(session, project)
        if project_lines:
            facts.append(f"{project.name}: {project.progress}% complete.")
            facts.extend(f"  {line}" for line in project_lines)
    return facts


def default_period(created_at: datetime | None = None) -> str:
    stamp = created_at or datetime.now()
    return stamp.strftime("%B %Y")


def report_preview(
    session: Session,
    workspace_id: str,
    *,
    project_id: str | None,
    period: str | None,
    include_narrative: bool,
) -> dict[str, Any]:
    """Build the facts a report would contain, without persisting it."""
    workspace = session.get(Workspace, workspace_id)
    project = session.get(Project, project_id) if project_id else None
    if project_id and (project is None or project.workspace_id != workspace_id):
        raise LookupError("Project not found in this workspace.")

    if project is not None:
        facts, sources = project_facts(session, project)
        title = f"{project.codename or project.name} — progress report"
        client = session.get(Client, project.client_id)
        label = client.company if client else workspace.name if workspace else "Workspace"
        open_findings = len(
            [
                row
                for row in session.exec(
                    select(ScopeFinding).where(ScopeFinding.project_id == project.id)
                ).all()
                if row.review_state in {"potential", "reviewing"}
            ]
        )
        summary_template = (
            f"{project.name}: {project.progress}% complete. "
            f"{len(facts)} record-backed fact(s) included. "
            f"{open_findings} scope question(s) remain open."
        )
    else:
        facts = workspace_facts(session, workspace_id)
        sources = {}
        label = workspace.name if workspace else "Workspace"
        title = f"{label} — workspace report"
        summary_template = (
            f"{label}: {len(facts)} record-backed fact(s) across the workspace."
            if facts
            else f"{label} has no projects or invoices yet, so this report has no facts."
        )

    narrative = summary_template
    if include_narrative and settings_gemini_ready():
        narrative = _narrative(facts, label) or summary_template

    return {
        "sample": True,
        "projectId": project.id if project else None,
        "workspaceId": workspace_id,
        "label": label,
        "title": title,
        "period": period or default_period(),
        "facts": facts,
        "summary": narrative,
        "narrative": narrative if include_narrative else "",
        "sources": sources,
        "empty": not facts,
    }


def settings_gemini_ready() -> bool:
    from ..core.config import settings

    return bool(settings.google_api_key and settings.gemini_text_model)


def _narrative(facts: list[str], label: str) -> str:
    """Rephrase stored facts only. Failure returns empty so callers fall back."""
    from ..core.config import settings

    if not facts:
        return ""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=settings.gemini_text_model,
            contents=(
                f"Write a short client progress narrative for {label} using only these "
                "facts. Do not invent numbers or claims. Facts:\n" + "\n".join(facts)
            ),
            config=types.GenerateContentConfig(temperature=0.2),
        )
        return (response.text or "").strip()
    except Exception:  # noqa: BLE001 - narrative is optional, facts are not
        return ""


# --------------------------------------------------------------------------- #
# PDF                                                                         #
# --------------------------------------------------------------------------- #


def build_report_pdf(
    *,
    report: Report,
    project: Project | None,
    client: Client | None,
    workspace: Workspace | None,
    facts: list[str],
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=report.title,
        author="Visun",
    )
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#26241f"),
    )
    muted = ParagraphStyle("Muted", parent=body, fontSize=8.5, textColor=colors.HexColor("#6b665e"))
    heading = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        spaceBefore=10,
        spaceAfter=4,
        textColor=colors.HexColor("#1d1d1d"),
    )

    story: list[Any] = [
        Paragraph(escape(report.title), ParagraphStyle(
            "Title", parent=styles["Title"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, alignment=0, spaceAfter=2,
        )),
        Paragraph(
            escape(
                " · ".join(
                    part
                    for part in [
                        workspace.name if workspace else "",
                        client.company if client else "",
                        project.name if project else "",
                        report.period,
                    ]
                    if part
                )
            ),
            muted,
        ),
        Spacer(1, 4),
        HRFlowable(width="100%", color=colors.HexColor("#e2ddd3")),
        Paragraph("Source-backed facts", heading),
    ]
    if facts:
        story.append(
            Table(
                [[Paragraph(escape(fact), body)] for fact in facts],
                colWidths=[doc.width],
                style=TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ]
                ),
            )
        )
    else:
        story.append(Paragraph("No records were found for this report yet.", body))

    story.extend(
        [
            Paragraph("Summary", heading),
            Paragraph(escape(report.summary or "No narrative was generated."), body),
            Spacer(1, 8),
            Paragraph(
                escape(
                    f"Status: {report.status} · "
                    f"{'Provider message ' + report.provider_message_id if report.provider_message_id else 'Not delivered'} · "
                    f"Generated {to_iso(report.created_at)}"
                ),
                muted,
            ),
            Spacer(1, 4),
            Paragraph(
                "Generated by Visun from this workspace's stored records. "
                "Figures were not estimated.",
                muted,
            ),
        ]
    )
    doc.build(story)
    return buffer.getvalue()


__all__ = [
    "build_report_pdf",
    "default_period",
    "project_facts",
    "report_preview",
    "workspace_facts",
]
