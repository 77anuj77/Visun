"""Approval state machine and exactly-once external execution.

pending_approval -> executing -> completed | failed
pending_approval -> rejected (terminal)
pending_approval -> expired (terminal)
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from fastapi import HTTPException
from fastapi import status as http_status
from sqlmodel import Session, select

from ..core.config import settings
from ..core.security import Principal
from ..models import (
    ActionApproval,
    ActionEvent,
    ActivityEvent,
    IntegrationConnection,
    utcnow,
)
from ..schemas import ActionPrepare
from ..serializers import action_out
from ..timeutil import dollars, parse_dt
from .hashing import canonical_payload, idempotency_key, payload_hash
from .providers import ProviderError, execute_provider_action


def _action_event(
    session: Session,
    action: ActionApproval,
    *,
    actor: str,
    from_status: str,
    to_status: str,
    detail: str,
) -> None:
    session.add(
        ActionEvent(
            id=f"ae-{uuid.uuid4().hex[:12]}",
            workspace_id=action.workspace_id,
            action_id=action.id,
            actor=actor,
            from_status=from_status,
            to_status=to_status,
            detail=detail,
        )
    )


def record_activity(
    session: Session,
    *,
    workspace_id: str,
    type: str,
    actor: str,
    title: str,
    detail: str,
    status: str = "info",
    reference: str | None = None,
    project_id: str | None = None,
) -> ActivityEvent:
    event = ActivityEvent(
        id=f"act-{uuid.uuid4().hex[:12]}",
        workspace_id=workspace_id,
        type=type,
        actor=actor,
        title=title,
        detail=detail,
        status=status,
        reference=reference,
        project_id=project_id,
    )
    session.add(event)
    return event


def prepare_action(
    session: Session,
    principal: Principal,
    payload: ActionPrepare,
) -> ActionApproval:
    canonical = canonical_payload(
        kind=payload.kind,
        recipient=payload.recipient,
        subject=payload.subject,
        body=payload.body,
        amount_cents=round(payload.amount * 100) if payload.amount is not None else None,
        currency=payload.currency or "USD",
        provider=payload.provider,
    )
    action = ActionApproval(
        id=f"act-{uuid.uuid4().hex[:12]}",
        workspace_id=principal.workspace_id,
        user_id=principal.user_id,
        conversation_id=payload.conversation_id,
        message_id=payload.message_id or "",
        kind=payload.kind,
        title=payload.title,
        recipient=payload.recipient,
        subject=payload.subject,
        body=payload.body,
        amount_cents=canonical["amount_cents"],
        currency=canonical["currency"],
        provider=payload.provider,
        status="pending_approval",
        expires_at=utcnow() + timedelta(minutes=settings.action_expiry_minutes),
    )
    action.canonical_hash = payload_hash(canonical)
    action.idempotency_key = idempotency_key(action.id, action.canonical_hash)
    session.add(action)
    _action_event(
        session,
        action,
        actor="Visun",
        from_status="draft",
        to_status="pending_approval",
        detail="Action prepared. No external request was made.",
    )
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="approval" if payload.kind != "email" else "email",
        actor="Visun",
        title="Action prepared for approval",
        detail=f"{payload.title} is waiting for explicit approval. Provider: {payload.provider}.",
        status="pending",
        reference=action.id,
    )
    session.commit()
    session.refresh(action)
    return action


def _workspace_action(session: Session, principal: Principal, action_id: str) -> ActionApproval:
    action = session.get(ActionApproval, action_id)
    if action is None or action.workspace_id != principal.workspace_id:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Action not found in this workspace.",
        )
    return action


def _integration_for(session: Session, workspace_id: str, provider: str) -> IntegrationConnection | None:
    key = provider.strip().lower()
    if key in {"google calendar", "calendar"}:
        key = "gcal"
    return session.exec(
        select(IntegrationConnection).where(
            IntegrationConnection.workspace_id == workspace_id,
            IntegrationConnection.provider == key,
        )
    ).first()


def _recompute_hash(action: ActionApproval) -> str:
    return payload_hash(
        canonical_payload(
            kind=action.kind,
            recipient=action.recipient,
            subject=action.subject,
            body=action.body,
            amount_cents=action.amount_cents,
            currency=action.currency,
            provider=action.provider,
        )
    )


async def approve_action(
    session: Session,
    principal: Principal,
    action_id: str,
    expected_hash: str | None,
) -> tuple[ActionApproval, dict[str, Any]]:
    if principal.role != "owner":
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can approve external or financial actions.",
        )
    action = _workspace_action(session, principal, action_id)

    # Idempotent replay of an already-executed approval.
    if action.status == "completed":
        return action, action_out(action)

    if action.status in {"rejected", "expired"}:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"This action is {action.status} and cannot be approved.",
        )
    if action.status == "executing":
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This action is already executing.",
        )
    if parse_dt(action.expires_at) <= utcnow():
        previous = action.status
        action.status = "expired"
        _action_event(
            session,
            action,
            actor="Visun",
            from_status=previous,
            to_status="expired",
            detail="Approval window elapsed before confirmation.",
        )
        session.commit()
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This approval expired. Prepare the action again.",
        )

    live_hash = _recompute_hash(action)
    if live_hash != action.canonical_hash:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="The action changed after it was prepared. Prepare it again.",
        )
    if expected_hash and expected_hash != action.canonical_hash:
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Approval hash does not match the prepared action.",
        )

    integration = _integration_for(session, principal.workspace_id, action.provider)
    if integration is not None and not integration.connected:
        previous = action.status
        action.status = "failed"
        action.error = f"{action.provider} is not connected. Nothing was sent."
        _action_event(
            session,
            action,
            actor="Visun",
            from_status=previous,
            to_status="failed",
            detail=action.error,
        )
        record_activity(
            session,
            workspace_id=principal.workspace_id,
            type="approval",
            actor="Visun",
            title="Action failed safely",
            detail=f"{action.title} was not executed because {action.provider} is disconnected.",
            status="failed",
            reference=action.id,
        )
        session.commit()
        return action, action_out(action)

    previous = action.status
    action.status = "executing"
    action.approved_at = utcnow()
    _action_event(
        session,
        action,
        actor=principal.name,
        from_status=previous,
        to_status="executing",
        detail=f"Approved explicitly by {principal.email}. Executing once.",
    )
    session.commit()
    session.refresh(action)

    # Agreement changes are internal records; they never touch a provider.
    if action.kind == "agreement_change":
        action.status = "completed"
        action.executed_at = utcnow()
        action.simulated = False
        _action_event(
            session,
            action,
            actor="Visun",
            from_status="executing",
            to_status="completed",
            detail="Agreement change recorded after explicit owner approval.",
        )
        record_activity(
            session,
            workspace_id=principal.workspace_id,
            type="approval",
            actor="You",
            title="Agreement change approved",
            detail=action.subject or action.title,
            status="success",
            reference=action.id,
        )
        session.commit()
        session.refresh(action)
        return action, action_out(action)

    try:
        result = await execute_provider_action(
            provider=action.provider,
            kind=action.kind,
            recipient=action.recipient,
            subject=action.subject,
            body=action.body,
            amount_cents=action.amount_cents,
            currency=action.currency,
        )
    except ProviderError as exc:
        action.status = "failed"
        action.error = str(exc)
        action.executed_at = utcnow()
        _action_event(
            session,
            action,
            actor=action.provider,
            from_status="executing",
            to_status="failed",
            detail=str(exc),
        )
        record_activity(
            session,
            workspace_id=principal.workspace_id,
            type="email" if action.kind == "email" else "payment",
            actor=action.provider if action.provider in {"PayPal", "Gmail", "Telegram"} else "Visun",
            title="Provider action failed",
            detail=f"{action.title}: {exc}",
            status="failed",
            reference=action.id,
        )
        session.commit()
        session.refresh(action)
        return action, action_out(action)

    action.status = "completed"
    action.executed_at = utcnow()
    action.provider_id = result.provider_id
    action.simulated = result.simulated
    action.error = None
    _action_event(
        session,
        action,
        actor=action.provider,
        from_status="executing",
        to_status="completed",
        detail=result.detail,
    )
    label = "Simulated" if result.simulated else "Executed"
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="email" if action.kind == "email" else "payment",
        actor=action.provider if action.provider in {"PayPal", "Gmail", "Telegram"} else "Visun",
        title=f"{label}: {action.title}",
        detail=(
            f"{result.detail} Reference {result.provider_id}."
            if result.provider_id
            else result.detail
        ),
        status="success",
        reference=action.id,
    )
    session.commit()
    session.refresh(action)
    return action, action_out(action)


def reject_action(
    session: Session, principal: Principal, action_id: str, reason: str = ""
) -> tuple[ActionApproval, dict[str, Any]]:
    action = _workspace_action(session, principal, action_id)
    if action.status == "completed":
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="This action already completed and cannot be rejected.",
        )
    previous = action.status
    action.status = "rejected"
    action.error = reason or "Rejected by the workspace owner."
    _action_event(
        session,
        action,
        actor=principal.name,
        from_status=previous,
        to_status="rejected",
        detail=action.error,
    )
    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="approval",
        actor="You",
        title="Action rejected",
        detail=f"{action.title} was rejected. No external request was made.",
        status="info",
        reference=action.id,
    )
    session.commit()
    session.refresh(action)
    return action, action_out(action)


def sync_action_status(action: ActionApproval, payload: dict[str, Any]) -> None:
    """Keep the serialized action honest about the amount type."""
    if action.amount_cents is not None:
        payload["amount"] = dollars(action.amount_cents)
