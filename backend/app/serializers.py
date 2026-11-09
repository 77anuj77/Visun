"""camelCase projections consumed by the Next.js frontend."""

from __future__ import annotations

from typing import Any

from sqlmodel import Session, select

from .models import (
    ActionApproval,
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
    Preference,
    Project,
    Report,
    ScopeFinding,
    User,
    Workspace,
    utcnow,
)
from .timeutil import dollars, to_iso

ACTION_STATUS_TO_FRONTEND = {
    "pending_approval": "pending_approval",
    "executing": "executing",
    "completed": "succeeded",
    "failed": "failed",
    "rejected": "rejected",
    "expired": "failed",
}


def user_out(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "timezone": user.timezone,
    }


def workspace_out(workspace: Workspace, user: User) -> dict[str, Any]:
    return {
        "id": workspace.id,
        "name": workspace.name,
        "owner": user.name,
        "email": user.email,
        "timezone": workspace.timezone,
        "plan": workspace.plan,
    }


def client_out(client: Client) -> dict[str, Any]:
    return {
        "id": client.id,
        "name": client.name,
        "company": client.company,
        "email": client.email,
        "initials": client.initials,
        "hue": client.hue,
    }


def project_out(project: Project) -> dict[str, Any]:
    return {
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
    }


def milestone_out(milestone: Milestone) -> dict[str, Any]:
    return {
        "id": milestone.id,
        "projectId": milestone.project_id,
        "title": milestone.title,
        "dueAt": to_iso(milestone.due_at),
        "status": milestone.status,
        "value": dollars(milestone.value_cents),
        "acceptance": milestone.acceptance,
    }


def agreement_out(agreement: Agreement) -> dict[str, Any]:
    return {
        "id": agreement.id,
        "projectId": agreement.project_id,
        "version": agreement.version,
        "effectiveAt": to_iso(agreement.effective_at),
        "file": agreement.file,
        "clauses": agreement.clauses,
    }


def invoice_out(invoice: Invoice) -> dict[str, Any]:
    return {
        "id": invoice.id,
        "number": invoice.number,
        "projectId": invoice.project_id,
        "clientId": invoice.client_id,
        "amount": dollars(invoice.amount_cents),
        "amountPaid": dollars(invoice.amount_paid_cents),
        "currency": invoice.currency,
        "issuedAt": to_iso(invoice.issued_at),
        "dueAt": to_iso(invoice.due_at),
        "status": invoice.status,
        "provider": invoice.provider,
        "providerId": invoice.provider_id,
        "lastVerifiedAt": to_iso(invoice.last_verified_at),
        "note": invoice.note,
        "outstanding": dollars(max(invoice.amount_cents - invoice.amount_paid_cents, 0)),
        "simulated": invoice.provider == "PayPal Sandbox",
    }


def lead_out(lead: Lead) -> dict[str, Any]:
    return {
        "id": lead.id,
        "name": lead.name,
        "company": lead.company,
        "email": lead.email,
        "source": lead.source,
        "stage": lead.stage,
        "receivedAt": to_iso(lead.received_at),
        "interest": lead.interest,
        "nextAction": lead.next_action,
        "nextActionAt": to_iso(lead.next_action_at),
        "value": dollars(lead.value_cents),
    }


def finding_out(finding: ScopeFinding) -> dict[str, Any]:
    return {
        "id": finding.id,
        "projectId": finding.project_id,
        "title": finding.title,
        "message": finding.message,
        "sender": finding.sender,
        "platform": finding.platform,
        "receivedAt": to_iso(finding.received_at),
        "clauseId": finding.clause_id,
        "classification": finding.classification,
        "rationale": finding.rationale,
        "confidence": finding.confidence,
        "estimate": dollars(finding.estimate_cents),
        "reviewState": finding.review_state,
        "messageId": finding.message_id,
        "agreementVersion": finding.agreement_version,
    }


def client_message_out(message: ExternalMessage) -> dict[str, Any]:
    return {
        "id": message.id,
        "projectId": message.project_id,
        "platform": message.provider,
        "sender": message.sender,
        "senderRole": message.sender_role,
        "text": message.text,
        "sentAt": to_iso(message.sent_at),
        "consent": message.consent,
    }


