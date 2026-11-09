"""Seed the demo workspace.

IDs intentionally match the frontend seed so the UI can swap between the local
fallback and this API without remapping relationships. Financial rows use cents.
"""

import hashlib
from typing import Any

from sqlmodel import Session, select

from .models import (
    ActionApproval,
    ActionEvent,
    ActivityEvent,
    Agreement,
    Client,
    Conversation,
    ConversationMessage,
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
    User,
    Workspace,
    WorkspaceMember,
)
from .services.hashing import canonical_payload, idempotency_key, payload_hash
from .timeutil import cents, parse_dt

DEMO_DATE = "2026-11-03"
DEMO_NOW = "2026-11-03T14:12:00+05:30"
WORKSPACE_ID = "ws-paroha"
USER_ID = "u-ayush"
CLERK_ID = "user_demo_ayush"

# The only signed-in account that keeps a populated workspace. Every other
# account starts empty: sample records are never injected into someone else's
# data. Match on the verified Clerk email rather than a Clerk id, because ids
# differ between Clerk instances while the owner's address stays stable.
SAMPLE_EMAIL = "anujparoha07@gmail.com"
# Kept for tests and older references that still identify the sample account.
SAMPLE_CLERK_ID = "user_3LdlhPMLYUPRYRxwuKHimR5nCK1"

# The credential-free "Open demo" workspace is a product sandbox, not a person.
DEMO_USER_NAME = "demo_user"
DEMO_USER_EMAIL = "demo_user@visun.demo"

d = parse_dt


# Tables copied into a newly provisioned workspace, parents first so the
# foreign keys below always resolve. Preference is handled separately because
# its primary key is `workspace_id`.
_CLONE_PLAN: list[tuple[type, str]] = [
    (Client, "workspace_id"),
    (Project, "workspace_id"),
    (Milestone, "project_id"),
    (Agreement, "project_id"),
    (Invoice, "workspace_id"),
    (Payment, "workspace_id"),
    (Lead, "workspace_id"),
    (ExternalMessage, "workspace_id"),
    (ScopeFinding, "workspace_id"),
    (Report, "workspace_id"),
    (Conversation, "workspace_id"),
    (ConversationMessage, "conversation_id"),
    (ActionApproval, "workspace_id"),
    (ActionEvent, "workspace_id"),
    (ActivityEvent, "workspace_id"),
    (IntegrationConnection, "workspace_id"),
]


def _remap_json(value: Any, mapping: dict[str, str]) -> Any:
    """Rewrite ids inside stored JSON (sources, tools, action) to the clone's ids."""
    if isinstance(value, str):
        return mapping.get(value, value)
    if isinstance(value, list):
        return [_remap_json(item, mapping) for item in value]
    if isinstance(value, dict):
        return {key: _remap_json(item, mapping) for key, item in value.items()}
    return value


def seed_workspace_from_demo(
    session: Session, *, workspace_id: str, user_id: str, user_name: str
) -> bool:
    """Copy the seeded demo dataset into a fresh workspace of the sample account.

    A brand-new Clerk account owns an empty workspace, which makes the signed-in
    product look broken (every screen is blank). Cloning the demo records keeps
    the first session useful while preserving per-account isolation: ids are
    namespaced per workspace and the demo workspace itself is never shared.
    """
    if workspace_id == WORKSPACE_ID:
        return False
    # Only untouched workspaces are filled. Any record the user already owns
    # (including one they created and later deleted back to zero) means the
    # sample dataset has had its chance, so the clone never re-appears.
    for model in (Project, Invoice, Conversation, ActivityEvent):
        if session.exec(select(model).where(model.workspace_id == workspace_id)).first():
            return False
    if not session.exec(select(Workspace).where(Workspace.id == WORKSPACE_ID)).first():
        seed_if_empty(session)

    prefix = f"{workspace_id}:"
    # Globally unique columns (invoice numbers, provider message ids) cannot be
    # copied verbatim, so they carry a short digest of the workspace instead of
    # a slice of its id, which two accounts could share.
    suffix = hashlib.sha1(workspace_id.encode("utf-8")).hexdigest()[:6]
    id_map: dict[str, str] = {USER_ID: user_id, CLERK_ID: user_id, WORKSPACE_ID: workspace_id}
    batches: list[tuple[type, list[Any]]] = []

    demo_project_ids = [
        pid
        for pid in session.exec(
            select(Project.id).where(Project.workspace_id == WORKSPACE_ID)
        ).all()
    ]
    demo_conversation_ids = [
        cid
        for cid in session.exec(
            select(Conversation.id).where(Conversation.workspace_id == WORKSPACE_ID)
        ).all()
    ]

    def _rows_for(model: type) -> list[Any]:
        columns = {column.name for column in model.__table__.columns}
        statement = select(model)
        if "workspace_id" in columns:
            statement = statement.where(model.workspace_id == WORKSPACE_ID)
        elif model is ConversationMessage:
            statement = statement.where(
                ConversationMessage.conversation_id.in_(demo_conversation_ids)
            )
        elif model in (Milestone, Agreement):
            statement = statement.where(model.project_id.in_(demo_project_ids))
        else:
            return []
        return list(session.exec(statement).all())

    # Pass 1: collect the source rows and reserve a namespaced id for each one.
    for model, _ in _CLONE_PLAN:
        rows = _rows_for(model)
        batches.append((model, rows))
        for row in rows:
            old_id = getattr(row, "id", None)
            if isinstance(old_id, str) and old_id not in id_map:
                id_map[old_id] = f"{prefix}{old_id}"

    # Pass 2: insert remapped copies.
    for model, rows in batches:
        columns = [column.name for column in model.__table__.columns]
        for row in rows:
            data: dict[str, Any] = {}
            for name in columns:
                value = getattr(row, name, None)
                if name == "id":
                    data[name] = id_map[getattr(row, "id", "")]
                elif name == "workspace_id":
                    data[name] = workspace_id
                elif isinstance(value, str):
                    data[name] = id_map.get(value, value)
                elif isinstance(value, (dict, list)):
                    data[name] = _remap_json(value, id_map)
                else:
                    data[name] = value
            if model is Invoice:
                data["number"] = f"{data['number']}-{suffix}"
            if model is ExternalMessage:
                data["source_message_id"] = (
                    f"{data['source_message_id']}:{suffix}"
                )
            if model is ActionApproval:
                data["canonical_hash"] = payload_hash(
                    canonical_payload(
                        kind=data["kind"],
                        recipient=data["recipient"],
                        subject=data["subject"],
                        body=data["body"],
                        amount_cents=data["amount_cents"],
                        currency=data["currency"],
                        provider=data["provider"],
                    )
                )
                data["idempotency_key"] = idempotency_key(
                    data["id"], data["canonical_hash"]
                )
            session.add(model(**data))
        session.flush()

    demo_pref = session.get(Preference, WORKSPACE_ID)
    if demo_pref is not None:
        values = dict(demo_pref.values)
        values["timezone"] = values.get("timezone", "Asia/Kolkata")
        session.add(Preference(workspace_id=workspace_id, values=values))

    session.add(
        ActivityEvent(
            id=f"{prefix}act-0",
            workspace_id=workspace_id,
            type="system",
            actor="Visun",
            title="Sample workspace prepared",
            detail=(
                f"Sample records were copied into {user_name}'s workspace so the "
                "first session has projects, invoices, and conversations to explore."
            ),
            at=parse_dt(DEMO_NOW),
            status="info",
            reference=None,
            project_id=None,
        )
    )
    session.commit()
    return True


