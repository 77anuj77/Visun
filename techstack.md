# Visun — Technical Stack & Library-First Implementation Guide

**Product:** Visun — *Talk. Manage. Execute.*  
**Document:** `techstack.md`  
**Version:** 1.2 — implemented stack (SQLite demo, optional Clerk/Supabase)  
**Updated:** 3 November 2026  
**Related:** [`PRD.md`](./PRD.md), [`frontend.md`](./frontend.md), [`backend.md`](./backend.md)

> **Implementation status:** The repository ships the modular monolith below. It works credential-free (`AUTH_MODE=demo`, `PROVIDER_MODE=simulated`, SQLite) and switches to Clerk + PostgreSQL/Supabase with environment variables. Gemini/ADK and real provider adapters are optional layers over the same deterministic tool and approval interface. The frontend uses a small custom design-system/UI kit instead of shadcn, and a typed `fetch` client plus a React context store instead of TanStack Query.

> **Primary engineering rule:** Do not write raw infrastructure or lengthy custom implementations when a mature, maintained library, official SDK, or framework already does the job. Prefer a small amount of explicit **business logic** over custom agent runtimes, socket protocols, OAuth implementations, email transports, UI primitives, or payment SDKs. Avoid unnecessary dependencies, too: one good library per problem.

---

## 1. Executive decision

**Build a modular monolith**: one Next.js frontend, one FastAPI backend, SQLite by default with PostgreSQL/Supabase as the production database, and a small set of official API integrations. The voice and text interfaces share the **same Visun agent tools, permissions, data, and audit trail**.

| Layer | Selected technology | Library / SDK | Why |
|---|---|---|---|
| Language | TypeScript + Python 3.12+ | — | Fast iteration, mature SDK ecosystem |
| Frontend | Next.js 16 (App Router) + React 19 | `next`, `react`, `typescript` | Routing, rendering, production build |
| Styling | Tailwind CSS 4 + custom UI kit | `tailwindcss`, `lucide-react` | Exact Visun editorial/neumorphic design; no unused component dependency |
| Motion | Motion for React | `motion` | Simple animation without custom timeline code |
| Data fetching | Typed `fetch` client + React context store | native `fetch`, React 19 | Explicit backend hydration, optimistic write-through, honest offline fallback |
| Dashboard charts | Recharts | `recharts` | Payments, projects, milestones |
| Calendar UI | Custom month/list views with date-fns | `date-fns` | Small, controlled UI matching the design system |
| Backend API | FastAPI | `fastapi`, `uvicorn`, `pydantic-settings` | OpenAPI, validation, WebSocket support |
| Database models | SQLModel | `sqlmodel` | Concise Pydantic + SQLAlchemy-style models |
| Migrations | Alembic | `alembic` | Versioned relational schema on SQLite and PostgreSQL |
| Database | SQLite default; PostgreSQL/Supabase via `DATABASE_URL` | `psycopg[binary]` for Postgres | Zero-credential demo, production-grade override |
| Authentication | Demo mode locally; **Clerk** JWT verification in production | `PyJWT[crypto]` + cached JWKS | Credential-free demo with a real production path |
| Agent | Deterministic grounded tools; optional Gemini phrasing | Python services; `google-genai` optional | Reliable, inspectable answers with no model credential required |
| Agent orchestration | Optional Google ADK adapter | `google-adk` (optional extra) | Use where it adds value; the demo does not depend on it |
| Live voice | Browser Web Speech + backend transcript WebSocket; optional Gemini Live bridge | Web Speech API, FastAPI WS, `google-genai` optional | Voice works credential-free and preserves one history |
| PayPal | Simulated adapter; real REST via `httpx` | `httpx` | Invoice/order status only from verified provider responses |
| Email | Simulated adapter; Gmail API in real mode | `google-api-python-client`, `google-auth-oauthlib` | Draft/send as authorized user |
| Calendar provider | Simulated adapter; Google Calendar API in real mode | Same Google client + OAuth packages | Authorized events and scheduling |
| Telegram ingestion | Simulated adapter; Bot API webhook in real mode | `python-telegram-bot` | Project chat events through bot permissions |
| Background tasks | FastAPI `BackgroundTasks` only where needed | — | Keep MVP simple |
| Reports | Source-backed preview; optional WeasyPrint PDF | `jinja2`, `weasyprint` optional | HTML/facts first, PDF when installed |
| Testing | Pytest + FastAPI TestClient | `pytest`, `httpx` | API workflows on SQLite and PostgreSQL |
| Observability | Structured Python logging + persisted audit rows | `structlog` | Explain agent/tool behavior without a tracing platform |
| Deployment | Vercel frontend + Render/Cloud Run API + Supabase Postgres | Managed platforms | Keep the team focused on the product |

