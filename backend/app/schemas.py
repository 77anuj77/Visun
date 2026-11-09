"""Request and response contracts.

Response payloads are plain dicts assembled by `serializers.py` because they are
the camelCase projection the frontend consumes; request bodies are validated
Pydantic models.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

ActionKind = Literal["email", "payment_request", "report", "calendar", "agreement_change"]


class AgentChatRequest(BaseModel):
    conversation_id: str | None = None
    client_message_id: str | None = Field(default=None, max_length=64)
    client_message_at: str | None = None
    title: str | None = Field(default=None, max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    modality: Literal["text", "voice"] = "text"
    project_id: str | None = None


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=120)


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class MessageCreate(BaseModel):
    role: Literal["user", "assistant", "system"] = "user"
    modality: Literal["text", "voice"] = "text"
    text: str = Field(min_length=1, max_length=8000)


class ScopeReviewRequest(BaseModel):
    review_state: Literal["potential", "reviewing", "accepted", "dismissed"]


class ProjectCreate(BaseModel):
    """Either an existing `client_id` or the details for a new client.

    Manual project entry must work in a workspace with no CRM integration, so a
    first project can create its client inline instead of requiring one first.
    """

    client_id: str | None = Field(default=None, max_length=80)
    client_name: str = Field(default="", max_length=120)
    client_company: str = Field(default="", max_length=160)
    client_email: str = Field(default="", max_length=254)
    name: str = Field(min_length=1, max_length=160)
    codename: str = Field(default="", max_length=80)
    description: str = Field(default="", max_length=2000)
    status: Literal["active", "review", "paused", "completed"] = "active"
    currency: str = Field(default="USD", max_length=8)
    budget: float = Field(default=0, ge=0)
    due_at: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    codename: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=2000)
    status: Literal["active", "review", "paused", "completed"] | None = None
    currency: str | None = Field(default=None, max_length=8)
    budget: float | None = Field(default=None, ge=0)
    due_at: str | None = None
    client_id: str | None = Field(default=None, max_length=80)


class MilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    due_at: str
    status: Literal["done", "in_progress", "upcoming", "blocked"] = "upcoming"
    value: float = Field(default=0, ge=0)
    acceptance: str = Field(default="", max_length=1000)


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    due_at: str | None = None
    status: Literal["done", "in_progress", "upcoming", "blocked"] | None = None
    value: float | None = Field(default=None, ge=0)
    acceptance: str | None = Field(default=None, max_length=1000)


class ReportPreviewRequest(BaseModel):
    """`project_id=None` builds a workspace-wide report from every project."""

    project_id: str | None = None
    period: str | None = Field(default=None, max_length=120)
    include_narrative: bool = True


class ReportCreate(BaseModel):
    project_id: str
    title: str = Field(min_length=1, max_length=200)
    period: str = Field(default="", max_length=120)
    summary: str = Field(default="", max_length=8000)
    pages: int = Field(default=1, ge=1, le=200)


class AgreementChangeRequest(BaseModel):
    agreement_id: str
    clause_id: str
    proposed_text: str = Field(min_length=1, max_length=4000)
    reason: str = Field(default="", max_length=2000)


class AgreementApplyRequest(BaseModel):
    approval_id: str


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(default="", max_length=160)
    email: EmailStr
    source: str = Field(default="Manual entry", max_length=160)
    stage: Literal["new", "contacted", "qualified", "proposal", "won"] = "new"
    interest: str = Field(default="", max_length=2000)
    next_action: str = Field(default="", max_length=300)
    value: float = Field(default=0, ge=0, le=10_000_000)


class LeadUpdate(BaseModel):
    stage: Literal["new", "contacted", "qualified", "proposal", "won"] | None = None
    next_action: str | None = Field(default=None, max_length=300)
    interest: str | None = Field(default=None, max_length=2000)


class ActionPrepare(BaseModel):
    kind: ActionKind
    title: str = Field(min_length=1, max_length=160)
    recipient: str = Field(default="", max_length=254)
    subject: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=20000)
    amount: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", max_length=8)
    provider: str = Field(default="Gmail", max_length=60)
    conversation_id: str | None = None
    message_id: str | None = None

    @field_validator("recipient")
    @classmethod
    def recipient_is_email(cls, value: str) -> str:
        value = value.strip()
        if value and "@" not in value:
            raise ValueError("Recipient must be an email address.")
        return value


class ActionApprove(BaseModel):
    # The client must echo the hash it displayed so a stale or swapped action
    # cannot be approved silently.
    expected_hash: str | None = None


class ReportSendRequest(BaseModel):
    title: str | None = None


class IntegrationToggle(BaseModel):
    connected: bool


class IntegrationCredentialsUpdate(BaseModel):
    """Values keyed by the provider spec field names (`client_id`, `bot_token`…)."""

    values: dict[str, str] = Field(default_factory=dict)

    @field_validator("values")
    @classmethod
    def strip_values(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 12:
            raise ValueError("Too many credential fields.")
        for key, item in value.items():
            if len(key) > 40 or len(str(item)) > 4000:
                raise ValueError("Credential value is too long.")
        return value


class PreferencesUpdate(BaseModel):
    voiceReplies: bool | None = None
    saveTranscripts: bool | None = None
    reducedMotion: bool | None = None
    dailyBrief: bool | None = None
    timezone: str | None = Field(default=None, max_length=64)
    retention: Literal["30", "90", "365", "forever"] | None = None


class ActivityCreate(BaseModel):
    type: Literal[
        "scope",
        "payment",
        "email",
        "report",
        "tool",
        "approval",
        "integration",
        "ingest",
        "system",
    ] = "system"
    actor: Literal["Visun", "You", "PayPal", "Telegram", "Gmail"] = "Visun"
    title: str = Field(min_length=1, max_length=200)
    detail: str = Field(default="", max_length=2000)
    status: Literal["info", "success", "pending", "failed"] = "info"
    reference: str | None = None
    project_id: str | None = None


class PaymentCreate(BaseModel):
    """Used by the PayPal Sandbox webhook adapter and the demo recheck."""

    invoice_id: str
    provider_object_id: str
    provider_status: str
    amount: float
    currency: str = "USD"


class VoiceWebSocketHello(BaseModel):
    token: str | None = None
    conversation_id: str | None = None
