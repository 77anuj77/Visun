"""SQLModel tables.

Money is stored in integer minor units (cents). Instants are timezone-aware UTC.
Nested presentation payloads (sources, tools, action snapshots) are JSON columns
because they are immutable evidence blobs, not queryable business keys.
"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(primary_key=True)
    clerk_user_id: str = Field(index=True, unique=True)
    name: str
    email: str
    timezone: str = "Asia/Kolkata"
    created_at: datetime = Field(default_factory=utcnow)


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"

    id: str = Field(primary_key=True)
    name: str
    owner_user_id: str = Field(foreign_key="users.id", index=True)
    timezone: str = "Asia/Kolkata"
    plan: str = "Solo workspace"
    created_at: datetime = Field(default_factory=utcnow)


class WorkspaceMember(SQLModel, table=True):
    __tablename__ = "workspace_members"
    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),
    )

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    role: str = "owner"  # owner | member | viewer
    status: str = "active"
    created_at: datetime = Field(default_factory=utcnow)


class Client(SQLModel, table=True):
    __tablename__ = "clients"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    name: str
    company: str
    email: str
    initials: str
    hue: str = "stone"
    created_at: datetime = Field(default_factory=utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    client_id: str = Field(foreign_key="clients.id", index=True)
    name: str
    codename: str
    status: str = "active"
    description: str = ""
    currency: str = "USD"
    budget_cents: int = 0
    paid_cents: int = 0
    due_at: datetime = Field(default_factory=utcnow, index=True)
    progress: int = 0
    health: str = "on_track"
    next_deadline_id: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Agreement(SQLModel, table=True):
    __tablename__ = "agreements"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    version: str
    effective_at: datetime = Field(default_factory=utcnow)
    file: str
    clauses: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )


class Milestone(SQLModel, table=True):
    __tablename__ = "milestones"

    id: str = Field(primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    title: str
    due_at: datetime = Field(index=True)
    status: str = "upcoming"
    value_cents: int = 0
    acceptance: str = ""


class Lead(SQLModel, table=True):
    __tablename__ = "leads"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    name: str
    company: str
    email: str
    source: str
    stage: str = "new"
    received_at: datetime = Field(default_factory=utcnow, index=True)
    interest: str = ""
    next_action: str = ""
    next_action_at: datetime = Field(default_factory=utcnow)
    value_cents: int = 0


class Invoice(SQLModel, table=True):
    __tablename__ = "invoices"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    number: str = Field(unique=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    client_id: str = Field(foreign_key="clients.id", index=True)
    amount_cents: int = 0
    amount_paid_cents: int = 0
    currency: str = "USD"
    issued_at: datetime = Field(default_factory=utcnow)
    due_at: datetime = Field(default_factory=utcnow, index=True)
    status: str = "draft"
    provider: str = "PayPal Sandbox"
    provider_id: str = ""
    last_verified_at: datetime | None = None
    note: str = ""


class Payment(SQLModel, table=True):
    __tablename__ = "payments"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    invoice_id: str = Field(foreign_key="invoices.id", index=True)
    provider: str = "PayPal Sandbox"
    provider_object_id: str = Field(index=True)
    provider_status: str
    amount_cents: int = 0
    currency: str = "USD"
    verified: bool = False
    simulated: bool = False
    event_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class ExternalMessage(SQLModel, table=True):
    __tablename__ = "external_messages"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    provider: str = "Telegram"
    source_message_id: str = Field(index=True, unique=True)
    sender: str
    sender_role: str = "client"
    text: str
    sent_at: datetime = Field(index=True)
    consent: str = ""


class ScopeFinding(SQLModel, table=True):
    __tablename__ = "scope_findings"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    title: str
    message: str
    sender: str
    platform: str = "Telegram"
    received_at: datetime = Field(index=True)
    clause_id: str
    classification: str = "potential_change"
    rationale: str
    confidence: float = 0.5
    estimate_cents: int = 0
    review_state: str = "potential"
    message_id: str = ""
    agreement_version: str = ""


class Conversation(SQLModel, table=True):
    __tablename__ = "conversations"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    title: str
    adk_session_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class ConversationMessage(SQLModel, table=True):
    __tablename__ = "conversation_messages"

    id: str = Field(primary_key=True)
    conversation_id: str = Field(foreign_key="conversations.id", index=True)
    sequence: int = 0
    role: str  # user | assistant | system
    modality: str = "text"  # text | voice
    text: str
    at: datetime = Field(default_factory=utcnow, index=True)
    sources: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    tools: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    action: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    created_at: datetime = Field(default_factory=utcnow)


class ToolExecution(SQLModel, table=True):
    __tablename__ = "tool_executions"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    conversation_id: str = Field(foreign_key="conversations.id", index=True)
    message_id: str = ""
    tool: str
    args_summary: str = ""
    actor: str = "Visun"
    status: str = "done"
    source_refs: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    created_at: datetime = Field(default_factory=utcnow)


class ActionApproval(SQLModel, table=True):
    __tablename__ = "action_approvals"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    conversation_id: str | None = Field(default=None, index=True)
    message_id: str = ""
    kind: str  # email | payment_request | report | calendar
    title: str
    recipient: str = ""
    subject: str = ""
    body: str = ""
    amount_cents: int | None = None
    currency: str | None = None
    provider: str = "Gmail"
    status: str = "pending_approval"
    canonical_hash: str = ""
    idempotency_key: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime = Field(default_factory=utcnow)
    approved_at: datetime | None = None
    executed_at: datetime | None = None
    provider_id: str | None = None
    simulated: bool = False
    error: str | None = None


class ActionEvent(SQLModel, table=True):
    """Append-only approval state transitions (separate from user-facing activity)."""

    __tablename__ = "action_events"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    action_id: str = Field(foreign_key="action_approvals.id", index=True)
    actor: str
    from_status: str
    to_status: str
    detail: str = ""
    at: datetime = Field(default_factory=utcnow, index=True)


class IntegrationCredential(SQLModel, table=True):
    """Encrypted provider credentials.

    Tokens are encrypted with APP_ENCRYPTION_KEY before storage. The column is
    deliberately opaque; no plaintext token is ever serialized to a client.
    """

    __tablename__ = "integration_credentials"
    __table_args__ = (
        UniqueConstraint("workspace_id", "provider", name="uq_credential_provider"),
    )

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    provider: str
    ciphertext: str
    scopes: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    updated_at: datetime = Field(default_factory=utcnow)


class Report(SQLModel, table=True):
    __tablename__ = "reports"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    title: str
    project_id: str = Field(foreign_key="projects.id", index=True)
    client_id: str = Field(foreign_key="clients.id", index=True)
    period: str
    created_at: datetime = Field(default_factory=utcnow)
    status: str = "draft"
    pages: int = 1
    summary: str = ""
    provider_message_id: str | None = None
    simulated: bool = False


class IntegrationConnection(SQLModel, table=True):
    __tablename__ = "integration_connections"
    __table_args__ = (
        UniqueConstraint("workspace_id", "provider", name="uq_workspace_provider"),
    )

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    provider: str
    name: str
    description: str = ""
    env: str = ""
    scopes: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    connected: bool = False
    simulated: bool = False
    last_sync: datetime | None = None
    tone: str = "stone"


class ActivityEvent(SQLModel, table=True):
    __tablename__ = "activity_events"

    id: str = Field(primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    type: str
    actor: str
    title: str
    detail: str
    at: datetime = Field(default_factory=utcnow, index=True)
    status: str = "info"
    reference: str | None = None
    project_id: str | None = None


class Preference(SQLModel, table=True):
    __tablename__ = "preferences"

    workspace_id: str = Field(foreign_key="workspaces.id", primary_key=True)
    values: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    updated_at: datetime = Field(default_factory=utcnow)


class WebhookEvent(SQLModel, table=True):
    __tablename__ = "webhook_events"

    id: str = Field(primary_key=True)
    provider: str = Field(index=True)
    external_event_id: str = Field(index=True, unique=True)
    verification_state: str = "unverified"
    processed_at: datetime | None = None
    result: str = ""