**Avoid:** custom speech recognition, custom TTS, custom LLM routing frameworks, homemade calendar UI, handwritten OAuth2, unofficial WhatsApp scraping, arbitrary payment-processing code, creating separate microservices for every “agent”, or maintaining the same data in independent voice and text databases.

**Library selection caveat:** A recommended package is not a promise that every method supports every requirement. Check its current docs and installed version; use the official REST endpoint for features not included in a provider SDK.

---

## 2. Product-first architecture

```text
                           VISUN FRONTEND (Next.js)
        ┌──────────────────────────────────────────────────┐
        │ Dashboard | Projects | Calendar | Payments | AI  │
        │ Voice waveform | Live captions | Saved chat log   │
        │ Review & approve | Lead inbox | Activity log     │
        └────────────────────────┬─────────────────────────┘
                                 │ same-origin /api/backend rewrite
                                 ▼
                        FASTAPI (modular monolith)
        ┌──────────────────────────────────────────────────┐
        │ Demo principal or Clerk JWT + workspace guards    │
        │ REST | transcript WS | tool service | approvals   │
        └───────┬──────────────────┬─────────────────┬─────┘
                │                  │                 │
                ▼                  ▼                 ▼
        Browser speech /     Deterministic      Simulated or real
        Gemini Live bridge   grounded tools     provider adapters
                │            + optional Gemini   PayPal | Gmail
                └──────────────┬───────────────────┘
                               │
                               ▼
          SQLite (default) or PostgreSQL/Supabase
              Projects | invoices | messages
              conversations | approvals | logs
```

- **One business tool layer:** `get_deadlines`, `get_outstanding_payments`, `detect_scope_change`, `get_leads`, `get_report_inputs`, `draft_payment_reminder`, etc. Both text and voice call these same backend functions.
- **One authorization layer:** the model can *propose* actions; only backend policies and real user approvals can *execute* external writes.
- **One durable history:** every finalized user/assistant utterance, tool execution, source reference, approval, and final result has an ordered record.
- **One source of truth:** read PayPal provider status to claim payment success. Never treat a model-generated statement or frontend optimistic update as proof of payment.

---

## 3. Frontend — follow `frontend.md` exactly

### 3.1 Libraries

| Need | Reuse this instead of writing it |
|---|---|
| Design tokens, buttons, fields, badges, panels, modal, drawer, toast | In-repo UI kit in `frontend/components/ui` built on Tailwind 4 and native focus management |
| Async server state | Typed `frontend/lib/api.ts` client plus the `AppStoreProvider` context; each mutation writes through to the API and falls back honestly |
| Calendar month/list | Custom views with `date-fns`; no calendar dependency needed for the MVP |
| Financial charts | Recharts |
| Icons | `lucide-react` |
| Motion and feedback | `motion` plus the in-repo toast provider |
| File upload | Not in the MVP; add a signed server upload when attachments ship |
| Voice visualization | Audio-level bars using a simple Web Audio analyser; **don't build a speech-to-text engine** |
| Chat rendering | Lightweight Markdown renderer in the copilot page; add `react-markdown` only if richer formatting is needed |

### 3.2 Visual contract

