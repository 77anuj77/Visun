"""Voice transport.

Text-first fallback works everywhere: the browser performs speech recognition
and sends finalized transcripts; the backend runs the same grounded agent and
returns synchronized chat events.

When `GOOGLE_API_KEY` and `GEMINI_LIVE_MODEL` are configured, an authenticated
browser can stream PCM audio to the Gemini Live API through this backend. The
API key never reaches the client. Function calls are executed by the same
grounded tools, and approval remains a separate explicit REST/UI action.
"""

from __future__ import annotations

import asyncio
import base64
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlmodel import Session

from ..core.config import settings
from ..core.logging import log
from ..core.security import Principal
from ..schemas import AgentChatRequest
from .agent_tools import (
    detect_scope_changes,
    get_deadlines,
    get_leads,
    get_pending_payments,
    get_reports,
)
from .assistant import append_message, chat, ensure_conversation


async def handle_voice_socket(
    websocket: WebSocket, principal: Principal, session: Session
) -> None:
    if settings.gemini_live_configured and settings.voice_backend != "browser":
        try:
            await _gemini_live(websocket, principal, session)
            return
        except Exception as exc:  # noqa: BLE001 - fall back to transcript mode
            log.warning("gemini_live_failed", error=str(exc))
            await websocket.send_json(
                {
                    "type": "status",
                    "state": "fallback",
                    "message": "Gemini Live unavailable; using browser transcripts.",
                }
            )
    await _transcript_mode(websocket, principal, session)


async def _transcript_mode(
    websocket: WebSocket, principal: Principal, session: Session
) -> None:
    await websocket.send_json(
        {
            "type": "status",
            "state": "ready",
            "mode": "transcript",
            "sample": True,
            "message": "Send finalized transcripts; replies use the grounded agent.",
        }
    )
    conversation_id: str | None = None
    try:
        while True:
            frame = await websocket.receive_json()
            frame_type = frame.get("type", "transcript")
            if frame_type == "close":
                break
            if frame_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if frame_type not in {"transcript", "text"}:
                await websocket.send_json(
                    {
                        "type": "error",
                        "code": "unsupported_frame",
                        "message": "This server accepts transcript/text frames unless Gemini Live is configured.",
                    }
                )
                continue
            text = str(frame.get("text") or "").strip()
            if not text:
                continue
            conversation_id = frame.get("conversation_id") or conversation_id
            await websocket.send_json(
                {"type": "transcript", "role": "user", "text": text}
            )
            request = AgentChatRequest(
                conversation_id=conversation_id,
                message=text,
                modality="voice",
                client_message_id=frame.get("client_message_id"),
                project_id=frame.get("project_id"),
            )
            result = chat(session, principal, request)
            conversation_id = result["conversationId"]
            await websocket.send_json(
                {
                    "type": "assistant",
                    "conversationId": conversation_id,
                    "message": result["message"],
                    "backend": result["backend"],
                }
            )
            for tool in result.get("tools", []):
                await websocket.send_json({"type": "tool", "tool": tool})
            if result.get("action"):
                await websocket.send_json(
                    {"type": "approval", "action": result["action"]}
                )
            await websocket.send_json(
                {"type": "status", "state": "listening", "mode": "transcript"}
            )
    except WebSocketDisconnect:
        return
    finally:
        await websocket.close()


def _live_tools() -> list[Any]:
    # Declarations are intentionally small; retrieval stays deterministic.
    return [
        {
            "name": "get_pending_payments",
            "description": "List open invoices and outstanding totals for this workspace.",
        },
        {
            "name": "get_deadlines",
            "description": "List open milestones due in the next 14 days.",
        },
        {
            "name": "detect_scope_changes",
            "description": "List scope findings needing review with agreement clauses.",
        },
        {
            "name": "get_leads",
            "description": "List leads and pipeline value.",
        },
        {
            "name": "get_reports",
            "description": "List generated reports and their delivery status.",
        },
    ]


