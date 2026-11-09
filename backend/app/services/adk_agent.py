"""Google ADK runtime for Visun's tool-calling agent.

The model chooses tools; the tools themselves are plain functions bound to the
authenticated session and workspace (see `workspace_tools`). Nothing here
invents results: if ADK or the model fails, the caller falls back to the
deterministic engine instead of presenting a fabricated answer.

Requires `GOOGLE_API_KEY` (or a workspace-saved key) and a model id such as
`gemini-2.5-flash`. `google-adk` is installed as an optional dependency.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import uuid
from typing import Any

from sqlmodel import Session

from ..core.logging import log
from .ai_config import AiConfig
from .workspace_tools import build_tools

INSTRUCTION = """You are Visun, an operations assistant for a freelancer.

Rules:
- Use the provided tools for every fact. Never invent projects, invoices, dates,
  amounts, or outcomes.
- Only the tools' workspace is visible to you; there is no other data.
- Creating a project, deadline, lead, or report draft is allowed and should be
  done with the matching tool.
- Sending email, creating payment requests, or changing agreements is NOT
  allowed directly: use prepare_payment_reminder, then tell the user it needs
  approval.
- Resolve relative dates ("tomorrow", "Friday") using the workspace timezone and
  pass ISO dates (YYYY-MM-DD) to the tools.
- After a write, report exactly what the tool returned, including ids and dates.
- If a tool returns ok=false, say what failed and do not claim success.
"""

RUN_TIMEOUT_SECONDS = 90


class AdkUnavailable(RuntimeError):
    """ADK could not run (missing package, bad key, model error)."""


def _tool_trace(events: list[Any]) -> list[dict[str, Any]]:
    """Function calls and their responses, in the order ADK emitted them."""
    calls: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for event in events:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            call = getattr(part, "function_call", None)
            if call is not None and getattr(call, "name", None):
                key = f"{call.name}-{len(order)}"
                order.append(key)
                calls[key] = {
                    "name": call.name,
                    "args": dict(getattr(call, "args", {}) or {}),
                    "status": "running",
                    "result": "",
                    "payload": {},
                }
            response = getattr(part, "function_response", None)
            if response is not None and getattr(response, "name", None):
                for key in reversed(order):
                    if calls[key]["name"] == response.name and calls[key]["status"] == "running":
                        payload = getattr(response, "response", None) or {}
                        calls[key]["status"] = "success"
                        calls[key]["payload"] = payload if isinstance(payload, dict) else {}
                        calls[key]["result"] = str(payload)[:800]
                        break
    return [calls[key] for key in order]


def _final_text(events: list[Any]) -> str:
    texts: list[str] = []
    for event in events:
        content = getattr(event, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            text = getattr(part, "text", None)
            if text and not getattr(event, "partial", False):
                texts.append(text)
    return "\n".join(texts).strip()


def run_adk(
    *,
    session: Session,
    principal: Any,
    message: str,
    config: AiConfig,
) -> tuple[str, list[dict[str, Any]]]:
    """Run one ADK turn. Raises AdkUnavailable when it cannot be trusted."""
    try:
        from google.adk.agents import LlmAgent
        from google.adk.models.google_llm import Gemini
        from google.adk.runners import InMemoryRunner
        from google.genai import types
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise AdkUnavailable("google-adk is not installed.") from exc

    tools = build_tools(session, principal)
    model = Gemini(model=config.text_model, client_kwargs={"api_key": config.api_key})
    agent = LlmAgent(name="visun", model=model, instruction=INSTRUCTION, tools=tools)
    runner = InMemoryRunner(agent=agent, app_name="visun-agent")
    session_id = f"visun-{uuid.uuid4().hex[:12]}"

    def _invoke() -> list[Any]:
        asyncio.run(
            runner.session_service.create_session(
                app_name="visun-agent", user_id=principal.user_id, session_id=session_id
            )
        )
        stream = runner.run(
            user_id=principal.user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=message)]),
        )
        return list(stream)

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            events = pool.submit(_invoke).result(timeout=RUN_TIMEOUT_SECONDS)
    except concurrent.futures.TimeoutError as exc:
        raise AdkUnavailable(f"ADK timed out after {RUN_TIMEOUT_SECONDS}s.") from exc
    except Exception as exc:  # any model/auth error must fall back
        log.warning("adk_run_failed", error=f"{type(exc).__name__}: {exc}"[:300])
        raise AdkUnavailable(str(exc)) from exc

    trace = _tool_trace(events)
    text = _final_text(events)
    if not text and not trace:
        raise AdkUnavailable("ADK returned no message and called no tools.")
    if not text and trace:
        text = "I ran: " + ", ".join(entry["name"] for entry in trace) + "."
    log.info("adk_run_ok", tools=[entry["name"] for entry in trace], model=config.text_model)
    return text, trace


__all__ = ["AdkUnavailable", "run_adk"]