The brand values are taken from the **user-selected reference palette** in `frontend.md` (approximate swatches):

```css
:root {
  --visun-orange: #FF5A00;
  --visun-black: #1D1D1D;
  --visun-yellow: #FFE17B;
  --visun-stone: #E9E6DF;
  --visun-white: #F8F8F6;
}
```

The marketing site is editorial and expressive; authenticated pages prioritize readability and unambiguous financial statuses. Make all agent actions visible. Maintain keyboard access, color contrast, captions, screen-reader labels, and reduced-motion support.

### 3.3 Pages

```text
/                      Editorial marketing landing page
/app                   Home: deadlines, money, projects, leads
/app/copilot           Voice + text copilot + persisted history
/app/projects          Project list
/app/projects/[id]     Agreement, client chats, milestones, scope changes
/app/calendar          Calendar view
/app/payments          Invoices, requests, payment statuses
/app/leads             Today’s leads and activity
/app/reports           Generate, preview and export reports
/app/inbox             Imported client messages and scope signals
/app/activity          Tool calls, source references, outcomes
/app/settings/integrations   Connections, consents, provider modes
/app/settings/preferences    Profile, voice, notification preferences
```

There is no separate `/login` or `/app/approvals` route in the demo: approvals live inside the copilot action card and are also audited on the activity page. Clerk can wrap the `/app` segment when production auth is enabled.

---

## 4. AI agents — minimal custom code

### 4.1 Recommended choice: Google ADK, **not six custom agent services**

The implemented default is **one deterministic grounded agent** with concise tools for deadlines, payments, scope analysis, reports, leads, email, and calendar. It always runs, needs no API key, and gives the same answers in tests and demos. Gemini can rephrase the grounded result through the same interface; Google ADK is an optional adapter. Split into subagents *only* when a real complexity bottleneck appears.

```python
# Implemented shape: deterministic tools decide facts; optional Gemini only phrases.
reply = configured_agent().respond(
    session=session,
    principal=principal,
    message=user_message,
    project_id=project_id,
)
# reply.tools / reply.sources are persisted with the assistant message.
# reply.action_id, when present, points at a pending ActionApproval.
```

**Actual work is mostly tool adapters**; the model should not calculate balances from unverified prose, guess dates, invent clients, or modify database records directly. The deterministic fallback exists so the product never degrades into fabricated answers when a model key is absent.

**Gemini/ADK integration rule:** Use `google-genai` for phrasing and the Live API for optional voice. If ADK is used, route its function calls into the **same tool service**. Do **not** write a second independent agent/business-logic stack.

### 4.2 Model allocation

| Task | Configuration | Implementation |
|---|---|---|
| Voice conversation with interruptions | `GEMINI_LIVE_MODEL` when `VOICE_BACKEND=gemini_live` | Google GenAI Live API via server-side bridge |
| Grounded answer phrasing | `GEMINI_TEXT_MODEL` when `AGENT_BACKEND=gemini` | Deterministic tool results are passed as facts; Gemini only phrases |
| Scope and message evidence | deterministic rules today; Gemini optional | Validate structured Pydantic output when enabled |
| Report narrative and email drafts | deterministic templates today; Gemini optional | Tool-grounded generation |

With no model configured, the deterministic backend is used and the health endpoint reports `geminiConfigured: false`. Never pretend a Gemini response occurred when it did not.

### 4.3 Voice streaming & persistent transcript

Implemented flow:

1. Browser captures speech with the Web Speech API (with clear permission/unsupported states), or sends text.
2. Finalized text goes to `POST /api/v1/agent/chat` with the same `conversation_id` used by typed chat.
3. The backend persists the user message, runs grounded tools, persists the assistant message, and returns sources/tools/action.
4. `WS /api/v1/agent/voice` accepts `transcript` frames for environments without browser speech support and returns an honest `browser_fallback` mode. If `VOICE_BACKEND=gemini_live` and a model/key are configured, the same socket bridges Gemini Live.
5. Tool calls, pending approvals, decisions, and provider outcomes are persisted in order; the UI can replay the transcript.
6. On reconnect, load conversation messages from the database, not model session memory.

