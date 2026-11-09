"""Agent backends behind one interface.

The deterministic engine is always available and is the source of truth for
figures. When Gemini is configured it rewrites the grounded answer; it never
replaces the retrieved facts. If Gemini is unavailable or errors, the
deterministic answer is returned unchanged.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, replace
from typing import Any, Protocol

from sqlmodel import Session

from ..core.config import settings
from ..core.logging import log
from ..core.security import Principal
from ..models import Invoice, Project, utcnow
from ..timeutil import parse_dt
from .agent_tools import (
    ToolResult,
    detect_scope_changes,
    draft_payment_reminder,
    get_deadlines,
    get_integrations,
    get_leads,
    get_pending_payments,
    get_project_summary,
    get_reports,
    open_invoices,
)


@dataclass(slots=True)
class AgentReply:
    text: str
    sources: list[dict[str, Any]]
    tools: list[ToolResult]
    backend: str
    action_id: str | None = None
    facts: dict[str, Any] = field(default_factory=dict)


class AgentBackend(Protocol):
    name: str

    def respond(
        self,
        *,
        session: Session,
        principal: Principal,
        message: str,
        project_id: str | None,
    ) -> AgentReply: ...


PROJECT_HINTS = {
    "northwind": "p-northwind",
    "rahul": "p-northwind",
    "fjord": "p-fjord",
    "maya": "p-fjord",
    "okafor": "p-okafor",
    "daniel": "p-okafor",
    "saffron": "p-saffron",
    "priya": "p-saffron",
    "waypoint": "p-waypoint",
    "leo": "p-waypoint",
}


def _fmt_date(value: str | None) -> str:
    if not value:
        return "no date"
    try:
        return parse_dt(value).strftime("%d %b")
    except Exception:  # noqa: BLE001
        return value[:10]


class DeterministicAgent:
    name = "deterministic"

    def respond(
        self,
        *,
        session: Session,
        principal: Principal,
        message: str,
        project_id: str | None,
    ) -> AgentReply:
        text = message.lower()
        workspace_id = principal.workspace_id
        resolved_project = project_id or next(
            (value for key, value in PROJECT_HINTS.items() if key in text), None
        )
        tools: list[ToolResult] = []
        action_id: str | None = None

        if any(word in text for word in ("remind", "nudge", "chase", "follow up on the invoice")):
            tools, reply, action_id = self._reminder(
                session, principal, resolved_project, text
            )
        elif any(word in text for word in ("unpaid", "outstanding", "payment", "invoice", "money", "paid", "owes")):
            payments = get_pending_payments(session, workspace_id, resolved_project)
            tools = [payments]
            reply = self._payments_text(payments)
        elif any(word in text for word in ("scope", "change", "login", "authentication", "payment page", "extra work")):
            scope = detect_scope_changes(session, workspace_id, resolved_project)
            projects = get_project_summary(session, workspace_id, resolved_project)
            tools = [scope, projects]
            reply = self._scope_text(scope)
        elif any(word in text for word in ("deadline", "due", "today", "tomorrow", "this week", "calendar")):
            deadlines = get_deadlines(session, workspace_id, days=14, project_id=resolved_project)
            tools = [deadlines]
            reply = self._deadlines_text(deadlines)
        elif any(word in text for word in ("lead", "leads", "pipeline", "prospect")):
            leads = get_leads(session, workspace_id)
            tools = [leads]
            reply = self._leads_text(leads)
        elif any(word in text for word in ("report", "reports", "summary", "update")):
            reports = get_reports(session, workspace_id)
            tools = [reports]
            reply = self._reports_text(reports)
        elif any(word in text for word in ("integration", "connected", "gmail", "telegram", "google calendar", "paypal")):
            integrations = get_integrations(session, workspace_id)
            tools = [integrations]
            reply = self._integrations_text(integrations)
        elif any(word in text for word in ("project", "status", "progress", "health")):
            projects = get_project_summary(session, workspace_id, resolved_project)
            tools = [projects]
            reply = self._projects_text(projects)
        else:
            payments = get_pending_payments(session, workspace_id, resolved_project)
            deadlines = get_deadlines(session, workspace_id, days=14, project_id=resolved_project)
            scope = detect_scope_changes(session, workspace_id, resolved_project)
            tools = [payments, deadlines, scope]
            reply = self._priorities_text(payments, deadlines, scope)

        sources: list[dict[str, Any]] = []
        seen: set[str] = set()
        for tool in tools:
            for source in tool.sources:
                key = f"{source['kind']}:{source['id']}"
                if key not in seen:
                    seen.add(key)
                    sources.append(source)

        return AgentReply(
            text=reply,
            sources=sources,
            tools=tools,
            backend=self.name,
            action_id=action_id,
            facts={tool.name: tool.data for tool in tools},
        )

    # ---- intent composers -------------------------------------------------

    def _payments_text(self, tool: ToolResult) -> str:
        invoices = tool.data.get("invoices", [])
        total = tool.data.get("totalOutstanding", 0)
        if not invoices:
            return "Nothing is outstanding right now. Every non-draft invoice is settled."
        lines = [
            (f"**${total:,.2f} USD** is outstanding across **{len(invoices)} invoice"
            f"{'s' if len(invoices) != 1 else ''}**."),
            "",
        ]
        for row in invoices:
            overdue = " · overdue" if row["overdue"] else ""
            lines.append(
                f"- {row['number']} · **${row['outstanding']:,.2f}** · "
                f"due {_fmt_date(row['dueAt'])}{overdue}"
            )
        lines.append("")
        lines.append(
            "Figures come from the invoice records; PayPal Sandbox timestamps are shown as the source check."
        )
        return "\n".join(lines)

    def _scope_text(self, tool: ToolResult) -> str:
        findings = tool.data.get("findings", [])
        if not findings:
            return "I found no scope findings in this workspace."
        potential = [
            row
            for row in findings
            if row["classification"] == "potential_change" and row["reviewState"] == "potential"
        ]
        if not potential:
            return (
                f"I checked {len(findings)} finding(s). None are unreviewed potential changes."
            )
        lines = [f"**{len(potential)} scope change(s) need review.**", ""]
        for row in potential:
            estimate = (
                f" My estimate is **${row['estimate']:,.0f}**, not a quoted price."
                if row["estimate"]
                else ""
            )
            lines.append(
                f"- **{row['title']}** — clause {row['clauseId']}, "
                f"{round(row['confidence'] * 100)}% confidence.{estimate}"
            )
        lines.append("")
        lines.append(
            "Nothing was changed or sent. Review this in Inbox before replying to the client."
        )
        return "\n".join(lines)

    def _deadlines_text(self, tool: ToolResult) -> str:
        deadlines = tool.data.get("deadlines", [])
        if not deadlines:
            return "There are no open deadlines in the next 14 days."
        lines = [f"**{len(deadlines)} deadline(s) in the next 14 days.**", ""]
        for row in deadlines[:8]:
            lines.append(
                f"- {row['title']} · **{row['project']}** · due {_fmt_date(row['dueAt'])} "
                f"({row['status'].replace('_', ' ')})"
            )
        return "\n".join(lines)

    def _leads_text(self, tool: ToolResult) -> str:
        leads = tool.data.get("leads", [])
        if not leads:
            return "There are no leads in the pipeline."
        counts: dict[str, int] = {}
        for row in leads:
            counts[row["stage"]] = counts.get(row["stage"], 0) + 1
        stage_text = ", ".join(f"{stage} {count}" for stage, count in counts.items())
        lines = [
            f"**{len(leads)} leads** · **${tool.data.get('openPipeline', 0):,.0f}** open pipeline.",
            "",
            f"Stages: {stage_text}.",
            "",
        ]
        for row in leads[:3]:
            lines.append(
                f"- {row['name']} ({row['company']}) · {row['stage']} · "
                f"next: {row['nextAction'] or 'no next action'}"
            )
        return "\n".join(lines)

    def _reports_text(self, tool: ToolResult) -> str:
        reports = tool.data.get("reports", [])
        if not reports:
            return "No reports have been generated yet."
        drafts = [row for row in reports if row["status"] == "draft"]
        lines = [f"**{len(reports)} report(s)**, **{len(drafts)} draft**.", ""]
        for row in reports[:5]:
            suffix = " · simulated delivery" if row.get("simulated") else ""
            lines.append(f"- {row['title']} · {row['status']}{suffix}")
        if drafts:
            lines.append("")
            lines.append("Drafts are not sent until you review and approve them.")
        return "\n".join(lines)

    def _integrations_text(self, tool: ToolResult) -> str:
        rows = tool.data.get("integrations", [])
        lines = [
            "Provider mode is **simulated** unless real credentials are configured."
            if settings.simulated_providers
            else "Provider mode is **real**; writes use the official provider APIs.",
            "",
        ]
        for row in rows:
            state = "connected" if row["connected"] else "not connected"
            suffix = " · simulated" if row.get("simulated") else ""
            lines.append(f"- {row['name']} · {state}{suffix}")
        lines.append("")
        lines.append("External writes still require explicit approval.")
        return "\n".join(lines)

    def _projects_text(self, tool: ToolResult) -> str:
        projects = tool.data.get("projects", [])
        if not projects:
            return "No projects found in this workspace."
        lines = [f"**{len(projects)} project(s).**", ""]
        for row in projects:
            lines.append(
                f"- **{row['name']}** · {row['status']} · {row['progress']}% · "
                f"${row['paid']:,.0f} of ${row['budget']:,.0f} collected"
            )
        return "\n".join(lines)

    def _priorities_text(
        self, payments: ToolResult, deadlines: ToolResult, scope: ToolResult
    ) -> str:
        parts = ["Here is what needs attention, grounded in your workspace.", ""]
        parts.append(self._payments_text(payments))
        parts.append("")
        parts.append(self._deadlines_text(deadlines))
        parts.append("")
        parts.append(self._scope_text(scope))
        return "\n".join(parts)

    def _reminder(
        self,
        session: Session,
        principal: Principal,
        project_id: str | None,
        text: str,
    ) -> tuple[list[ToolResult], str, str | None]:
        invoices = open_invoices(session, principal.workspace_id, project_id)
        if not invoices:
            payments = get_pending_payments(session, principal.workspace_id, project_id)
            return [payments], "There is no open invoice to remind anyone about.", None
        target: Invoice | None = None
        for invoice in invoices:
            if invoice.number.lower() in text:
                target = invoice
                break
        if target is None:
            target = next((row for row in invoices if row.due_at < utcnow()), invoices[0])
        project = session.get(Project, target.project_id)
        tool = draft_payment_reminder(session, principal, target, project)
        action_id = tool.data.get("actionId")
        if tool.status != "done" or not action_id:
            return [tool], "I could not prepare a reminder safely. Nothing was sent.", None
        text_out = (
            f"I prepared a reminder for **{target.number}** "
            f"(**${(target.amount_cents - target.amount_paid_cents) / 100:,.2f}**, "
            f"due {_fmt_date(target.due_at.isoformat())}). "
            "It has **not been sent** — approve it and I will execute exactly once."
        )
        return [tool], text_out, str(action_id)


class GeminiAgent:
    """Optional grounded rephrasing through Gemini.

    Retrieval is always deterministic. Gemini receives the retrieved facts and
    is asked to rewrite the answer without adding numbers. Tool results and
    sources stay unchanged.
    """

    name = "gemini"

    def __init__(self, fallback: DeterministicAgent) -> None:
        self.fallback = fallback

    def respond(
        self,
        *,
        session: Session,
        principal: Principal,
        message: str,
        project_id: str | None,
    ) -> AgentReply:
        grounded = self.fallback.respond(
            session=session,
            principal=principal,
            message=message,
            project_id=project_id,
        )
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            log.info("gemini_sdk_missing", fallback="deterministic")
            return grounded
        try:
            client = genai.Client(api_key=settings.google_api_key)
            prompt = (
                "Rewrite the grounded answer for a freelance operator. Keep every number, "
                "invoice number, date, and caveat exactly as given. Do not add facts. "
                "Use short paragraphs and bold for key figures. Keep markdown.\n\n"
                f"User question: {message}\n\n"
                f"Grounded answer:\n{grounded.text}\n\n"
                f"Facts JSON:\n{json.dumps(grounded.facts, default=str)[:6000]}"
            )
            response = client.models.generate_content(
                model=settings.gemini_text_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    system_instruction=(
                        "You are Visun, a precise freelancer operations assistant. "
                        "Only restate the supplied grounded answer. Never invent amounts, "
                        "statuses, or provider outcomes."
                    ),
                ),
            )
            rewritten = (response.text or "").strip()
            if rewritten:
                grounded.text = rewritten
                grounded.backend = self.name
        except Exception as exc:  # noqa: BLE001 - fallback beats a broken answer
            log.warning("gemini_text_failed", error=str(exc))
        return grounded


class AdkAgent:
    """Google ADK tool-calling agent, with the deterministic engine as fallback.

    The model picks and orders the workspace tools. Every tool result is read
    back from the database. If ADK raises (missing package, bad key, quota,
    timeout) the grounded deterministic answer is returned and the failure is
    logged, so the UI never shows an invented result.
    """

    name = "adk"

    def __init__(self, fallback: DeterministicAgent) -> None:
        self.fallback = fallback

    def respond(
        self,
        *,
        session: Session,
        principal: Principal,
        message: str,
        project_id: str | None,
    ) -> AgentReply:
        from .adk_agent import AdkUnavailable, run_adk
        from .ai_config import resolve_ai_config, text_model_fallback

        config = resolve_ai_config(session, principal.workspace_id)
        if config is None:
            return self.fallback.respond(
                session=session, principal=principal, message=message, project_id=project_id
            )
        try:
            text, trace = run_adk(
                session=session, principal=principal, message=message, config=config
            )
        except AdkUnavailable as exc:
            # A retired model id (or one Google has restricted) should not take
            # chat down: retry once with a known-working text model.
            retry_model = text_model_fallback(config.text_model, str(exc))
            if retry_model is not None:
                log.warning(
                    "adk_retry_model",
                    model=config.text_model,
                    retry=retry_model,
                    reason=str(exc)[:160],
                )
                try:
                    text, trace = run_adk(
                        session=session,
                        principal=principal,
                        message=message,
                        config=replace(config, text_model=retry_model),
                    )
                except AdkUnavailable as retry_exc:
                    return self._unavailable(
                        retry_exc, session, principal, message, project_id
                    )
            else:
                return self._unavailable(exc, session, principal, message, project_id)

        tools = [
            ToolResult(
                name=entry["name"],
                args=json.dumps(entry.get("args", {}), default=str)[:400],
                status=entry["status"],
                result=entry["result"],
                data=entry.get("payload") or {},
            )
            for entry in trace
        ]
        action_id = next(
            (
                str(entry["payload"]["actionId"])
                for entry in trace
                if isinstance(entry.get("payload"), dict) and entry["payload"].get("actionId")
            ),
            None,
        )
        return AgentReply(
            text=text,
            sources=[],
            tools=tools,
            backend=self.name,
            action_id=action_id,
            facts={tool.name: tool.data for tool in tools},
        )

    def _unavailable(
        self,
        exc: Exception,
        session: Session,
        principal: Principal,
        message: str,
        project_id: str | None,
    ) -> AgentReply:
        """Honest fallback with a short, actionable reason instead of provider JSON."""
        log.warning("adk_fallback", reason=str(exc)[:200])
        grounded = self.fallback.respond(
            session=session, principal=principal, message=message, project_id=project_id
        )
        detail = str(exc).lower()
        reason = "Gemini rejected the request"
        hint = " Pick a different text model in Settings → Integrations."
        if "503" in detail or "unavailable" in detail or "high demand" in detail:
            reason = "Gemini is temporarily busy"
            hint = " Try again in a moment."
        elif "429" in detail or "quota" in detail or "rate limit" in detail:
            reason = "the API quota was exhausted"
            hint = " Check the key's quota in Google AI Studio."
        elif "api key" in detail or "permission" in detail or "401" in detail or "403" in detail:
            reason = "the API key was rejected"
            hint = " Update the Gemini key in Settings → Integrations."
        elif "live" in detail or "bidi" in detail:
            reason = "that model only supports voice, not text chat"
        elif "404" in detail or "not_found" in detail or "no longer available" in detail:
            reason = "that model is no longer available"
        grounded.text = (
            f"_Gemini could not answer ({reason}), so this answer comes from the "
            f"deterministic engine.{hint}_\n\n" + grounded.text
        )
        return grounded


def configured_agent(session: Session | None = None, workspace_id: str | None = None) -> AgentBackend:
    deterministic = DeterministicAgent()
    if settings.agent_backend == "deterministic":
        return deterministic
    from .ai_config import resolve_ai_config

    config = (
        resolve_ai_config(session, workspace_id)
        if session is not None and workspace_id is not None
        else None
    )
    if config is not None:
        return AdkAgent(deterministic)
    if settings.gemini_configured:
        return GeminiAgent(deterministic)
    return deterministic


def agent_status(
    session: Session | None = None, workspace_id: str | None = None
) -> dict[str, Any]:
    from .ai_config import ai_status

    ai = ai_status(session, workspace_id) if session is not None and workspace_id else {
        "configured": settings.gemini_configured,
        "textModel": settings.gemini_text_model or None,
        "liveModel": settings.gemini_live_model or None,
        "source": "environment" if settings.gemini_configured else None,
        "voiceCapable": bool(settings.gemini_live_model and settings.google_api_key),
    }
    backend = "deterministic"
    if settings.agent_backend != "deterministic" and ai.get("configured"):
        backend = "adk"
    return {
        "backend": backend,
        "geminiConfigured": bool(ai.get("configured")),
        "agentBackendSetting": settings.agent_backend,
        "groundedTools": True,
        "ai": ai,
    }