def action_out(action: ActionApproval) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": action.id,
        "kind": action.kind,
        "title": action.title,
        "recipient": action.recipient,
        "subject": action.subject,
        "body": action.body,
        "provider": action.provider,
        "status": ACTION_STATUS_TO_FRONTEND.get(action.status, "failed"),
        "createdAt": to_iso(action.created_at),
        "expiresAt": to_iso(action.expires_at),
        "simulated": action.simulated,
        "canonicalHash": action.canonical_hash,
    }
    if action.amount_cents is not None:
        payload["amount"] = dollars(action.amount_cents)
    if action.currency:
        payload["currency"] = action.currency
    if action.provider_id:
        payload["providerId"] = action.provider_id
    if action.error:
        payload["error"] = action.error
    return payload


def message_out(
    message: ConversationMessage,
    approval: ActionApproval | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": message.id,
        "role": message.role,
        "modality": message.modality,
        "text": message.text,
        "at": to_iso(message.at),
        "sources": message.sources,
        "tools": message.tools,
        "sequence": message.sequence,
    }
    if message.action:
        live = approval or _approval_for_snapshot(message.action)
        payload["action"] = action_out(live) if live else message.action
    return payload


def _approval_for_snapshot(snapshot: dict[str, Any]) -> ActionApproval | None:
    try:
        return ActionApproval.model_validate(snapshot)
    except Exception:  # noqa: BLE001 - legacy JSON is presentation-only
        return None


def conversation_out(
    conversation: Conversation,
    messages: list[ConversationMessage],
    approvals: dict[str, ActionApproval] | None = None,
) -> dict[str, Any]:
    approvals = approvals or {}
    return {
        "id": conversation.id,
        "title": conversation.title,
        "updatedAt": to_iso(conversation.updated_at),
        "messages": [
            message_out(message, approvals.get(str((message.action or {}).get("id"))))
            for message in sorted(messages, key=lambda row: row.sequence)
        ],
    }


def report_out(report: Report) -> dict[str, Any]:
    return {
        "id": report.id,
        "title": report.title,
        "projectId": report.project_id,
        "clientId": report.client_id,
        "period": report.period,
        "createdAt": to_iso(report.created_at),
        "status": report.status,
        "pages": report.pages,
        "summary": report.summary,
        "providerMessageId": report.provider_message_id,
        "simulated": report.simulated,
    }


def integration_out(integration: IntegrationConnection) -> dict[str, Any]:
    return {
        "id": integration.provider,
        "name": integration.name,
        "description": integration.description,
        "env": integration.env,
        "scopes": integration.scopes,
        "connected": integration.connected,
        "lastSync": to_iso(integration.last_sync),
        "tone": integration.tone,
        "simulated": integration.simulated,
    }


def activity_out(event: ActivityEvent) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": event.id,
        "type": event.type,
        "actor": event.actor,
        "title": event.title,
        "detail": event.detail,
        "at": to_iso(event.at),
        "status": event.status,
    }
    if event.reference:
        payload["reference"] = event.reference
    if event.project_id:
        payload["projectId"] = event.project_id
    return payload


def preferences_out(preference: Preference | None) -> dict[str, Any]:
    values = preference.values if preference else {}
    return {
        "voiceReplies": values.get("voiceReplies", True),
        "saveTranscripts": values.get("saveTranscripts", True),
        "reducedMotion": values.get("reducedMotion", False),
        "dailyBrief": values.get("dailyBrief", True),
        "timezone": values.get("timezone", "Asia/Kolkata"),
        "retention": values.get("retention", "90"),
        "voiceName": values.get("voiceName", "Achird"),
        "voiceLanguage": values.get("voiceLanguage", "auto"),
        "voiceStyle": values.get("voiceStyle", "natural"),
    }