For the first release, **save transcripts and metadata, not raw audio** by default. Recording audio requires a separate, explicit opt-in and retention policy. Provide chat deletion and integration disconnection controls.

### 4.4 Pydantic for scope-change extraction

Example output contract (the human still decides whether a change should be billed):

```python
from pydantic import BaseModel, Field

class ScopeFinding(BaseModel):
    is_potential_change: bool
    summary: str
    matched_clause_ids: list[str]
    supporting_message_ids: list[str]
    rationale: str
    confidence: float = Field(ge=0, le=1)
    requires_human_review: bool = True
```

Store the agreement version and original message references with every finding. Never claim that an AI score proves contractual liability.

---

## 5. Backend, data, and auth

### 5.1 FastAPI + SQLModel + Alembic

Keep thin routes, typed service functions, and provider adapters. `SQLModel` combines Python models with database mappings, reducing duplicated Pydantic/ORM definitions. Use Alembic instead of manual schema changes.

```text
backend/app/
  main.py              # FastAPI app, lifespan, CORS, routers
  api/                 # system, workspace, assistant, webhooks routers
  core/                # env config, database, security, errors, logging
  services/            # actions, agent, agent_tools, assistant, providers, voice
  models.py            # SQLModel entities
  schemas.py           # Pydantic request models
  serializers.py       # API presentation shapes
  seed.py              # deterministic demo workspace
  migrations/          # Alembic baseline
  tests/               # API tests, SQLite + PostgreSQL
```

### 5.2 Core relational entities

`users`, `workspaces`, `workspace_members`, `clients`, `projects`, `agreements`, `milestones`, `tasks`, `leads`, `invoices`, `payments`, `external_messages`, `scope_findings`, `conversations`, `conversation_messages`, `tool_executions`, `action_approvals`, `reports`, `integration_connections`, `webhook_events`, plus `action_events`, `activity_events`, and `preferences` for the audit/UI timeline. The baseline migration creates 24 tables on SQLite and PostgreSQL.

Minimum fields for records supporting financial claims: `workspace_id`, `source_provider`, `provider_object_id`, `provider_status`, `last_verified_at`, `created_at`, `updated_at`. Invoice balances use integer cents, not floats; invoice totals are distinct from verified completed payments.

### 5.3 Authentication: demo locally, Clerk in production

- **`AUTH_MODE=demo`** trusts the seeded local principal (`user_demo_ayush`) so the demo works without credentials. This mode is rejected when `ENVIRONMENT=production`.
- **`AUTH_MODE=clerk`** verifies the bearer JWT independently in FastAPI with `PyJWT[crypto]` and cached JWKS: signature, issuer, expiry, and configured audience. Store the Clerk subject as `clerk_user_id` text and upsert the application user idempotently. Do not trust an unverified `user_id` from the browser.
- Every query is scoped to a workspace membership. Support `owner`, `member`, `viewer`; only authorized actors may approve financial or external actions.
- Clerk secret keys and JWKS configuration stay server-side. The frontend may hold only public configuration.
- If browser-side Supabase access is added later, use Clerk third-party auth and RLS; it is not required by the current MVP, which keeps all database access behind FastAPI.
- Gmail and Google Calendar use **separate explicitly authorized integrations**. Signing in with Clerk does not grant Gmail send or Calendar access. Encrypt refresh tokens and limit scopes.
- The implemented Supabase path is PostgreSQL via `DATABASE_URL`. Storage and Realtime are deferred until the product needs file attachments or live collaboration.
- **Browser auth wiring is not enabled in the demo.** The backend supports Clerk verification; connecting `@clerk/nextjs` protected routes is the production integration step.

---

## 6. External connectors — official APIs only

### 6.1 PayPal — hackathon's financial core