def seed_if_empty(session: Session) -> bool:
    if session.exec(select(Workspace).where(Workspace.id == WORKSPACE_ID)).first():
        return False

    session.add(
        User(
            id=USER_ID,
            clerk_user_id=CLERK_ID,
            name=DEMO_USER_NAME,
            email=DEMO_USER_EMAIL,
            timezone="Asia/Kolkata",
        )
    )
    session.add(
        Workspace(
            id=WORKSPACE_ID,
            name="Paroha Studio",
            owner_user_id=USER_ID,
            timezone="Asia/Kolkata",
            plan="Solo workspace",
        )
    )
    session.add(
        WorkspaceMember(
            id="wm-ayush",
            workspace_id=WORKSPACE_ID,
            user_id=USER_ID,
            role="owner",
        )
    )
    # Flush the principal rows first so every foreign key below is satisfied on
    # both SQLite (enforced) and PostgreSQL.
    session.flush()

    clients = [
        Client(id="c-northwind", workspace_id=WORKSPACE_ID, name="Rahul Mehta", company="Northwind Labs", email="rahul@northwindlabs.com", initials="RM", hue="orange"),
        Client(id="c-fjord", workspace_id=WORKSPACE_ID, name="Maya Chen", company="Fjord Coffee", email="maya@fjordcoffee.co", initials="MC", hue="stone"),
        Client(id="c-okafor", workspace_id=WORKSPACE_ID, name="Daniel Okafor", company="Okafor Legal", email="daniel@okaforlegal.com", initials="DO", hue="yellow"),
        Client(id="c-saffron", workspace_id=WORKSPACE_ID, name="Priya Nair", company="Studio Saffron", email="priya@studiosaffron.in", initials="PN", hue="ink"),
        Client(id="c-waypoint", workspace_id=WORKSPACE_ID, name="Leo Martins", company="Waypoint Travel", email="leo@waypoint.travel", initials="LM", hue="stone"),
    ]
    session.add_all(clients)
    session.flush()

    projects = [
        Project(id="p-northwind", workspace_id=WORKSPACE_ID, client_id="c-northwind", name="Northwind website rebuild", codename="NORTHWIND / 01", status="active", description="Five-page marketing site built on the new design system, with launch QA before the investor update.", currency="USD", budget_cents=cents(4800), paid_cents=cents(2600), due_at=d("2026-11-12T18:00:00+05:30"), progress=64, health="at_risk", next_deadline_id="m-nw-3"),
        Project(id="p-fjord", workspace_id=WORKSPACE_ID, client_id="c-fjord", name="Fjord brand site + store", codename="FJORD / 02", status="active", description="Editorial brand site with a lightweight Shopify storefront and art direction for the winter drop.", currency="USD", budget_cents=cents(3200), paid_cents=cents(600), due_at=d("2026-11-20T18:00:00+05:30"), progress=38, health="on_track", next_deadline_id="m-fj-2"),
        Project(id="p-okafor", workspace_id=WORKSPACE_ID, client_id="c-okafor", name="Okafor client intake automation", codename="OKAFOR / 03", status="active", description="Intake workflow, billing handoff, and documentation for a boutique legal practice.", currency="USD", budget_cents=cents(2400), paid_cents=cents(1600), due_at=d("2026-11-30T18:00:00+05:30"), progress=74, health="on_track", next_deadline_id="m-ok-3"),
        Project(id="p-saffron", workspace_id=WORKSPACE_ID, client_id="c-saffron", name="Studio Saffron portfolio", codename="SAFFRON / 04", status="review", description="Portfolio redesign with a booking flow and a lightweight editorial CMS for case studies.", currency="USD", budget_cents=cents(1800), paid_cents=0, due_at=d("2026-12-04T18:00:00+05:30"), progress=26, health="on_track", next_deadline_id="m-sa-2"),
        Project(id="p-waypoint", workspace_id=WORKSPACE_ID, client_id="c-waypoint", name="Waypoint launch page", codename="WAYPOINT / 05", status="completed", description="Single-page launch site for the new itinerary product, delivered and paid in full.", currency="USD", budget_cents=cents(1200), paid_cents=cents(1200), due_at=d("2026-11-01T18:00:00+05:30"), progress=100, health="on_track", next_deadline_id="m-wa-1"),
    ]
    session.add_all(projects)
    session.flush()

    milestone_rows = [
        ("m-nw-1", "p-northwind", "Discovery & information architecture", "2026-10-24T18:00:00+05:30", "done", 800, "Signed sitemap and messaging outline approved by Rahul."),
        ("m-nw-2", "p-northwind", "Design system & page templates", "2026-10-30T18:00:00+05:30", "done", 1200, "Tokens, type scale, and five page templates in Figma."),
        ("m-nw-3", "p-northwind", "Marketing site build", "2026-11-06T18:00:00+05:30", "in_progress", 1600, "Five responsive pages, CMS-wired and reviewed on staging."),
        ("m-nw-4", "p-northwind", "Launch QA & handoff", "2026-11-12T18:00:00+05:30", "upcoming", 1200, "Cross-browser QA, accessibility pass, and Loom handoff."),
        ("m-fj-1", "p-fjord", "Art direction & moodboards", "2026-10-28T18:00:00+05:30", "done", 600, "Two signed directions for the winter campaign."),
        ("m-fj-2", "p-fjord", "Homepage design", "2026-11-07T18:00:00+05:30", "in_progress", 900, "Desktop and mobile homepage comps, ready for build."),
        ("m-fj-3", "p-fjord", "Store templates", "2026-11-14T18:00:00+05:30", "upcoming", 1100, "Product, collection, and cart templates connected to Shopify."),
        ("m-fj-4", "p-fjord", "Build & handoff", "2026-11-20T18:00:00+05:30", "upcoming", 600, "Staging review, launch checklist, and editor training."),
        ("m-ok-1", "p-okafor", "Automation audit", "2026-10-20T18:00:00+05:30", "done", 500, "Current intake steps mapped with time-per-step estimates."),
        ("m-ok-2", "p-okafor", "Client intake workflow", "2026-10-31T18:00:00+05:30", "done", 700, "Form, routing, and confirmation emails running in staging."),
        ("m-ok-3", "p-okafor", "Billing integration", "2026-11-06T18:00:00+05:30", "in_progress", 800, "Retainer invoices generated from accepted engagements."),
        ("m-ok-4", "p-okafor", "Documentation & handoff", "2026-11-30T18:00:00+05:30", "upcoming", 400, "Written runbook and a recorded walkthrough."),
        ("m-sa-1", "p-saffron", "Moodboard & direction", "2026-10-30T18:00:00+05:30", "done", 300, "One direction approved for the portfolio refresh."),
        ("m-sa-2", "p-saffron", "Portfolio design", "2026-11-10T18:00:00+05:30", "in_progress", 700, "Home, case study, and about pages in Figma."),
        ("m-sa-3", "p-saffron", "Booking flow", "2026-11-24T18:00:00+05:30", "upcoming", 500, "Cal.com booking embedded with timezone handling."),
        ("m-sa-4", "p-saffron", "Build & launch", "2026-12-04T18:00:00+05:30", "upcoming", 300, "Site live, analytics verified, and editor handoff recorded."),
        ("m-wa-1", "p-waypoint", "Launch page delivery", "2026-11-01T18:00:00+05:30", "done", 1200, "Page live, paid in full, and handoff complete."),
    ]
    for mid, pid, title, due, status, value, acceptance in milestone_rows:
        session.add(
            Milestone(
                id=mid,
                project_id=pid,
                title=title,
                due_at=d(due),
                status=status,
                value_cents=cents(value),
                acceptance=acceptance,
            )
        )
    session.flush()

    session.add_all(
        [
            Agreement(
                id="ag-northwind",
                project_id="p-northwind",
                version="v2.1",
                effective_at=d("2026-10-18T10:00:00+05:30"),
                file="northwind-sow-v2.1.pdf",
                clauses=[
                    {"id": "nw-c1", "label": "Scope", "kind": "included", "text": "Marketing site: five responsive pages (Home, About, Services, Work, Contact) built from the approved design system."},
                    {"id": "nw-c2", "label": "Revisions", "kind": "included", "text": "Two structured revision rounds after design approval, consolidated per round."},
                    {"id": "nw-c3", "label": "Launch QA", "kind": "included", "text": "Cross-browser QA on current Chrome, Safari, and Firefox, plus an accessibility pass."},
                    {"id": "nw-c4", "label": "Exclusion — accounts", "kind": "excluded", "text": "Authentication, user accounts, roles, and password flows are not included in this engagement."},
                    {"id": "nw-c5", "label": "Exclusion — payments", "kind": "excluded", "text": "Payment processing, checkout, subscriptions, and billing integrations are out of scope."},
                    {"id": "nw-c6", "label": "Exclusion — content", "kind": "excluded", "text": "CMS migration and copywriting beyond supplied content are not included."},
                    {"id": "nw-c7", "label": "Timeline", "kind": "included", "text": "Delivery target 12 November 2026, subject to content timeliness and consolidated feedback."},
                ],
            ),
            Agreement(
                id="ag-fjord",
                project_id="p-fjord",
                version="v1.3",
                effective_at=d("2026-10-12T10:00:00+05:30"),
                file="fjord-sow-v1.3.pdf",
                clauses=[
                    {"id": "fj-c1", "label": "Art direction", "kind": "included", "text": "Two art-direction routes for the winter campaign, one selected direction refined for web."},
                    {"id": "fj-c2", "label": "Homepage", "kind": "included", "text": "Editorial homepage with campaign storytelling, desktop and mobile layouts."},
                    {"id": "fj-c3", "label": "Store", "kind": "included", "text": "Shopify product, collection, and cart templates using the approved design system."},
                    {"id": "fj-c4", "label": "Revisions", "kind": "included", "text": "Two revision rounds; hero imagery swaps within the selected direction are included."},
                    {"id": "fj-c5", "label": "Exclusion — motion", "kind": "excluded", "text": "Custom video production, motion graphics, and paid media assets are out of scope."},
                ],
            ),
            Agreement(
                id="ag-okafor",
                project_id="p-okafor",
                version="v1.0",
                effective_at=d("2026-10-06T10:00:00+05:30"),
                file="okafor-sow-v1.0.pdf",
                clauses=[
                    {"id": "ok-c1", "label": "Audit", "kind": "included", "text": "Audit of the current client intake workflow, including time-per-step mapping."},
                    {"id": "ok-c2", "label": "Intake automation", "kind": "included", "text": "Intake form, routing rules, confirmations, and a simple staff dashboard."},
                    {"id": "ok-c3", "label": "Billing", "kind": "included", "text": "Retainer invoice generation from accepted engagements inside the provided billing tool."},
                    {"id": "ok-c4", "label": "Exclusion — accounting", "kind": "excluded", "text": "Third-party accounting sync, reconciliation, and bookkeeping services are not included."},
                ],
            ),
            Agreement(
                id="ag-saffron",
                project_id="p-saffron",
                version="v1.1",
                effective_at=d("2026-10-22T10:00:00+05:30"),
                file="saffron-sow-v1.1.pdf",
                clauses=[
                    {"id": "sa-c1", "label": "Portfolio", "kind": "included", "text": "Portfolio home, case study template, and about page using supplied copy."},
                    {"id": "sa-c2", "label": "Booking", "kind": "included", "text": "Booking page with an embedded scheduler and timezone-aware confirmation."},
                    {"id": "sa-c3", "label": "Design revisions", "kind": "included", "text": "One consolidated revision round after the first design presentation."},
                ],
            ),
        ]
    )
    session.flush()

    invoice_rows = [
        ("inv-1047", "INV-1047", "p-waypoint", "c-waypoint", 1200, 1200, "2026-10-26T10:00:00+05:30", "2026-11-01T18:00:00+05:30", "paid", "5O190127TN364715T", "2026-11-01T16:48:00+05:30", "Waypoint launch page — final balance."),
        ("inv-1045", "INV-1045", "p-okafor", "c-okafor", 800, 0, "2026-10-18T10:00:00+05:30", "2026-11-01T18:00:00+05:30", "overdue", "INV2-K7Y3-9P2M-4Q6A", "2026-11-03T09:02:00+05:30", "Intake workflow milestone — second payment."),
        ("inv-1044", "INV-1044", "p-northwind", "c-northwind", 1800, 0, "2026-10-28T10:00:00+05:30", "2026-11-15T18:00:00+05:30", "sent", "INV2-9F4D-2C8L-7R1B", "2026-11-03T09:02:00+05:30", "Marketing site build milestone."),
        ("inv-1043", "INV-1043", "p-fjord", "c-fjord", 1200, 600, "2026-10-20T10:00:00+05:30", "2026-11-10T18:00:00+05:30", "partially_paid", "INV2-H1X6-3M9V-8T5C", "2026-11-03T09:02:00+05:30", "Art direction + homepage design, split payment agreed by email."),
        ("inv-1042", "INV-1042", "p-northwind", "c-northwind", 1600, 1600, "2026-10-01T10:00:00+05:30", "2026-10-15T18:00:00+05:30", "paid", "1SW83199KA442331M", "2026-10-28T12:30:00+05:30", "Discovery + design system milestones."),
        ("inv-1046", "INV-1046", "p-saffron", "c-saffron", 1400, 0, "2026-11-03T09:40:00+05:30", "2026-11-17T18:00:00+05:30", "draft", "DRAFT-1046", None, "Portfolio design + booking flow. Draft only — not sent."),
    ]
    for iid, number, pid, cid, amount, paid, issued, due, status, provider_id, verified, note in invoice_rows:
        session.add(
            Invoice(
                id=iid,
                workspace_id=WORKSPACE_ID,
                number=number,
                project_id=pid,
                client_id=cid,
                amount_cents=cents(amount),
                amount_paid_cents=cents(paid),
                currency="USD",
                issued_at=d(issued),
                due_at=d(due),
                status=status,
                provider="PayPal Sandbox",
                provider_id=provider_id,
                last_verified_at=d(verified) if verified else None,
                note=note,
            )
        )
    session.flush()

    for pid, provider_id, amount, at, status in [
        ("inv-1047", "5O190127TN364715T", 1200, "2026-11-01T16:48:00+05:30", "COMPLETED"),
        ("inv-1042", "1SW83199KA442331M", 1600, "2026-10-28T12:30:00+05:30", "COMPLETED"),
        ("inv-1043", "INV2-H1X6-3M9V-8T5C", 600, "2026-11-01T12:10:00+05:30", "PARTIALLY_PAID"),
    ]:
        session.add(
            Payment(
                id=f"pay-{pid}",
                workspace_id=WORKSPACE_ID,
                invoice_id=pid,
                provider="PayPal Sandbox",
                provider_object_id=provider_id,
                provider_status=status,
                amount_cents=cents(amount),
                currency="USD",
                verified=True,
                simulated=True,
                event_at=d(at),
            )
        )
    session.flush()

    leads = [
        Lead(id="lead-1", workspace_id=WORKSPACE_ID, name="Nina Patel", company="Nina Patel Ceramics", email="hello@ninapatel.co", source="Referral — Maya Chen", stage="new", received_at=d("2026-11-03T09:20:00+05:30"), interest="Design system + four landing pages for a winter collection.", next_action="Send a scope questionnaire", next_action_at=d("2026-11-03T16:00:00+05:30"), value_cents=cents(3600)),
        Lead(id="lead-2", workspace_id=WORKSPACE_ID, name="Tom Alvarez", company="Alvarez Bikes", email="tom@alvarezbikes.com", source="Website form", stage="contacted", received_at=d("2026-11-03T08:05:00+05:30"), interest="Shopify storefront refresh before a spring launch.", next_action="Follow up with two case studies", next_action_at=d("2026-11-04T10:00:00+05:30"), value_cents=cents(5200)),
        Lead(id="lead-3", workspace_id=WORKSPACE_ID, name="Hana Kim", company="Field Notes Studio", email="hana@fieldnotes.studio", source="Telegram community", stage="qualified", received_at=d("2026-11-02T18:44:00+05:30"), interest="Ongoing design retainer, 10–15 hours per month.", next_action="Discovery call", next_action_at=d("2026-11-04T15:30:00+05:30"), value_cents=cents(2400)),
        Lead(id="lead-4", workspace_id=WORKSPACE_ID, name="Beacon Studio", company="Beacon Studio", email="studio@beacon.design", source="Referral — Rahul Mehta", stage="new", received_at=d("2026-11-02T11:10:00+05:30"), interest="White-label frontend build for a fintech launch.", next_action="Qualify timeline and budget", next_action_at=d("2026-11-05T11:00:00+05:30"), value_cents=cents(7800)),
        Lead(id="lead-5", workspace_id=WORKSPACE_ID, name="Arjun Rao", company="Rao & Co.", email="arjun@raoco.in", source="LinkedIn", stage="proposal", received_at=d("2026-10-30T13:25:00+05:30"), interest="Brand site and CMS migration for a consulting practice.", next_action="Proposal expires in 3 days", next_action_at=d("2026-11-06T13:25:00+05:30"), value_cents=cents(6400)),
    ]
    session.add_all(leads)
    session.flush()

    messages = [
        ("msg-1", "p-northwind", "Telegram", "Rahul Mehta", "client", "Can you also add login and a payment page? We need it before launch — the investor demo is on the 14th.", "2026-11-02T09:14:00+05:30", "Northwind project group · bot opted in by Rahul"),
        ("msg-2", "p-northwind", "Telegram", "Rahul Mehta", "client", "The footer feels long. Can we cut it to two lines and keep the newsletter?", "2026-10-31T11:20:00+05:30", "Northwind project group · bot opted in by Rahul"),
        ("msg-3", "p-northwind", "Telegram", DEMO_USER_NAME, "freelancer", "Design system is locked. Marketing build starts Monday — staging link will land Wednesday.", "2026-10-31T11:04:00+05:30", "Northwind project group · bot opted in by Rahul"),
        ("msg-4", "p-fjord", "Telegram", "Maya Chen", "client", "Can we swap the homepage hero to a short video loop instead of the still? Something moody, 6–8 seconds.", "2026-11-01T15:42:00+05:30", "Fjord winter drop group · opted in"),
        ("msg-5", "p-fjord", "Telegram", DEMO_USER_NAME, "freelancer", "Yes — send the loop as an MP4 and I’ll wire it in. Keep it under 8 seconds so the mobile load stays quick.", "2026-11-01T16:02:00+05:30", "Fjord winter drop group · opted in"),
        ("msg-6", "p-okafor", "Email", "Daniel Okafor", "client", "The intake flow is working well. Billing is the last piece before we can roll it out to the team.", "2026-11-02T16:40:00+05:30", "Imported email thread · 2 messages"),
        ("msg-7", "p-okafor", "Telegram", "Daniel Okafor", "client", "Also connect the intake workflow to QuickBooks so accepted matters create invoices automatically.", "2026-11-02T17:08:00+05:30", "Okafor build group · opted in"),
        ("msg-8", "p-saffron", "Uploaded chat", "Priya Nair", "client", "The booking page should match the portfolio type scale. I uploaded a screenshot of what I mean.", "2026-11-01T10:12:00+05:30", "Uploaded WhatsApp export · consent checked"),
        ("msg-9", "p-waypoint", "Email", "Leo Martins", "client", "Happy with the launch. Sending the final payment today — thank you for the quick turnaround.", "2026-11-01T14:25:00+05:30", "Imported email thread · 3 messages"),
    ]
    for mid, pid, platform, sender, role, text, at, consent in messages:
        session.add(
            ExternalMessage(
                id=mid,
                workspace_id=WORKSPACE_ID,
                project_id=pid,
                provider=platform,
                source_message_id=f"{platform.lower()}:{mid}",
                sender=sender,
                sender_role=role,
                text=text,
                sent_at=d(at),
                consent=consent,
            )
        )
    session.flush()

    findings = [
        ScopeFinding(id="sf-1", workspace_id=WORKSPACE_ID, project_id="p-northwind", title="Authentication + payment page requested before launch", message="Can you also add login and a payment page? We need it before launch — the investor demo is on the 14th.", sender="Rahul Mehta", platform="Telegram", received_at=d("2026-11-02T09:14:00+05:30"), clause_id="nw-c5", classification="potential_change", rationale="The request introduces user accounts and checkout. Both are explicitly excluded by clauses nw-c4 and nw-c5. No approved change order exists for this work.", confidence=0.92, estimate_cents=cents(950), review_state="potential", message_id="msg-1", agreement_version="v2.1"),
        ScopeFinding(id="sf-2", workspace_id=WORKSPACE_ID, project_id="p-fjord", title="Homepage hero swapped to short video", message="Can we swap the homepage hero to a short video loop instead of the still? Something moody, 6–8 seconds.", sender="Maya Chen", platform="Telegram", received_at=d("2026-11-01T15:42:00+05:30"), clause_id="fj-c4", classification="within_scope", rationale="Hero imagery swaps are included within the selected direction. A supplied video asset keeps this within scope; video production would not be.", confidence=0.78, estimate_cents=0, review_state="reviewing", message_id="msg-4", agreement_version="v1.3"),
        ScopeFinding(id="sf-3", workspace_id=WORKSPACE_ID, project_id="p-okafor", title="QuickBooks sync mentioned in the intake thread", message="Also connect the intake workflow to QuickBooks so accepted matters create invoices automatically.", sender="Daniel Okafor", platform="Telegram", received_at=d("2026-11-02T17:08:00+05:30"), clause_id="ok-c4", classification="insufficient_context", rationale="The agreement excludes accounting sync, but the client may be describing the existing billing milestone. Confirm whether this replaces the current billing integration before pricing.", confidence=0.46, estimate_cents=0, review_state="potential", message_id="msg-7", agreement_version="v1.0"),
        ScopeFinding(id="sf-4", workspace_id=WORKSPACE_ID, project_id="p-northwind", title="Footer copy tightened before sign-off", message="The footer feels long. Can we cut it to two lines and keep the newsletter?", sender="Rahul Mehta", platform="Telegram", received_at=d("2026-10-31T11:20:00+05:30"), clause_id="nw-c2", classification="within_scope", rationale="This is a copy edit inside the approved revision rounds. It does not add a page, integration, or deliverable.", confidence=0.88, estimate_cents=0, review_state="accepted", message_id="msg-2", agreement_version="v2.1"),
    ]
    session.add_all(findings)
    session.flush()

    pending_action = ActionApproval(
        id="act-reminder-okafor",
        workspace_id=WORKSPACE_ID,
        user_id=USER_ID,
        conversation_id=None,
        message_id="m-4",
        kind="email",
        title="Overdue invoice reminder",
        recipient="daniel@okaforlegal.com",
        subject="Quick nudge — INV-1045 ($800)",
        body=f"Hi Daniel,\n\nA small nudge on INV-1045 for the intake workflow milestone — $800, which was due on 1 November.\n\nThe PayPal Sandbox invoice is here: paypal.com/invoice/INV2-K7Y3-9P2M-4Q6A. Happy to resend it if helpful.\n\nThanks,\n{DEMO_USER_NAME}",
        amount_cents=cents(800),
        currency="USD",
        provider="Gmail",
        status="pending_approval",
        expires_at=d("2026-11-04T11:38:18+05:30"),
    )
    action_payload = canonical_payload(
        kind=pending_action.kind,
        recipient=pending_action.recipient,
        subject=pending_action.subject,
        body=pending_action.body,
        amount_cents=pending_action.amount_cents,
        currency=pending_action.currency,
        provider=pending_action.provider,
    )
    pending_action.canonical_hash = payload_hash(action_payload)
    pending_action.idempotency_key = idempotency_key(pending_action.id, pending_action.canonical_hash)
    session.add(pending_action)
    session.flush()
    session.add(
        ActionEvent(
            id="ae-reminder-prepared",
            workspace_id=WORKSPACE_ID,
            action_id=pending_action.id,
            actor="Visun",
            from_status="draft",
            to_status="pending_approval",
            detail="Draft prepared from INV-1045. Nothing sent; explicit approval required.",
            at=d("2026-11-03T11:38:18+05:30"),
        )
    )

    conversations = [
        ("conv-1", "Launch crunch — scope + payments", "2026-11-03T14:12:00+05:30"),
        ("conv-2", "Today's priorities", "2026-11-02T09:06:00+05:30"),
        ("conv-3", "Fjord hero video question", "2026-11-01T16:05:00+05:30"),
        ("conv-4", "October report draft", "2026-10-31T17:40:00+05:30"),
    ]
    for cid, title, updated in conversations:
        session.add(
            Conversation(
                id=cid,
                workspace_id=WORKSPACE_ID,
                user_id=USER_ID,
                title=title,
                updated_at=d(updated),
            )
        )
    session.flush()

    convo_messages: list[tuple[str, str, int, str, str, str, str, list[dict[str, Any]], list[dict[str, Any]], dict[str, Any] | None]] = [
        ("m-1", "conv-1", 1, "user", "text", "What changed on Rahul's website project, and how much is still unpaid?", "2026-11-03T09:30:00+05:30", [], [], None),
        ("m-2", "conv-1", 2, "assistant", "text", "One change needs your review on **Northwind**: Rahul asked for login and a payment page before the 14 November investor demo. Both are explicitly excluded by the signed scope (authentication and checkout). My estimate is a **$950 amendment**, not a quoted price.\n\nFor money: **$1,800 is outstanding** on INV-1044, due 15 November. PayPal Sandbox was last checked today at 09:02. Nothing else is unpaid on Northwind.", "2026-11-03T09:30:20+05:30", [
            {"kind": "Agreement clause", "label": "nw-c5 · Payment processing is out of scope", "id": "nw-c5", "checkedAt": "2026-11-03T09:29:00+05:30"},
            {"kind": "Telegram message", "label": "Rahul Mehta · 2 Nov, 09:14", "id": "msg-1", "checkedAt": "2026-11-02T09:14:00+05:30"},
            {"kind": "Invoice", "label": "INV-1044 · $1,800 · Sandbox", "id": "inv-1044", "checkedAt": "2026-11-03T09:02:00+05:30"},
        ], [
            {"id": "t-1", "name": "detect_scope_changes", "args": "project_id: p-northwind", "status": "done", "duration": "640ms", "result": "1 potential change · clause nw-c4, nw-c5"},
            {"id": "t-2", "name": "get_pending_payments", "args": "project_id: p-northwind", "status": "done", "duration": "310ms", "result": "1 open invoice · $1,800.00 USD"},
        ], None),
        ("m-3", "conv-1", 3, "user", "text", "Draft a reminder for the overdue Okafor invoice. Keep it short and polite.", "2026-11-03T11:38:00+05:30", [], [], None),
        ("m-4", "conv-1", 4, "assistant", "text", "I've prepared a short reminder for **INV-1045**, which is **2 days overdue**. It names the amount and links the Sandbox invoice. It has **not been sent** — approve it below and I'll execute exactly once.", "2026-11-03T11:38:18+05:30", [
            {"kind": "Invoice", "label": "INV-1045 · $800 · due 1 Nov", "id": "inv-1045", "checkedAt": "2026-11-03T11:38:00+05:30"},
        ], [
            {"id": "t-3", "name": "draft_payment_reminder", "args": "invoice_id: inv-1045", "status": "done", "duration": "820ms", "result": "Draft ready · awaiting approval"},
        ], {
            "id": "act-reminder-okafor",
            "kind": "email",
            "title": "Overdue invoice reminder",
            "recipient": "daniel@okaforlegal.com",
            "subject": "Quick nudge — INV-1045 ($800)",
            "body": pending_action.body,
            "amount": 800,
            "currency": "USD",
            "provider": "Gmail",
            "status": "pending_approval",
            "createdAt": "2026-11-03T11:38:18+05:30",
        }),
        ("m-5", "conv-2", 1, "user", "voice", "What's due today?", "2026-11-02T09:04:00+05:30", [], [], None),
        ("m-6", "conv-2", 2, "assistant", "text", "Nothing is due **today**. Your next deadline is **Northwind's marketing site build** on 6 November, followed by Okafor billing integration the same day. I checked 17 milestones across 5 projects.", "2026-11-02T09:04:12+05:30", [
            {"kind": "Milestones", "label": "5 projects · 17 milestones", "id": "milestones", "checkedAt": "2026-11-02T09:04:00+05:30"},
        ], [
            {"id": "t-4", "name": "get_deadlines", "args": "date: 2026-11-02, timezone: Asia/Kolkata", "status": "done", "duration": "240ms", "result": "0 due today · 2 due this week"},
        ], None),
        ("m-7", "conv-3", 1, "user", "text", "Maya wants a video hero. Is that extra work?", "2026-11-01T16:03:00+05:30", [], [], None),
        ("m-8", "conv-3", 2, "assistant", "text", "It reads **within scope** if Maya supplies the video. Clause fj-c4 includes hero imagery swaps inside the selected direction. Producing the video would be a change — I've left it marked for your review rather than assuming.", "2026-11-01T16:03:18+05:30", [
            {"kind": "Agreement clause", "label": "fj-c4 · Hero imagery swaps included", "id": "fj-c4", "checkedAt": "2026-11-01T16:03:00+05:30"},
            {"kind": "Telegram message", "label": "Maya Chen · 1 Nov, 15:42", "id": "msg-4", "checkedAt": "2026-11-01T15:42:00+05:30"},
        ], [], None),
        ("m-9", "conv-4", 1, "user", "text", "Generate the October retainer report for Daniel, but don't send it.", "2026-10-31T17:36:00+05:30", [], [], None),
        ("m-10", "conv-4", 2, "assistant", "text", "Draft saved. It covers the completed audit and intake workflow, the in-progress billing milestone, and INV-1045 as overdue. **Nothing has been sent.** Review it under Reports.", "2026-10-31T17:36:20+05:30", [
            {"kind": "Report", "label": "October retainer summary · draft", "id": "rep-2", "checkedAt": "2026-10-31T17:36:00+05:30"},
        ], [], None),
    ]
    for mid, cid, seq, role, modality, text, at, sources, tools, action in convo_messages:
        session.add(
            ConversationMessage(
                id=mid,
                conversation_id=cid,
                sequence=seq,
                role=role,
                modality=modality,
                text=text,
                at=d(at),
                sources=sources,
                tools=tools,
                action=action,
            )
        )

    reports = [
        Report(id="rep-1", workspace_id=WORKSPACE_ID, title="Northwind — Week 44 progress", project_id="p-northwind", client_id="c-northwind", period="Oct 27 – Nov 2, 2026", created_at=d("2026-11-02T18:10:00+05:30"), status="sent", pages=2, summary="Design system approved. Marketing build is 64% complete with two pages in staging. One scope question is open around authentication and payments.", provider_message_id="gmail-18f2c9a1", simulated=True),
        Report(id="rep-2", workspace_id=WORKSPACE_ID, title="October retainer summary", project_id="p-okafor", client_id="c-okafor", period="October 2026", created_at=d("2026-10-31T17:35:00+05:30"), status="draft", pages=3, summary="Audit and intake workflow delivered. Billing integration remains in progress. One invoice is overdue and needs a follow-up."),
        Report(id="rep-3", workspace_id=WORKSPACE_ID, title="Fjord — design review notes", project_id="p-fjord", client_id="c-fjord", period="Oct 20 – Oct 28, 2026", created_at=d("2026-10-28T16:20:00+05:30"), status="sent", pages=2, summary="Art direction selected. Homepage comps are in progress, with a requested hero video swap confirmed as within the revision scope.", provider_message_id="gmail-18e91b07", simulated=True),
    ]
    session.add_all(reports)

    integration_rows = [
        ("paypal", "PayPal", "Read invoice and order status. Create payment requests only after explicit approval.", "Sandbox", ["invoices.read", "orders.read", "orders.create (approved)"], True, "2026-11-03T09:02:00+05:30", "orange"),
        ("gmail", "Gmail", "Draft and send client updates through your authorized Google account.", "Connected account", ["gmail.send", "gmail.compose", "userinfo.email"], True, "2026-11-02T18:10:00+05:30", "ink"),
        ("telegram", "Telegram", "Ingest messages from opted-in project groups only. Other chats are never read.", "Northwind + Fjord groups", ["chat.message (opted-in groups)", "webhook.verified"], True, "2026-11-02T17:08:00+05:30", "stone"),
        ("gcal", "Google Calendar", "Read availability and add approved deadline events. Nothing is written without confirmation.", "Not connected", ["calendar.events.readonly", "calendar.events.write (approved)"], False, None, "yellow"),
        ("discord", "Discord", "Optional permitted-channel intake for community projects. Disabled by default.", "Not connected", ["channel.messages (allowlisted)"], False, None, "ink"),
    ]
    for provider, name, description, env, scopes, connected, last_sync, tone in integration_rows:
        session.add(
            IntegrationConnection(
                id=f"int-{provider}",
                workspace_id=WORKSPACE_ID,
                provider=provider,
                name=name,
                description=description,
                env=env,
                scopes=scopes,
                connected=connected,
                simulated=connected,
                last_sync=d(last_sync) if last_sync else None,
                tone=tone,
            )
        )

    activities = [
        ("act-1", "scope", "Visun", "Potential scope change detected", "Rahul requested authentication and checkout on Northwind. Both are excluded by the signed agreement.", "2026-11-02T09:14:00+05:30", "pending", "sf-1", "p-northwind"),
        ("act-2", "payment", "PayPal", "Sandbox payment verified", "INV-1047 was confirmed paid. Provider transaction 5O190127TN364715T captured at 16:48.", "2026-11-01T16:48:00+05:30", "success", "inv-1047", "p-waypoint"),
        ("act-3", "email", "Gmail", "Progress report sent", "Northwind Week 44 report delivered to rahul@northwindlabs.com. Provider message gmail-18f2c9a1.", "2026-11-02T18:10:00+05:30", "success", "rep-1", "p-northwind"),
        ("act-4", "approval", "You", "Reminder approved for sending", "Okafor Legal overdue invoice reminder was approved. Visun is waiting for the provider result.", "2026-11-03T11:42:00+05:30", "pending", "inv-1045", "p-okafor"),
        ("act-5", "ingest", "Telegram", "Authorized message ingested", "One message received in the Northwind project group. Consent scope checked before storage.", "2026-11-02T09:14:00+05:30", "info", "msg-1", "p-northwind"),
        ("act-6", "tool", "Visun", "Checked 6 invoices", "Read-only call to get_pending_payments. Totals reconciled against PayPal Sandbox at 09:02.", "2026-11-03T09:31:00+05:30", "info", "tool-payments", None),
        ("act-7", "report", "Visun", "Report draft generated", "October retainer summary generated from milestones, invoices, and activity. Not sent.", "2026-10-31T17:35:00+05:30", "info", "rep-2", "p-okafor"),
        ("act-8", "scope", "You", "Finding marked within scope", "The Northwind footer copy edit was accepted as part of the approved revision rounds.", "2026-10-31T12:05:00+05:30", "success", "sf-4", "p-northwind"),
        ("act-9", "integration", "Visun", "PayPal Sandbox synced", "Five invoices reconciled. One paid, one partially paid, one overdue. No cached values used.", "2026-11-03T09:02:00+05:30", "success", None, None),
        ("act-10", "email", "Gmail", "Email failed safely", "A calendar digest could not be sent because Google Calendar is not connected. No retry was attempted.", "2026-11-01T08:00:00+05:30", "failed", "calendar-digest", None),
        ("act-11", "payment", "You", "Payment reminder drafted", "Draft prepared for INV-1045 with amount, recipient, and PayPal reference. Approval required.", "2026-11-03T11:40:00+05:30", "pending", "inv-1045", "p-okafor"),
        ("act-12", "system", "Visun", "Workspace seeded for demo", "Sample data loaded for the PayPal AI Hackathon. All integrations are in Sandbox or simulated mode.", "2026-11-03T08:00:00+05:30", "info", None, None),
    ]
    for aid, atype, actor, title, detail, at, status, reference, project_id in activities:
        session.add(
            ActivityEvent(
                id=aid,
                workspace_id=WORKSPACE_ID,
                type=atype,
                actor=actor,
                title=title,
                detail=detail,
                at=d(at),
                status=status,
                reference=reference,
                project_id=project_id,
            )
        )

    session.add(
        Preference(
            workspace_id=WORKSPACE_ID,
            values={
                "voiceReplies": True,
                "saveTranscripts": True,
                "reducedMotion": False,
                "dailyBrief": True,
                "timezone": "Asia/Kolkata",
                "retention": "90",
                "voiceName": "Achird",
                "voiceLanguage": "auto",
                "voiceStyle": "natural",
            },
        )
    )

    session.commit()
    return True


def ensure_demo_identity(session: Session) -> bool:
    """Keep the credential-free demo account labelled as a sandbox identity.

    Existing databases were seeded with a real-looking name and address. This
    idempotent update only touches the fixed demo user row, never a Clerk
    account, so signed-in workspaces are unaffected.
    """
    user = session.get(User, USER_ID)
    if user is None:
        return False
    if user.name == DEMO_USER_NAME and user.email == DEMO_USER_EMAIL:
        return False
    user.name = DEMO_USER_NAME
    user.email = DEMO_USER_EMAIL
    session.add(user)
    session.commit()
    return True