def snapshot(
    session: Session,
    workspace_id: str,
    user: User,
    workspace: Workspace,
) -> dict[str, Any]:
    clients = session.exec(
        select(Client).where(Client.workspace_id == workspace_id).order_by(Client.company)
    ).all()
    projects = session.exec(
        select(Project).where(Project.workspace_id == workspace_id).order_by(Project.due_at)
    ).all()
    project_ids = [project.id for project in projects]
    milestones = session.exec(
        select(Milestone)
        .where(Milestone.project_id.in_(project_ids))  # type: ignore[attr-defined]
        .order_by(Milestone.due_at)
    ).all()
    agreements = session.exec(
        select(Agreement).where(Agreement.project_id.in_(project_ids))  # type: ignore[attr-defined]
    ).all()
    invoices = session.exec(
        select(Invoice).where(Invoice.workspace_id == workspace_id).order_by(Invoice.issued_at.desc())  # type: ignore[attr-defined]
    ).all()
    findings = session.exec(
        select(ScopeFinding)
        .where(ScopeFinding.workspace_id == workspace_id)
        .order_by(ScopeFinding.received_at.desc())
    ).all()
    messages = session.exec(
        select(ExternalMessage)
        .where(ExternalMessage.workspace_id == workspace_id)
        .order_by(ExternalMessage.sent_at.desc())
    ).all()
    leads = session.exec(
        select(Lead).where(Lead.workspace_id == workspace_id).order_by(Lead.received_at.desc())
    ).all()
    reports = session.exec(
        select(Report).where(Report.workspace_id == workspace_id).order_by(Report.created_at.desc())
    ).all()
    integrations = session.exec(
        select(IntegrationConnection)
        .where(IntegrationConnection.workspace_id == workspace_id)
        .order_by(IntegrationConnection.name)
    ).all()
    activities = session.exec(
        select(ActivityEvent)
        .where(ActivityEvent.workspace_id == workspace_id)
        .order_by(ActivityEvent.at.desc())
        .limit(200)
    ).all()
    conversations = session.exec(
        select(Conversation)
        .where(Conversation.workspace_id == workspace_id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    conversation_ids = [conversation.id for conversation in conversations]
    convo_messages = session.exec(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id.in_(conversation_ids))  # type: ignore[attr-defined]
        .order_by(ConversationMessage.sequence)
    ).all()
    approvals = session.exec(
        select(ActionApproval).where(ActionApproval.workspace_id == workspace_id)
    ).all()
    approval_map = {approval.id: approval for approval in approvals}
    preference = session.get(Preference, workspace_id)

    messages_by_conversation: dict[str, list[ConversationMessage]] = {}
    for message in convo_messages:
        messages_by_conversation.setdefault(message.conversation_id, []).append(message)

    state = {
        "version": 1,
        "findingReviews": {finding.id: finding.review_state for finding in findings},
        "actions": {
            action.id: ACTION_STATUS_TO_FRONTEND.get(action.status, "failed")
            for action in approvals
        },
        "integrations": {item.provider: item.connected for item in integrations},
        "leads": [lead_out(lead) for lead in leads],
        "reports": [report_out(report) for report in reports],
        "conversations": [
            conversation_out(
                conversation,
                messages_by_conversation.get(conversation.id, []),
                approval_map,
            )
            for conversation in conversations
        ],
        "activities": [activity_out(event) for event in activities],
        "doneMilestones": [
            milestone.id for milestone in milestones if milestone.status == "done"
        ],
        "preferences": preferences_out(preference),
    }

    return {
        "generatedAt": to_iso(utcnow()),
        "sample": True,
        "providerMode": "simulated",
        "authMode": "demo",
        "workspace": workspace_out(workspace, user),
        "user": user_out(user),
        "state": state,
        "reference": {
            "clients": [client_out(client) for client in clients],
            "projects": [project_out(project) for project in projects],
            "milestones": [milestone_out(milestone) for milestone in milestones],
            "agreements": [agreement_out(agreement) for agreement in agreements],
            "invoices": [invoice_out(invoice) for invoice in invoices],
            "scopeFindings": [finding_out(finding) for finding in findings],
            "messages": [client_message_out(message) for message in messages],
            "integrations": [integration_out(item) for item in integrations],
        },
    }
