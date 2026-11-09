"""Manual project and deadline editing must work with no integration connected.

The demo workspace ships with seeded records, but every case below writes only
what the person typed: no provider is contacted and no sample data is reused as
a stand-in for their own input.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.database import engine
from app.models import ActivityEvent, Milestone, Project


def _new_project(api, **overrides):
    payload = {
        "name": "Manual engagement",
        "client_name": "Rhea Kapoor",
        "client_company": "Kapoor Ceramics",
        "client_email": "rhea@kapoorceramics.test",
        "status": "active",
        "budget": 4200,
        "due_at": "2026-12-15",
        "description": "Hand-entered while no integration is connected.",
    }
    payload.update(overrides)
    return api.post("/api/v1/projects", json=payload)


def test_create_project_without_any_integration(api):
    response = _new_project(api)
    assert response.status_code == 201, response.text
    body = response.json()
    project = body["project"]
    client = body["client"]
    assert project["name"] == "Manual engagement"
    assert project["budget"] == 4200
    assert project["status"] == "active"
    assert client["company"] == "Kapoor Ceramics"
    assert client["initials"] == "KC"
    assert project["clientId"] == client["id"]

    snapshot = api.get("/api/v1/bootstrap").json()
    assert any(row["id"] == project["id"] for row in snapshot["reference"]["projects"])
    assert any(row["id"] == client["id"] for row in snapshot["reference"]["clients"])
    assert any(
        event["title"] == "Project created" and event["reference"] == project["id"]
        for event in snapshot["state"]["activities"]
    )


def test_create_project_requires_a_client(api):
    response = api.post("/api/v1/projects", json={"name": "No client"})
    assert response.status_code == 422


def test_create_project_reuses_an_existing_client(api):
    response = _new_project(api, client_id="c-northwind", client_name="", client_company="")
    assert response.status_code == 201, response.text
    assert response.json()["project"]["clientId"] == "c-northwind"


def test_update_project_edits_only_the_given_fields(api):
    created = _new_project(api).json()["project"]
    response = api.patch(
        f"/api/v1/projects/{created['id']}",
        json={"name": "Renamed engagement", "status": "paused", "budget": 5100},
    )
    assert response.status_code == 200, response.text
    updated = response.json()["project"]
    assert updated["name"] == "Renamed engagement"
    assert updated["status"] == "paused"
    assert updated["budget"] == 5100
    assert updated["description"] == created["description"]

    detail = api.get(f"/api/v1/projects/{created['id']}").json()["project"]
    assert detail["name"] == "Renamed engagement"


def test_milestone_create_update_delete(api):
    project = _new_project(api).json()["project"]
    created = api.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Send the staging link", "due_at": "2026-11-20T18:00:00+05:30"},
    )
    assert created.status_code == 201, created.text
    milestone = created.json()["milestone"]
    assert milestone["projectId"] == project["id"]
    assert milestone["status"] == "upcoming"

    with Session(engine) as session:
        stored = session.get(Milestone, milestone["id"])
        assert stored is not None

    edited = api.patch(
        f"/api/v1/milestones/{milestone['id']}",
        json={"title": "Send the staging link and notes", "due_at": "2026-11-22T09:00:00Z"},
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["milestone"]["title"] == "Send the staging link and notes"

    removed = api.delete(f"/api/v1/milestones/{milestone['id']}")
    assert removed.status_code == 200
    assert api.patch(f"/api/v1/milestones/{milestone['id']}", json={"title": "x"}).status_code == 404


def test_delete_project_removes_its_records(api):
    project = _new_project(api).json()["project"]
    milestone = api.post(
        f"/api/v1/projects/{project['id']}/milestones",
        json={"title": "Kickoff call", "due_at": "2026-11-25T10:00:00Z"},
    ).json()["milestone"]

    removed = api.delete(f"/api/v1/projects/{project['id']}")
    assert removed.status_code == 200, removed.text

    with Session(engine) as session:
        assert session.get(Project, project["id"]) is None
        assert session.get(Milestone, milestone["id"]) is None
        # Activity is history: kept, but detached from the deleted project.
        events = session.exec(
            select(ActivityEvent).where(ActivityEvent.reference == project["id"])
        ).all()
        assert events
        assert all(event.project_id is None for event in events)

    snapshot = api.get("/api/v1/bootstrap").json()
    assert all(row["id"] != project["id"] for row in snapshot["reference"]["projects"])
    assert all(
        row["projectId"] != project["id"] for row in snapshot["reference"]["milestones"]
    )