**Use the official PayPal REST APIs through `httpx` adapters** for Invoicing/Orders status, with the simulated adapter as the default demo path. For APIs covered by a maintained Python SDK, you may add it as an optional dependency; do not invent SDK methods. **Do not invent SDK methods such as `client.invoices.send()` if they are not implemented.**

Recommended MVP:

- Create a sandbox payment order from a known approved amount.
- Have the payer approve checkout through PayPal's supported flow.
- Capture using a server-side API call, with stable idempotency keys where supported.
- Verify webhooks and reconcile the order/payment status using the provider API.
- Show transaction ID, timestamps, verified status, and currency in Visun.
- Optionally generate/send an invoice through the supported Invoicing REST endpoint; keep invoice/send actions approval-gated.

**Boundaries:** PayPal Sandbox does not represent real money. Do not call a payment *paid* because the agent drafted an invoice. Never promise universal India domestic P2P or bill-pay capabilities, protected escrow, or unsupported account types; confirm regional eligibility and payer/seller account requirements.

### 6.2 Gmail — email actions

Use Google's Python SDK and OAuth authorization with appropriately minimized scopes. Workflow: `prepare_email` → store draft + recipient + attachments → show preview → user approves → `send_email` → store Gmail message ID or provider error. Gmail authentication and API access are different from just knowing a user's email address. The sender must explicitly connect a supported account.

### 6.3 Google Calendar — deadlines and meetings

