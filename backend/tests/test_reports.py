"""Reports: generation from real records, preview, PDF, and empty workspaces."""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import _provision
from app.models import Report
from app.services.reports import build_report_pdf, report_preview


def test_list_reports_returns_stored_reports(api):
    response = api.get("/api/v1/reports")
    assert response.status_code == 200
    reports = response.json()["reports"]
    assert len(reports) == 3
    assert {report["status"] for report in reports} <= {"draft", "sent", "failed"}


def test_preview_prefers_stored_records(api):
    response = api.post(
        "/api/v1/reports/preview", json={"project_id": "p-northwind", "include_narrative": False}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] == "p-northwind"
    assert body["facts"], "a seeded project must produce record-backed facts"
    assert any("INV-1042" in fact for fact in body["facts"])
    assert body["empty"] is False


def test_preview_without_project_covers_the_workspace(api):
    response = api.post("/api/v1/reports/preview", json={"include_narrative": False})
    assert response.status_code == 200
    body = response.json()
    assert body["projectId"] is None
    assert any("NORTHWIND" in fact or "Northwind" in fact for fact in body["facts"])


def test_creating_a_report_fills_an_empty_summary_from_records(api):
    response = api.post(
        "/api/v1/reports",
        json={"project_id": "p-fjord", "title": "Fjord update", "period": "November 2026"},
    )
    assert response.status_code == 201
    report = response.json()["report"]
    assert report["summary"], "the backend must not store a blank summary"
    assert report["projectId"] == "p-fjord"
    stored = api.get("/api/v1/reports").json()["reports"]
    assert any(row["id"] == report["id"] for row in stored)


def test_report_pdf_download(api):
    response = api.get("/api/v1/reports/rep-2/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 1000


def test_empty_workspace_reports_are_honest():
    with Session(engine) as session:
        principal = _provision(
            session, {"sub": "user_empty_reports", "given_name": "Empty", "family_name": "Space"}
        )
        preview = report_preview(
            session,
            principal.workspace_id,
            project_id=None,
            period=None,
            include_narrative=False,
        )
        assert preview["empty"] is True
        assert preview["facts"] == []
        assert "no projects" in preview["summary"].lower()

        # A workspace with no projects has no report to download either.
        assert session.exec(
            select(Report).where(Report.workspace_id == principal.workspace_id)
        ).all() == []


def test_pdf_renders_for_a_project_with_no_records():
    with Session(engine) as session:
        principal = _provision(
            session, {"sub": "user_pdf_empty", "given_name": "Pdf", "family_name": "Empty"}
        )
        client_id = "c-test"
        from app.models import Client, Project

        session.add(
            Client(
                id=client_id,
                workspace_id=principal.workspace_id,
                name="Test",
                company="Test Co",
                email="test@example.com",
                initials="TC",
            )
        )
        project = Project(
            id="p-test-pdf",
            workspace_id=principal.workspace_id,
            client_id=client_id,
            name="Bare project",
            codename="BARE",
        )
        session.add(project)
        report = Report(
            id="rep-empty-pdf",
            workspace_id=principal.workspace_id,
            title="Bare project report",
            project_id=project.id,
            client_id=client_id,
            period="November 2026",
            summary="No records yet.",
        )
        session.add(report)
        session.commit()

        pdf = build_report_pdf(
            report=report, project=project, client=session.get(Client, client_id),
            workspace=None, facts=[],
        )
        assert pdf.startswith(b"%PDF")
