"""Conversation orchestration: one history for voice and text."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlmodel import Session, func, select

from ..core.config import settings
from ..core.security import Principal
from ..models import (
    ActionApproval,
    Conversation,
    ConversationMessage,
    ToolExecution,
    utcnow,
)
from ..schemas import AgentChatRequest
from ..serializers import action_out, message_out
from ..timeutil import parse_dt
from .actions import record_activity
from .agent import AgentReply, configured_agent


def ensure_conversation(
    session: Session,
    principal: Principal,
    conversation_id: str | None,
    title_hint: str = "New conversation",
) -> Conversation:
    if conversation_id:
        existing = session.get(Conversation, conversation_id)
        if existing is not None:
            if existing.workspace_id != principal.workspace_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found in this workspace.",
                )
            return existing
        conversation = Conversation(
            id=conversation_id,
            workspace_id=principal.workspace_id,
            user_id=principal.user_id,
            title=title_hint[:60] or "New conversation",
        )
        session.add(conversation)
        session.commit()
        session.refresh(conversation)
        return conversation
    conversation = Conversation(
        id=f"conv-{uuid.uuid4().hex[:10]}",
        workspace_id=principal.workspace_id,
        user_id=principal.user_id,
        title=title_hint[:60] or "New conversation",
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


def _next_sequence(session: Session, conversation_id: str) -> int:
    current = session.exec(
        select(func.max(ConversationMessage.sequence)).where(
            ConversationMessage.conversation_id == conversation_id
        )
    ).one()
    return int(current or 0) + 1


def persist_turn(
    session: Session,
    principal: Principal,
    *,
    conversation: Conversation,
    user_text: str,
    modality: str,
    message_id: str | None,
    message_at: str | None,
    project_id: str | None,
) -> tuple[ConversationMessage, AgentReply]:
    user_id_value = message_id or f"m-{uuid.uuid4().hex[:10]}"
    existing = session.get(ConversationMessage, user_id_value)
    if existing is None:
        session.add(
            ConversationMessage(
                id=user_id_value,
                conversation_id=conversation.id,
                sequence=_next_sequence(session, conversation.id),
                role="user",
                modality=modality,
                text=user_text,
                at=parse_dt(message_at) if message_at else utcnow(),
            )
        )
        conversation.updated_at = utcnow()
        session.add(conversation)
        session.commit()

    reply = configured_agent().respond(
        session=session,
        principal=principal,
        message=user_text,
        project_id=project_id,
    )

    action: ActionApproval | None = None
    action_snapshot: dict[str, Any] | None = None
    if reply.action_id:
        action = session.get(ActionApproval, reply.action_id)
        if action is not None and action.workspace_id == principal.workspace_id:
            action_snapshot = action_out(action)

    assistant = ConversationMessage(
        id=f"m-{uuid.uuid4().hex[:10]}",
        conversation_id=conversation.id,
        sequence=_next_sequence(session, conversation.id),
        role="assistant",
        modality="text",
        text=reply.text,
        at=utcnow(),
        sources=reply.sources,
        tools=[tool.frontend(index + 1) for index, tool in enumerate(reply.tools)],
        action=action_snapshot,
    )
    session.add(assistant)

    for tool in reply.tools:
        session.add(
            ToolExecution(
                id=f"tool-{uuid.uuid4().hex[:12]}",
                workspace_id=principal.workspace_id,
                conversation_id=conversation.id,
                message_id=assistant.id,
                tool=tool.name,
                args_summary=tool.args[:500],
                actor="Visun",
                status=tool.status,
                source_refs=[source.get("id", "") for source in tool.sources],
            )
        )

    record_activity(
        session,
        workspace_id=principal.workspace_id,
        type="tool",
        actor="Visun",
        title="Grounded answer generated",
        detail=(
            f"{len(reply.tools)} tool call(s), {len(reply.sources)} source(s). "
            f"Backend: {reply.backend}. No external write was made."
        ),
        status="info",
        reference=conversation.id,
    )
    conversation.updated_at = utcnow()
    session.add(conversation)
    session.commit()
    session.refresh(assistant)
    return assistant, reply


def chat(session: Session, principal: Principal, request: AgentChatRequest) -> dict[str, Any]:
    title_hint = request.title or request.message[:44]
    conversation = ensure_conversation(
        session, principal, request.conversation_id, title_hint
    )
    assistant, reply = persist_turn(
        session,
        principal,
        conversation=conversation,
        user_text=request.message,
        modality=request.modality,
        message_id=request.client_message_id,
        message_at=request.client_message_at,
        project_id=request.project_id,
    )
    action = None
    if reply.action_id:
        stored = session.get(ActionApproval, reply.action_id)
        if stored is not None:
            action = action_out(stored)
    return {
        "conversationId": conversation.id,
        "conversationTitle": conversation.title,
        "message": message_out(assistant),
        "action": action,
        "backend": reply.backend,
        "grounded": True,
        "sample": True,
        "providerMode": settings.provider_mode,
        "tools": [tool.frontend(index + 1) for index, tool in enumerate(reply.tools)],
        "sources": reply.sources,
    }


def append_message(
    session: Session,
    principal: Principal,
    conversation_id: str,
    *,
    role: str,
    modality: str,
    text: str,
    message_id: str | None = None,
    sources: list[dict[str, Any]] | None = None,
    tools: list[dict[str, Any]] | None = None,
    action: dict[str, Any] | None = None,
) -> ConversationMessage:
    conversation = ensure_conversation(session, principal, conversation_id)
    message = ConversationMessage(
        id=message_id or f"m-{uuid.uuid4().hex[:10]}",
        conversation_id=conversation.id,
        sequence=_next_sequence(session, conversation.id),
        role=role,
        modality=modality,
        text=text,
        sources=sources or [],
        tools=tools or [],
        action=action,
    )
    session.add(message)
    conversation.updated_at = utcnow()
    session.add(conversation)
    session.commit()
    session.refresh(message)
    return message


def delete_conversation(session: Session, principal: Principal, conversation_id: str) -> None:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None or conversation.workspace_id != principal.workspace_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found in this workspace.",
        )
    for message in session.exec(
        select(ConversationMessage).where(
            ConversationMessage.conversation_id == conversation.id
        )
    ).all():
        session.delete(message)
    for tool in session.exec(
        select(ToolExecution).where(ToolExecution.conversation_id == conversation.id)
    ).all():
        session.delete(tool)
    session.delete(conversation)
    session.commit()