Use Google Calendar API for actual connected events; use Visun project tasks for internal deadlines. Synchronize identifiers and time zones (store UTC instants; show user's selected zone). Don't create/modify an event without approval. The in-repo calendar view is display-only; it does not replace a calendar provider integration.

### 6.4 Telegram — real message ingestion

Use `python-telegram-bot` with a test group and explicit participant consent. Let the bot receive only allowed group messages and store channel/message IDs. Configure privacy permissions appropriately. The Telegram Bot API cannot read arbitrary existing private chat history. The MVP may also accept an uploaded chat export with consent. **Do not scrape WhatsApp personal chats.**

### 6.5 Leads — start with owned records

Use a simple `leads` database table and manual lead capture or authorized Telegram/email events. “Today's leads” means leads *actually recorded today* in the workspace time zone, with their source and ingestion timestamp. Do not imply access to LinkedIn or other private leads without an authorized integration.

---

## 7. Reports and documents

Use **Jinja2** for report layouts and **WeasyPrint** (optional extra) to render PDF from HTML/CSS. The shipped demo generates a source-backed preview and a plain-text download without a PDF dependency. If files ship, store the generated file in private storage and a corresponding metadata row. Use `pypdf` if merging/extracting existing PDFs; `python-docx` only if users explicitly need DOCX output. Do not write PDF layout engines manually.

Report inputs should come from verified tables (completed milestones, outstanding invoices, flagged scope requests, deadlines, recent activity); Gemini may draft explanatory summaries but must not fabricate numerical totals. A report is never emailed without recipient and attachment preview + approval.

---

## 8. Agent action safety and transparency

### Action lifecycle

```text
USER REQUEST
   ↓
READ TOOLS (authorized + grounded)
   ↓
PROPOSAL (exact payload + provenance + estimated consequences)
   ↓
PENDING APPROVAL (visible in voice, chat, and dashboard)
   ↓
APPROVED / REJECTED BY AUTHENTICATED USER
   ↓
EXECUTE VIA PROVIDER SDK / API (idempotent where supported)
   ↓
VERIFY PROVIDER RESPONSE + RECONCILE WEBHOOK
   ↓
SAVE EVENT + EXPOSE FINAL RESULT
```

- Read-only: fetch deadlines, show leads, get payment statuses, summarize client messages.
- Approval required: send email, modify calendar, send invoice, create PayPal order/payment request, change project scope, perform any charge/payment action.
- Do not trust voice recognition alone as financial authorization. Use an explicit authenticated approval UI for money movement and sensitive external writes.
- Require user-visible sources in each consequential answer: agreement clause, message permalink/reference, invoice ID/status, project task, or calendar event ID.
- Sanitize outside chat/email text and treat it as **untrusted data**, not as instructions to the agent.
- Use stable `action_id`, status transitions, idempotency, webhook signature verification, and retries without duplicate sends/charges.
- Expose timestamps and *real* provider status; a sent API call is not evidence an email was delivered or read.

---

## 9. Real-time chat and activity history

Use the **same conversation ID** for voice and text. The UI hydrates from the backend snapshot and updates after each chat/approval response, rendering:

1. Interim speech transcript (not yet final).
2. Final user utterance (persisted).
3. Agent reply (persisted and spoken when in voice mode).
4. Tool call details: tool name, parameters sanitized for display, source and completion/error.
5. Pending action approval card, decision, and provider-confirmed result.
6. Saved report/file links and the related message/action IDs.

Session/history can be implemented using ADK's persistent session service where compatible, plus dedicated Visun DB tables for UI audit and approvals. **Do not create two conflicting conversation records.** Design an explicit mapping `visun_conversation_id ↔ adk_session_id`, and use unique external event IDs to deduplicate stream reconnections.

---

## 10. Installation — minimal starting dependencies

### Frontend

The committed `frontend/package.json` is authoritative:

```bash
cd frontend
npm install
npm run dev
```

Runtime dependencies: `next`, `react`, `react-dom`, `tailwindcss`,
`@tailwindcss/postcss`, `motion`, `lucide-react`, `date-fns`, `recharts`.
Development: `typescript`, `eslint`, `eslint-config-next`, `@types/*`.

No Clerk, Supabase, TanStack, or FullCalendar dependency is installed because
the demo does not use them; add them only when production auth or file/realtime
features ship.

### Backend

```bash
cd backend
uv sync --extra dev              # core + pytest/ruff/alembic
uv sync --extra dev --extra postgres   # add PostgreSQL driver
.venv/bin/uvicorn app.main:app --reload
```

Optional extras are deliberately separate: `agent` (`google-genai`,
`google-adk`), `providers` (Google API, OAuth, Telegram), `reports`
(`weasyprint`). The default install has no provider SDK and makes no external
calls.

**Do not blindly pin versions copied from an old blog.** Resolve compatible current releases and commit `uv.lock` and the frontend lockfile.

---

## 11. Environment variables (names only; no secrets in Git)

Clerk credentials belong in the **backend/server environment**. `NEXT_PUBLIC_*` values are public configuration, not secrets. Keep every provider secret server-side. `backend/.env.example` and `frontend/.env.example` are canonical.

```dotenv
# Backend core
ENVIRONMENT=development
DATABASE_URL=sqlite:///./visun.db
AUTH_MODE=demo
PROVIDER_MODE=simulated
FRONTEND_ORIGIN=http://localhost:3000
EXTRA_ORIGINS=
LOG_LEVEL=INFO
ACTION_EXPIRY_MINUTES=30

# Clerk (production only)
CLERK_ISSUER=
CLERK_JWKS_URL=
CLERK_JWT_AUDIENCE=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Supabase (database URL only for the MVP)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Agent and voice
GOOGLE_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_LIVE_MODEL=
AGENT_BACKEND=deterministic
VOICE_BACKEND=browser

# Integrations
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/v1/integrations/google/callback
GOOGLE_REFRESH_TOKEN=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_CHAT_PROJECT_MAP={}
APP_ENCRYPTION_KEY=

# Frontend
BACKEND_ORIGIN=http://localhost:8000
```

The frontend holds no provider secrets. Configure deployment secrets in the hosting platform, and keep `.env` out of Git.

---

## 12. Minimal endpoint contract

The full implemented contract is in `backend.md`; this is the demo spine:

```text
GET    /api/v1/health
GET    /api/v1/bootstrap
GET    /api/v1/dashboard
GET    /api/v1/projects
GET    /api/v1/projects/{id}
PATCH  /api/v1/scope-findings/{id}
GET    /api/v1/deadlines
GET    /api/v1/leads
POST   /api/v1/leads
PATCH  /api/v1/leads/{id}
GET    /api/v1/payments/outstanding
POST   /api/v1/payments/recheck
POST   /api/v1/reports/preview
POST   /api/v1/reports/{id}/send
POST   /api/v1/agent/chat
WS     /api/v1/agent/voice
GET    /api/v1/conversations
GET    /api/v1/conversations/{id}/messages
POST   /api/v1/actions/prepare
POST   /api/v1/actions/{id}/approve
POST   /api/v1/actions/{id}/reject
GET    /api/v1/tool-executions
GET    /api/v1/integrations
POST   /api/v1/integrations/{provider}/toggle
POST   /api/v1/integrations/telegram/webhook
POST   /api/v1/integrations/paypal/webhook
GET    /api/v1/integrations/google/callback
GET    /api/v1/activities
POST   /api/v1/activities
```

The frontend talks to same-origin `/api/backend/*`; Next rewrites that prefix to
FastAPI. FastAPI emits OpenAPI at `/api/v1/openapi.json`. The hand-written
client in `frontend/lib/api.ts` mirrors the shapes used by the UI; generate it
from OpenAPI if the surface grows.

---

## 13. Tests to write before adding more dependencies

| Test | Expected |
|---|---|
| Ask for deadlines in text or voice | Same data and source references |
| Restart voice session | Final transcripts and approvals remain visible |
| Client sends out-of-scope Telegram message | Scope finding cites exact message and agreement clause |
| Client sends in-scope message | No ungrounded paid change request |
| Ask to email overdue payment | Draft created; **not sent** until approved |
| User declines draft | No external send |
| Email provider fails | UI reports failed/unknown, not sent |
| PayPal sandbox checkout completes | Provider-confirmed payment, transaction ID stored |
| Duplicate payment webhook | No duplicate payment record or capture |
| Cross-user URL or tool call | Access denied by workspace authorization |
| Chat contains malicious tool instructions | Agent treats message as evidence only; no unauthorized action |
| Today's leads | Records reflect timezone-aware date and actual source |
| Simulated send | Action completes with `simulated=True` and is never labelled real |
| Missing real credentials | Explicit failed state, no fabricated success |
| Stale/expired approval | 409; no execution |

Use fixtures and simulated providers; run backend integration tests with pytest. The committed suite covers the credential-free guarantees; add Playwright later for browser E2E.

---

## 14. Scope and build order — implemented

### Shipped

1. **Workspace** — clients, projects, agreements, milestones, dashboard reads, scope findings, and full demo seed.
2. **Grounded chat** — persistent text conversation, deterministic tools, source/tool records, and honest offline fallback.
3. **Approvals** — prepare/approve/reject, canonical hash, expiry, single-shot execution, state transitions, and activity audit.
4. **Providers** — simulated PayPal, Gmail, Calendar, and Telegram adapters with real-mode scaffolding; real mode fails loudly without credentials.
5. **Reports and leads** — source-backed preview, delivery approval, lead create/update, calendar view, payments recheck.
6. **Voice** — browser speech plus backend transcript WebSocket sharing the text history; Gemini Live bridge when configured.
7. **Production path** — Clerk JWT verification, PostgreSQL/Supabase via `DATABASE_URL`, Alembic baseline, SQLite/PostgreSQL test runs.

### Next (needs credentials or product decisions)

- Enable `@clerk/nextjs` routes and load the Clerk token into the API client.
- Real Gmail/Calendar OAuth consent flow and token encryption at rest.
- Real PayPal Sandbox invoice/order creation with webhook reconciliation beyond status updates.
- Telegram bot onboarding UI and allowlisted channel mapping.
- Gemini Live audio transport plus interruption handling.
- PDF report export and file storage.

### Explicitly out of scope for MVP

- Building a custom generic agent framework.
- Fully autonomous uncontrolled spending or financial transfers.
- Universal cross-platform private-message ingestion.
- Fake payments and unverified lead discovery.
- A homegrown CRM, email platform, calendar engine or speech model.
- A sprawling microservices and multi-agent architecture.

---

## 15. Short-code engineering standards (mandatory for coding agents)

1. **Search for an official maintained SDK/library before implementing a feature.** Prefer its documented abstractions and examples.
2. **Use one library for one job:** SQLModel for DB mapping, the in-repo UI kit for common UI, official Google clients for Gmail/Calendar, and FastAPI for transport. Optional SDKs stay optional extras.
3. **Don't over-engineer:** one Python backend, one agent interface, one DB. Add a new service or subagent only for a measured reason.
4. **Don't duplicate data models:** keep `models.py` and `schemas.py` as the source of truth; mirror them in `frontend/lib/types.ts` only for the shapes the UI consumes.
5. **Don't write raw OAuth/JWT/crypto/payment verification:** use Clerk-compatible JWT verification, Google OAuth libraries, and verified webhook helpers with strict backend policies.
6. **Don't parse LLM responses with regex:** prefer structured output and Pydantic validation; retry/report schema errors safely.
7. **Don't code a second transport:** use SDK WebSockets and well-maintained browser examples; implement only the smallest audio bridge needed.
8. **Don't invent library APIs.** If a package cannot perform an action, use a documented REST API behind a small adapter, or reduce the scope.
9. **Avoid needless abstraction:** don't write generic base classes, registries, custom event buses, or factories for one implementation.
10. **Use provider state as truth:** money, sent emails, and calendar writes require provider IDs/status and reconciliation.
11. **Keep security checks explicit even if it costs lines.** Authorization, approval, webhook verification, workspace isolation, and audit evidence cannot be sacrificed for code brevity.
12. **Ship a vertical slice first:** a single voice command → grounded tool → approval → real sandbox execution → saved activity history. Refactor only after it works end-to-end.

**Definition of done:** Someone can speak to Visun, see the same exchange in chat history, see exactly which source it consulted, approve a real supported operation, and verify the result from the actual provider.

---

## 16. Official references / verification links

These are implementation references, not promises of region/account eligibility or permanent SDK compatibility:

- Google Gemini model IDs: https://ai.google.dev/gemini-api/docs/models
- Gemini Live SDK guide: https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
- Gemini Live capabilities: https://ai.google.dev/gemini-api/docs/live-api/capabilities
- Google Agent Development Kit: https://google.github.io/adk-docs/
- Google ADK Python repository: https://github.com/google/adk-python
- SQLModel: https://sqlmodel.tiangolo.com/
- PayPal server SDK, Python: https://developer.paypal.com/serversdk/python/
- PayPal Orders: https://developer.paypal.com/whats-an-order/
- PayPal Invoicing: https://developer.paypal.com/docs/api/invoicing/v2/
- PayPal JavaScript SDK: https://developer.paypal.com/sdk/js/
- Gmail Python quickstart: https://developers.google.com/workspace/gmail/api/quickstart/python
- Google Calendar API: https://developers.google.com/workspace/calendar/api/guides/overview
- Telegram Bot API: https://core.telegram.org/bots/api
- Supabase docs: https://supabase.com/docs
- shadcn/ui docs: https://ui.shadcn.com/
- FastAPI docs: https://fastapi.tiangolo.com/

**Implementation note:** SDKs and Google AI models can evolve quickly. Validate exact model support, API capabilities, and provider permissions in the deployed environment before relying on them.

---

## 17. Clerk + Supabase reference documentation

- Clerk Next.js: https://clerk.com/docs/nextjs/getting-started/quickstart
- Clerk ↔ Supabase: https://clerk.com/docs/guides/development/integrations/databases/supabase
- Supabase third-party Clerk auth: https://supabase.com/docs/guides/auth/third-party/clerk
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security

**Migration rule:** If Visun already has Supabase Auth users, do not simply swap libraries and abandon accounts. Inventory identities, sessions, ownership columns, RLS policies, and user-linked records first; make an explicit migration plan and test it.
