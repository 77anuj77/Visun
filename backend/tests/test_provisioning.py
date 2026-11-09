"""Workspace provisioning rules.

Only one verified email address (`SAMPLE_EMAIL`) keeps the sample dataset.
Every other account must start completely empty, and provisioning must never
overwrite records a user already owns.
"""

from __future__ import annotations

from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import _provision
from app.models import (
    ActivityEvent,
    Client,
    Conversation,
    Invoice,
    Lead,
    Preference,
    Project,
)
from app.seed import SAMPLE_CLERK_ID, SAMPLE_EMAIL, WORKSPACE_ID


def _claims(
    sub: str,
    given: str = "Test",
    family: str = "User",
    email: str | None = None,
) -> dict[str, str]:
    return {
        "sub": sub,
        "given_name": given,
        "family_name": family,
        "email": email or f"{sub}@example.com",
    }


def test_only_the_sample_account_receives_sample_records():
    with Session(engine) as session:
        sample = _provision(
            session, _claims(SAMPLE_CLERK_ID, "Ayush", email=SAMPLE_EMAIL)
        )


    with Session(engine) as session:
        projects = session.exec(
            select(Project).where(Project.workspace_id == sample.workspace_id)
        ).all()
        assert len(projects) == 5
        assert session.get(Preference, sample.workspace_id) is not None
        # Ids are namespaced, so a clone can never collide with the demo rows.
        demo_ids = {
            row.id
            for row in session.exec(
                select(Project).where(Project.workspace_id == WORKSPACE_ID)
            ).all()
        }
        assert not {project.id for project in projects} & demo_ids


def test_every_other_account_starts_empty():
    with Session(engine) as session:
        principal = _provision(session, _claims("user_brand_new_person"))

    with Session(engine) as session:
        workspace_id = principal.workspace_id
        for model in (Project, Invoice, Conversation, Lead, Client, ActivityEvent):
            rows = session.exec(
                select(model).where(model.workspace_id == workspace_id)
            ).all()
            assert rows == [], f"{model.__name__} should be empty for a new account"

        from app.api.system import bootstrap

        payload = bootstrap(session, principal)
        assert payload["reference"]["projects"] == []
        assert payload["state"]["leads"] == []
        assert payload["state"]["reports"] == []


def test_sample_seeding_is_idempotent():
    claims = _claims(SAMPLE_CLERK_ID, email=SAMPLE_EMAIL)
    with Session(engine) as session:
        first = _provision(session, claims)
        _provision(session, claims)
        count = len(
            session.exec(
                select(Project).where(Project.workspace_id == first.workspace_id)
            ).all()
        )
    assert count == 5


def test_provisioning_never_overwrites_existing_records():
    # An account that already added a project keeps exactly that project.
    with Session(engine) as session:
        principal = _provision(session, _claims("user_has_own_data"))

    with Session(engine) as session:
        session.add(
            Client(
                id=f"{principal.workspace_id}:c-own",
                workspace_id=principal.workspace_id,
                name="Own Client",
                company="Own Co",
                email="own@example.com",
                initials="OC",
            )
        )
        session.add(
            Project(
                id=f"{principal.workspace_id}:p-own",
                workspace_id=principal.workspace_id,
                client_id=f"{principal.workspace_id}:c-own",
                name="My own project",
                codename="OWN",
            )
        )
        session.commit()

        _provision(session, _claims("user_has_own_data"))
        rows = session.exec(
            select(Project).where(Project.workspace_id == principal.workspace_id)
        ).all()
        assert [row.name for row in rows] == ["My own project"]