async def _gemini_live(
    websocket: WebSocket, principal: Principal, session: Session
) -> None:
    """Best-effort Gemini Live bridge with the same tool surface.

    Audio frames are base64 PCM16. Tool calls are executed against persisted
    data and returned to the model; approvals are never executed from voice.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.google_api_key)
    conversation_id: str | None = None
    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=(
            "You are Visun, a concise freelance operations assistant. Use tools for all "
            "figures. Never send email, change agreements, or initiate payments; prepare "
            "an approval instead and say it is waiting for explicit approval."
        ),
        tools=[{"function_declarations": _live_tools()}],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )
    await websocket.send_json(
        {
            "type": "status",
            "state": "ready",
            "mode": "gemini_live",
            "model": settings.gemini_live_model,
        }
    )
    user_buffer: list[str] = []
    assistant_buffer: list[str] = []
    async with client.aio.live.connect(
        model=settings.gemini_live_model, config=config
    ) as live:
        stop = asyncio.Event()

        async def pump_client() -> None:
            nonlocal conversation_id
            try:
                while not stop.is_set():
                    frame = await websocket.receive_json()
                    frame_type = frame.get("type")
                    conversation_id = frame.get("conversation_id") or conversation_id
                    if frame_type == "close":
                        stop.set()
                        return
                    if frame_type == "audio":
                        data = base64.b64decode(frame.get("data", ""))
                        await live.send_realtime_input(
                            audio=types.Blob(
                                data=data, mime_type="audio/pcm;rate=16000"
                            )
                        )
                    elif frame_type in {"transcript", "text"}:
                        text = str(frame.get("text") or "").strip()
                        if text:
                            await live.send_client_content(
                                turns=types.Content(
                                    role="user", parts=[types.Part(text=text)]
                                ),
                                turn_complete=True,
                            )
                    elif frame_type == "ping":
                        await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                stop.set()

        async def pump_model() -> None:
            nonlocal conversation_id
            async for response in live.receive():
                if stop.is_set():
                    return
                server = getattr(response, "server_content", None)
                if server is not None:
                    input_text = getattr(server, "input_transcription", None)
                    if input_text and input_text.text:
                        user_buffer.append(input_text.text)
                        await websocket.send_json(
                            {
                                "type": "transcript",
                                "role": "user",
                                "text": input_text.text,
                            }
                        )
                    output_text = getattr(server, "output_transcription", None)
                    if output_text and output_text.text:
                        assistant_buffer.append(output_text.text)
                        await websocket.send_json(
                            {
                                "type": "transcript",
                                "role": "assistant",
                                "text": output_text.text,
                            }
                        )
                    turn = getattr(server, "model_turn", None)
                    if turn is not None:
                        for part in turn.parts or []:
                            inline = getattr(part, "inline_data", None)
                            if inline and inline.data:
                                await websocket.send_json(
                                    {
                                        "type": "audio",
                                        "mimeType": inline.mime_type,
                                        "data": base64.b64encode(inline.data).decode("ascii"),
                                    }
                                )
                            elif getattr(part, "text", None):
                                await websocket.send_json(
                                    {
                                        "type": "transcript",
                                        "role": "assistant",
                                        "text": part.text,
                                    }
                                )
                tool_call = getattr(response, "tool_call", None)
                if tool_call and tool_call.function_calls:
                    responses = []
                    for call in tool_call.function_calls:
                        result = _run_live_tool(
                            session, principal, call.name, dict(call.args or {})
                        )
                        responses.append(
                            {
                                "id": call.id,
                                "name": call.name,
                                "response": {"result": result},
                            }
                        )
                    await live.send_tool_response(function_responses=responses)
                if getattr(server, "turn_complete", False) and conversation_id:
                    # Persist the finalized turn so voice and text share one history.
                    conversation = ensure_conversation(
                        session, principal, conversation_id, "Voice session"
                    )
                    conversation_id = conversation.id
                    if user_buffer:
                        append_message(
                            session,
                            principal,
                            conversation_id,
                            role="user",
                            modality="voice",
                            text=" ".join(user_buffer).strip(),
                        )
                        user_buffer.clear()
                    if assistant_buffer:
                        append_message(
                            session,
                            principal,
                            conversation_id,
                            role="assistant",
                            modality="text",
                            text=" ".join(assistant_buffer).strip(),
                        )
                        assistant_buffer.clear()

        tasks = [asyncio.create_task(pump_client()), asyncio.create_task(pump_model())]
        try:
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        finally:
            stop.set()
            for task in tasks:
                task.cancel()
            await websocket.close()


def _run_live_tool(
    session: Session, principal: Principal, name: str, args: dict[str, Any]
) -> Any:
    workspace_id = principal.workspace_id
    project_id = args.get("project_id")
    if name == "get_pending_payments":
        tool = get_pending_payments(session, workspace_id, project_id)
    elif name == "get_deadlines":
        tool = get_deadlines(session, workspace_id, project_id=project_id)
    elif name == "detect_scope_changes":
        tool = detect_scope_changes(session, workspace_id, project_id)
    elif name == "get_leads":
        tool = get_leads(session, workspace_id)
    elif name == "get_reports":
        tool = get_reports(session, workspace_id)
    else:
        return {"error": "Unknown tool. No action was taken."}
    return {"summary": tool.result, "data": tool.data, "sources": tool.sources}
