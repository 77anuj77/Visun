from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, status
from sqlmodel import select

from ..core.config import settings
from ..core.security import (
    AgentRateLimitedDep,
    OwnerDep,
    PrincipalDep,
    SessionDep,
    WriterDep,
    websocket_principal,
)
from ..models import (
    ActionApproval,
    Conversation,
    ConversationMessage,
    ToolExecution,
    utcnow,
)
from ..schemas import (
    ActionApprove,
    ActionPrepare,
    AgentChatRequest,
    ConversationCreate,
    ConversationRename,
    MessageCreate,
)
from ..serializers import action_out, conversation_out, message_out
from ..services.actions import (
    approve_action,
    prepare_action,
    reject_action,
)
from ..services.assistant import chat, delete_conversation, ensure_conversation
from ..services.voice import handle_voice_socket
from ..timeutil import to_iso

router = APIRouter()


def _approvals(session: SessionDep, workspace_id: str) -> dict[str, ActionApproval]:
    return {
        row.id: row
        for row in session.exec(
            select(ActionApproval).where(ActionApproval.workspace_id == workspace_id)
        ).all()
    }


@router.get("/conversations", tags=["agent"])
def list_conversations(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    conversations = session.exec(
        select(Conversation)
        .where(Conversation.workspace_id == principal.workspace_id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    approvals = _approvals(session, principal.workspace_id)
    messages = session.exec(
        select(ConversationMessage).where(
            ConversationMessage.conversation_id.in_([row.id for row in conversations])  # type: ignore[attr-defined]
        )
    ).all() if conversations else []
    grouped: dict[str, list[ConversationMessage]] = {}
    for message in messages:
        grouped.setdefault(message.conversation_id, []).append(message)
    return {
        "sample": True,
        "conversations": [
            conversation_out(row, grouped.get(row.id, []), approvals)
            for row in conversations
        ],
    }


@router.post("/conversations", status_code=status.HTTP_201_CREATED, tags=["agent"])
def create_conversation(
    payload: ConversationCreate, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    conversation = ensure_conversation(session, principal, None, payload.title)
    if payload.title and conversation.title != payload.title:
        conversation.title = payload.title
        session.add(conversation)
        session.commit()
    return {"conversation": conversation_out(conversation, []), "sample": True}


@router.patch("/conversations/{conversation_id}", tags=["agent"])
def rename_conversation(
    conversation_id: str,
    payload: ConversationRename,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None or conversation.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    conversation.title = payload.title
    conversation.updated_at = utcnow()
    session.add(conversation)
    session.commit()
    return {"conversation": {"id": conversation.id, "title": conversation.title}}


@router.delete("/conversations/{conversation_id}", tags=["agent"])
def remove_conversation(
    conversation_id: str, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    delete_conversation(session, principal, conversation_id)
    return {"deleted": True, "id": conversation_id}


@router.get("/conversations/{conversation_id}/messages", tags=["agent"])
def conversation_messages(
    conversation_id: str, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    conversation = session.get(Conversation, conversation_id)
    if conversation is None or conversation.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    rows = session.exec(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation.id)
        .order_by(ConversationMessage.sequence)
    ).all()
    approvals = _approvals(session, principal.workspace_id)
    return {
        "sample": True,
        "messages": [
            message_out(row, approvals.get(str((row.action or {}).get("id"))))
            for row in rows
        ],
    }


@router.post("/conversations/{conversation_id}/messages", tags=["agent"])
def add_conversation_message(
    conversation_id: str,
    payload: MessageCreate,
    session: SessionDep,
    principal: WriterDep,
) -> dict[str, Any]:
    from ..services.assistant import append_message

    message = append_message(
        session,
        principal,
        conversation_id,
        role=payload.role,
        modality=payload.modality,
        text=payload.text,
    )
    return {"message": message_out(message), "sample": True}


@router.post("/agent/chat", tags=["agent"])
def agent_chat(
    payload: AgentChatRequest,
    session: SessionDep,
    principal: AgentRateLimitedDep,
) -> dict[str, Any]:
    return chat(session, principal, payload)


@router.websocket("/agent/voice")
async def agent_voice(websocket: WebSocket) -> None:
    authenticated = await websocket_principal(websocket)
    if authenticated is None:
        return
    principal, session = authenticated
    try:
        await handle_voice_socket(websocket, principal, session)
    finally:
        session.close()


@router.post("/actions/prepare", status_code=status.HTTP_201_CREATED, tags=["approvals"])
def prepare(
    payload: ActionPrepare, session: SessionDep, principal: WriterDep
) -> dict[str, Any]:
    action = prepare_action(session, principal, payload)
    return {"action": action_out(action), "sample": True}


@router.get("/actions/{action_id}", tags=["approvals"])
def get_action(
    action_id: str, session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    action = session.get(ActionApproval, action_id)
    if action is None or action.workspace_id != principal.workspace_id:
        raise HTTPException(status_code=404, detail="Action not found.")
    return {"action": action_out(action), "sample": True}


@router.post("/actions/{action_id}/approve", tags=["approvals"])
async def approve(
    action_id: str,
    payload: ActionApprove,
    session: SessionDep,
    principal: OwnerDep,
) -> dict[str, Any]:
    action, payload_out = await approve_action(
        session, principal, action_id, payload.expected_hash
    )
    return {
        "action": payload_out,
        "sample": True,
        "providerMode": settings.provider_mode,
        "simulated": action.simulated,
    }


@router.post("/actions/{action_id}/reject", tags=["approvals"])
def reject(
    action_id: str,
    session: SessionDep,
    principal: OwnerDep,
    reason: str = "",
) -> dict[str, Any]:
    action, payload_out = reject_action(session, principal, action_id, reason)
    return {"action": payload_out, "sample": True, "simulated": action.simulated}


@router.get("/actions", tags=["approvals"])
def list_actions(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    actions = session.exec(
        select(ActionApproval)
        .where(ActionApproval.workspace_id == principal.workspace_id)
        .order_by(ActionApproval.created_at.desc())
    ).all()
    return {"sample": True, "actions": [action_out(action) for action in actions]}


@router.get("/tool-executions", tags=["approvals"])
def tool_executions(
    session: SessionDep, principal: PrincipalDep
) -> dict[str, Any]:
    rows = session.exec(
        select(ToolExecution)
        .where(ToolExecution.workspace_id == principal.workspace_id)
        .order_by(ToolExecution.created_at.desc())
        .limit(200)
    ).all()
    return {
        "sample": True,
        "toolExecutions": [
            {
                "id": row.id,
                "conversationId": row.conversation_id,
                "messageId": row.message_id,
                "tool": row.tool,
                "args": row.args_summary,
                "status": row.status,
                "sourceRefs": row.source_refs,
                "at": to_iso(row.created_at),
            }
            for row in rows
        ],
    }
