# Visun — Backend Implementation Specification

**Product:** Visun — *Talk. Manage. Execute.*  
**Document:** `backend.md`  
**Version:** 1.2 · 4 November 2026  
**Related:** [`PRD.md`](./PRD.md), [`frontend.md`](./frontend.md), [`techstack.md`](./techstack.md), [`SETUP.md`](./SETUP.md)  
**Status:** Implemented modular monolith; SQLite demo path verified, PostgreSQL/Supabase path verified with Alembic

> **Implementation status:** The backend described here is built and tested in `backend/`. It runs credential-free with `AUTH_MODE=demo`, `PROVIDER_MODE=simulated`, and SQLite. Production switches to Clerk JWT verification and PostgreSQL via environment variables. The frontend ships conditional Clerk sign-in, `/app` route protection, and a bearer-token bridge; `ALLOW_PUBLIC_DEMO` keeps the seeded demo reachable in Clerk mode. The deterministic grounded agent is the default; Gemini phrasing and Gemini Live voice are optional adapters over the same tool interface.

> **Priority:** Build reliable, inspectable functionality with established libraries and official SDKs. Avoid writing custom auth, speech recognition, agent orchestration, OAuth transport, payment SDKs, or queue systems. Small, explicit business rules and security enforcement are required even if they add code.

## 1. Purpose and system boundaries

Visun is a voice-first freelance operations workspace. The backend provides one trustworthy data source for voice and text queries about projects, deadlines, leads, payments, scope changes, reports, and outgoing client communication. The AI agent may inspect authorized data and propose actions; external writes and financial actions are executed only through authenticated, explicit approvals. Store the spoken transcript and typed messages in the same conversation history along with tool executions and outcomes.

**Frontend contract:** `frontend.md` defines the **editorial + warm neumorphic UI** with the approved orange `#FF5A00`, charcoal `#1D1D1D`, yellow `#FFE17B`, stone `#E9E6DF`, and white `#F8F8F6` palette. Backend responses must expose deterministic action states (`pending_approval`, `executing`, `completed`, `failed`, etc.) so the UI can render accessible confirmation cards and event timelines. The backend does not own CSS or render the design.

## 2. Stack — authoritative selections

| Concern | Use | Avoid reinventing |
|---|---|---|
| HTTP/API | FastAPI, Pydantic v2, `pydantic-settings` | Custom API/router/validation frameworks |
| Identity | `AUTH_MODE=demo` locally; **Clerk** bearer JWT with cached JWKS in production | Password databases or a second Supabase Auth login |
| Data | SQLite default for zero-credential development; **Supabase PostgreSQL** via `DATABASE_URL`; SQLModel + Alembic + `psycopg` | Custom ORM, handwritten migration framework |
| Storage/realtime | Not required for the MVP demo; add Supabase Storage/Realtime only when file uploads or live collaboration ship | Homemade file server/event bus |
| Agents | **Deterministic grounded agent** primary; optional Gemini via `google-genai` and Google ADK behind the same interface | A custom tool router that bypasses approval |
| Live speech | Browser Web Speech + backend transcript fallback; optional Gemini Live API bridge | Homemade STT, TTS, codecs, speech buffers |
| PayPal | `httpx` adapters for documented Invoicing/Orders REST endpoints; simulated mode for the demo | Invented SDK functions or payment status derived from AI text |
| Mail and calendar | Google API Python client + Google OAuth libraries behind real-mode adapters | SMTP/auth token logic from scratch |
| Telegram | `python-telegram-bot` webhook integration | Scraping personal chats |
| Reports | Jinja2 preview; WeasyPrint optional for PDF | Custom PDF layout engine |
| Observability | `structlog` structured logs plus persisted audit rows | Homegrown telemetry platform |
| Tests | `pytest`, `httpx`/FastAPI TestClient; PostgreSQL compatibility run | Manual-only verification |

Use version-compatible official documentation, supported model IDs, and SDK APIs at implementation time; model availability and provider capabilities must be checked rather than assumed. **One main agent with separate tool groups** is the MVP default. Do not deploy a microservice per domain.

## 3. Runtime architecture

```text
Next.js (workspace UI; browser voice + text; approval cards)
  |  same-origin /api/backend/* rewrite -> http://localhost:8000/api/v1/*
  |  demo principal locally; Clerk bearer JWT in production
  v
FastAPI (one modular monolith)
  |-- auth: demo principal or verified Clerk tokens + workspace/member authorization
  |-- data services: projects, deadlines, leads, invoices, payments, reports
  |-- agent: deterministic grounded tools; optional Gemini phrasing; optional ADK
  |-- voice: browser_fallback transcript WebSocket; optional Gemini Live bridge
  |-- actions: prepare -> approval -> policy checks -> execute -> verify -> audit
  |-- integrations: PayPal, Gmail, Calendar, Telegram (simulated or real adapters)
  |-- webhooks: signature-verified ingestion and idempotency
  v
SQLite by default; PostgreSQL/Supabase via DATABASE_URL (SQLModel + Alembic)
```

FastAPI is the authoritative data and action API. The browser never holds provider credentials. Use one `conversation_id` for the user-visible history, and map any optional Gemini/ADK session ID to it. The Next.js rewrite does not proxy WebSocket upgrades, so the browser speech path is the default; a production deployment that uses Gemini Live must connect the WebSocket directly to FastAPI.

## 4. Authentication, authorization, and user isolation

1. **Authentication is mode-based.** `AUTH_MODE=demo` trusts the seeded local principal so the hackathon demo runs without credentials. `AUTH_MODE=clerk` verifies the signature, `iss`, expiry, and configured `aud` of Clerk session JWTs against cached JWKS and provisions the application user idempotently. Production startup refuses `AUTH_MODE=demo` and refuses an `http://` frontend origin.
2. **The public demo is explicit.** With `ALLOW_PUBLIC_DEMO=true` a Clerk-mode API also accepts `X-Visun-Demo: 1` and resolves it to the seeded demo workspace. It never grants access to a real user's workspace. The frontend sends this header only from `/app?demo=1`; default is `false`.
3. Store Clerk subject identifiers as `TEXT` (`clerk_user_id`), not UUID. Demo mode uses a stable seeded subject (`user_demo_ayush`) so the same rows work in both modes.
4. Every read/write query must be scoped to a workspace and authenticated membership. Support `owner`, `member`, `viewer` where relevant; only authorized actors may approve/send financial or external actions.
5. If Supabase browser access is added later, configure Clerk third-party auth and RLS for every exposed table; use JWT `sub` (`auth.jwt()->>'sub'`) rather than assuming a UUID. The current MVP keeps all database access server-side.
6. Backend direct database access bypasses RLS by design: enforce workspace authorization in FastAPI regardless. Service-role keys, database URLs, Clerk secrets, OAuth refresh tokens and PayPal secrets belong server-side only.
7. Gmail and Google Calendar permissions require **separate provider authorization**, not just a Clerk login. Encrypt refresh tokens at rest, request minimum scopes, allow disconnect/revocation, and show connected-account status.
8. If private file storage ships, create private buckets for contracts, chat attachments, and reports; deliver short-lived signed download URLs only after checking workspace authorization.

## 5. Database specification

Use SQLModel for table models and Alembic for migrations. The implemented schema matches the table list below, with one baseline revision (`0001_initial`, 24 tables) that runs on SQLite and PostgreSQL. Prefer Postgres `timestamptz` UTC instants and explicit user locale/time zone on display; SQLite stores the same timezone-aware values.

| Table | Key fields / purpose |
|---|---|
| `users` | `id`, `clerk_user_id UNIQUE TEXT`, display name, time zone |
| `workspaces` | `id`, name, owner user ID |
| `workspace_members` | workspace, Clerk user ID, role, status; uniqueness constraint |
| `clients` | workspace, name, approved contact email, external references |
| `projects` | workspace, client, name, status, agreed amount, currency, due date |
| `agreements` | project, version, file path, parsed terms, approval timestamps |
| `milestones` | project, title, acceptance criteria, due date, agreed value, status |
| `tasks` | milestone/project, assignee, due date, status |
| `leads` | workspace, source, client contact, stage, received timestamp |
| `invoices` | client/project, amount, currency, due, provider invoice ID, status |
| `payments` | invoice/order refs, provider IDs, amount, currency, verified status, event timestamp |
| `external_messages` | workspace/project, provider, source message ID, sender, time, text, consent/source scope |
| `scope_findings` | project, agreement version, message references, classification, evidence, confidence, review status |
| `conversations` | workspace, user, title, ADK session ID, timestamps |
| `conversation_messages` | conversation, role, modality (`voice`/`text`), final transcript, sequence, creation time |
| `tool_executions` | conversation, tool, inputs summary/redaction, actor, status, source refs, timestamps |
| `action_approvals` | user/workspace, action type, canonical payload, preview hash, approver, status, expiration, timestamps |
| `reports` | project/workspace, reporting period, snapshot data, private file path, delivery status |
| `integration_connections` | workspace/user/provider, granted scopes, token reference, enabled status |
| `webhook_events` | provider, external event ID UNIQUE, verification state, processed time, result |

Use indexes on tenant/workspace IDs, due dates, received times, source message IDs, and provider event IDs. Foreign keys, unique constraints, and transactions must enforce integrity. **Do not store raw recordings by default.** Final transcripts can be saved with user-controlled retention/deletion; redact secrets and minimize message content. Build safe export/deletion operations for user-owned data.

## 6. Agent and tool architecture

Use **one deterministic grounded agent** backed by typed Python service functions grouped by domain. Gemini can rephrase the grounded result through the same interface; it never gets alternate tools or approval authority. Google ADK is an optional adapter, not a requirement for the demo.

| Tool group | Read tool examples | Action tools (require approval) |
|---|---|---|
| Project | `get_project_status`, `get_deadlines`, `get_overdue_tasks` | `update_milestone`, `create_task` |
| Finance | `get_outstanding_payments`, `get_verified_payment_status` | `prepare_invoice`, `send_invoice`, `prepare_checkout` |
| Client communications | `get_client_messages`, `summarize_scope_changes` | `draft_email`, `send_email` |
| Reports | `get_report_inputs`, `preview_report` | `send_report` |
| Calendar | `get_events`, `find_free_slots` | `create_event`, `update_event` |
| Leads | `get_todays_leads`, `get_lead_status` | `update_lead` |

**Tool design rules:**
- All tools get the **server-derived principal and workspace**, not untrusted user-supplied identity. Domain services should recheck authorization.
- Read tools return typed data plus source identifiers and timestamps. Financial totals come from deterministic DB/PayPal calculations; the LLM only explains them.
- A model response is not the authority to send money, email, or alter external records. Agents can prepare an action, but only the approval service executes.
- Scope detection uses a versioned project agreement and actual linked client messages; return exact supporting quotations/IDs, risk labels, and uncertainty. No legal/escrow guarantees.
- The agent should explicitly say when a provider is not connected or a status is unknown rather than guessing.

### Example response shape (conceptual)

```json
{
  "answer": "Two invoices are outstanding.",
  "facts": {"outstanding_total": "450.00", "currency": "USD"},
  "sources": [{"kind": "invoice", "id": "inv_123", "checked_at": "2026-11-03T09:00:00Z"}],
  "proposed_actions": []
}
```

Money uses `Decimal` or integer minor units; never calculate charges in binary floating point. Multi-currency totals must not be added together without labeled currency conversion rates and timestamps.

## 7. Live voice, synchronized chat, and history

- Browser microphone uses the Web Speech API and sends finalized text to the same `/agent/chat` pipeline. The backend also exposes a transcript WebSocket (`/agent/voice`) with an honest `browser_fallback` mode; optional Gemini Live bridging is available when configured.
- Voice and text invoke the same tools and permission checks.
- Show incremental transcript updates to the frontend, then persist only finalized transcript chunks once (dedupe by stream/session event identifiers).
- Persist assistant replies, read-tool summaries, pending approvals, user decisions, provider-confirmed execution outcomes in sequence with timestamps.
- On reconnect, reconstruct conversation history from Postgres, not solely model session memory; map `conversation_id` to ADK session ID where supported.
- Voice commands may request a proposal but never count as sufficient authorization for consequential writes; the user must approve through an authenticated confirmation action.
- Handle microphone denial, streaming drop, reconnection, interrupted turn and cancellation; show clear errors and preserve prior finalized messages.

**Visible event types:** `user_message`, `assistant_message`, `tool_started`, `tool_finished`, `action_prepared`, `approval_granted`, `approval_rejected`, `action_executing`, `action_completed`, `action_failed`. Distinguish the agent **drafting** an email from the provider **accepting** its send request.

## 8. Approval and execution state machine

```text
PROPOSED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> COMPLETED
                              \-> REJECTED         \-> FAILED
                              \-> EXPIRED
```

1. Agent prepares a validated, immutable action payload with recipient, amount/currency where relevant, content preview, supporting sources, expiry, and stable `action_id`.
2. Frontend shows exact recipient, subject, attachment/report, amount and method; user can edit, reject, or approve. Material edits generate a new approval payload, not a silent mutation of an approved one.
3. Approve via authenticated API; verify owner/workspace role, action hash, expiry, integration scopes, and idempotency before execution.
4. Execute through official provider SDK/API, store provider IDs and status. Confirm final outcome via provider response and webhooks as appropriate. Log errors and mark them explicitly; don't claim success before confirmation.
5. Retry only when safe: use idempotency keys/provider request IDs and never duplicate sends or charges.

**High-risk boundaries:** No agent-initiated charging, payouts, unauthorized invoices, unapproved external emails, or irreversible scheduling changes. PayPal buyer approval remains a separate required step in applicable checkout flows.

## 9. Integration modules

### 9.1 PayPal

- Use PayPal Sandbox developer credentials and `paypal-server-sdk` for supported Orders flows; for Invoicing use documented REST endpoints via `httpx` if SDK support is missing.
- Create order → buyer approves via supported checkout UI → capture/authorize where appropriate → verify backend response/webhook → reconcile DB state.
- For status queries, use provider IDs and recent verifiable API status, not guesses from a chat summary.
- Verify webhook signatures and dedupe webhook event IDs. PayPal API coverage, merchant eligibility, and regional capabilities must be checked in the sandbox environment.
- Do **not** call this an escrow product; authorization/capture is not indefinite holding of funds.

### 9.2 Gmail

- User connects authorized Google account with least privilege. Store tokens encrypted and refresh through official libraries.
- Draft reminder/report via templates + project-specific context. Show exact To/subject/body/attachments. Only after user approval invoke Gmail send.
- Record Gmail message ID and transport outcome. Do not assert email was read or received without evidence.

### 9.3 Google Calendar

- Read connected calendar events plus Visun internal tasks/deadlines. Schedule or edit only after approval.
- Save UTC timestamps and IANA timezone; check conflicts and avoid creating duplicate events.

### 9.4 Telegram

- Receive messages only from explicitly authorized project chats/groups through an approved Telegram bot; validate webhook secret and source allowlist.
- Respect Telegram group privacy/messaging permission settings. Existing private chat histories are not available to an ordinary bot.
- Deduplicate by chat/message identifier, minimize storage, link to project, and run agreement-based scope comparison.
- For WhatsApp-like demos, use consented pasted/exported transcripts instead of unofficial personal-chat scraping. Discord can be a later authorized bot integration.

### 9.5 Leads and reports

- MVP lead records originate from user entry, authorized webhook, or an explicitly connected CRM. Do not pretend to discover leads from unrelated accounts.
- `today` means the user's configured timezone; query a precise day window and show the source and freshness.
- Report calculation comes from trusted project/milestone/payment data; Gemini may summarize but may not invent figures.
- Generate PDF via Jinja2 + WeasyPrint, store in private bucket, preview, then require approval before email.

## 10. API contract (v1)

All private endpoints accept the demo principal locally and a valid Clerk session bearer token when `AUTH_MODE=clerk`. A Clerk-mode API additionally accepts `X-Visun-Demo: 1` when `ALLOW_PUBLIC_DEMO=true`; the header resolves only to the seeded demo workspace. Resource-level authorization is enforced in every query. Use Pydantic response models and consistent error envelopes. FastAPI OpenAPI is the authoritative type contract at `/api/v1/openapi.json`.

```text
GET    /api/v1/health
GET    /api/v1/bootstrap
POST   /api/v1/reset-demo
GET    /api/v1/dashboard
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/scope-findings/{finding_id}
POST   /api/v1/projects/{project_id}/agreements/{agreement_id}/propose-change
GET    /api/v1/deadlines
GET    /api/v1/leads
POST   /api/v1/leads
PATCH  /api/v1/leads/{lead_id}
GET    /api/v1/payments/outstanding
POST   /api/v1/payments/recheck
GET    /api/v1/reports
POST   /api/v1/reports/preview
POST   /api/v1/reports
POST   /api/v1/reports/{report_id}/send
POST   /api/v1/agent/chat
WS     /api/v1/agent/voice
GET    /api/v1/conversations
POST   /api/v1/conversations
PATCH  /api/v1/conversations/{conversation_id}
DELETE /api/v1/conversations/{conversation_id}
GET    /api/v1/conversations/{conversation_id}/messages
POST   /api/v1/conversations/{conversation_id}/messages
POST   /api/v1/actions/prepare
GET    /api/v1/actions
GET    /api/v1/actions/{action_id}
POST   /api/v1/actions/{action_id}/approve
POST   /api/v1/actions/{action_id}/reject
GET    /api/v1/tool-executions
GET    /api/v1/integrations
POST   /api/v1/integrations/{provider}/toggle
GET    /api/v1/integrations/google/start
GET    /api/v1/integrations/google/callback
POST   /api/v1/integrations/telegram/webhook
POST   /api/v1/integrations/paypal/webhook
GET    /api/v1/preferences
PATCH  /api/v1/preferences
GET    /api/v1/activities
POST   /api/v1/activities
```

For WebSockets, verify identity at connection establishment and authorize every requested conversation; use a secure short-lived connection mechanism compatible with the browser and deployment rather than embedding durable auth secrets in URL query parameters. Webhook endpoints are public only for provider callback traffic and must verify authenticity before processing.

**Consistent errors:** HTTP 400 validation/business error; 401 not authenticated; 403 denied; 404 not found or inaccessible; 409 stale approval/duplicate conflict; 429 rate limit; 5xx provider/server faults. Do not leak provider tokens or private messages in error payloads.

## 11. Recommended project layout

```text
backend/
  app/
    main.py
    core/
      config.py         # env aliases, production guards
      security.py       # demo principal, Clerk JWKS verification, rate limits
      database.py       # engine, session, schema bootstrap, demo reset
      errors.py
      logging.py
    api/
      system.py         # health, bootstrap, reset
      workspace.py      # dashboard, projects, leads, payments, reports, settings
      assistant.py      # chat, conversations, actions, approvals, voice
      webhooks.py       # PayPal, Telegram, Google OAuth
    models.py           # every SQLModel table
    schemas.py          # Pydantic request models
    serializers.py      # API presentation shapes
    seed.py             # deterministic demo workspace
    services/
      actions.py        # prepare/approve/reject state machine + audit
      agent.py          # deterministic grounded agent, optional Gemini
      agent_tools.py    # read tools over persisted data
      assistant.py      # conversation orchestration
      providers.py      # simulated/real PayPal, Gmail, Calendar, Telegram
      voice.py          # transcript fallback + optional Gemini Live bridge
      hashing.py        # canonical payload + idempotency
      crypto.py         # token encryption helpers
    timeutil.py
  migrations/
    versions/0001_initial.py
  tests/
    test_api.py         # 17 end-to-end API tests
  pyproject.toml
  .env.example
```

Keep route modules thin and business logic in services; adapters wrap vendor APIs so provider logic is easy to mock in tests. **Do not generate dozens of empty files or needless abstract interfaces.**

## 12. Config and secrets

Server configuration via `pydantic-settings` and deployment secret manager. Primary names are public; legacy `VISUN_*` aliases are accepted. Expected categories:

- `ENVIRONMENT`, `DATABASE_URL` (SQLite default or PostgreSQL/Supabase), `AUTH_MODE`, `ALLOW_PUBLIC_DEMO`, `PROVIDER_MODE`, `FRONTEND_ORIGIN`, `EXTRA_ORIGINS`, `LOG_LEVEL`, `ACTION_EXPIRY_MINUTES`.
- Clerk issuer / JWKS endpoint / configured JWT audience / secret keys.
- Google Gemini API key plus selected **currently supported** text/live model identifiers, `AGENT_BACKEND`, `VOICE_BACKEND`.
- PayPal sandbox client ID, client secret, webhook ID, environment.
- Google OAuth client ID/secret/redirect URLs, encrypted token storage key.
- Telegram bot token, webhook secret, allowed chat IDs, chat-to-project map.
- Optional Supabase URL/service key only if browser realtime/storage is added.

`backend/.env.example` is canonical. Never log full bearer tokens, uploaded contracts, private raw messages, or payment credentials. Keep `.env` out of Git.

## 13. Security and resilience requirements

- Validate all external webhook signatures/secret tokens and deduplicate events; reject unknown chat/workspace mappings.
- Strict RBAC and cross-tenant query tests, including Realtime/Storage permissions.
- Enforce input size/file type limits; scan or safely process uploaded documents; never execute document macros or arbitrary client code.
- Treat emails, chats, OCR and uploaded agreements as untrusted content **not instructions**. Agent must ignore prompt injection inside retrieved messages; tools enforce permissions independently.
- Add rate limiting to API, agent calls, and ingestion; bound prompt/context size and model cost; process long jobs asynchronously when needed.
- Use transactions for state transitions and idempotent external-action execution; prevent repeated approval and webhook duplicate effects.
- Keep auditable event logs with timestamps and redacted arguments; show users who approved, which source was used, and actual external-action status.
- Offer retention, export, and deletion controls for conversation text and attachments. Obtain conversation-participant consent before importing messages; avoid bulk collection.

## 14. Testing and definition of done

| Test | Expected result |
|---|---|
| Invalid or expired Clerk JWT | 401; no data access |
| Workspace A tries to read Workspace B | 403/404; no leakage |
| Read `get_deadlines` by voice and text | Same source-derived results |
| Unpaid invoice query | Correct currency/amount; verified source |
| Agent says “email client” | Only `PENDING_APPROVAL`; no send yet |
| User rejects prepared email | Nothing sent; rejection logged |
| User approves once and repeats request | Exactly one intended send/action |
| Duplicate PayPal webhook | No duplicate payment event/charge |
| Telegram request exceeds agreement | Finding references actual agreement clause/message |
| Voice session disconnect | Final transcript remains in history |
| Report generated then sent | Preview, explicit approval, provider response recorded |
| Provider not connected | Clear actionable failure, no fabricated success |
| Simulated provider | `simulated=True`, `sim-*` reference, never called “sent” |
| Stale or expired approval hash | 409; no execution |

The implemented suite in `backend/tests/test_api.py` covers the credential-free path: health/bootstrap, dashboard totals, scope review persistence, grounded answers, reminder preparation, approval/idempotency/audit, stale hash, real-mode credential failure, disconnected provider, expiry, report preview, lead create/update, 503 webhooks, voice transcript history, and persisted tool executions. It passes on SQLite and PostgreSQL 16; Alembic upgrade/downgrade is verified on both.

Backend MVP is complete when the end-to-end scenario works: load a project/agreement → receive an authorized Telegram-style request → detect a scope change → ask by voice and text about deadlines and unpaid invoices → prepare a report/payment reminder → inspect and approve → execute through the configured provider → verify PayPal Sandbox statuses → reopen the conversation and inspect the transcript plus tool/action history. In simulated mode the last steps are explicitly labelled as simulated; production requires real provider credentials.

## 15. Build order for fastest useful delivery

1. ~~Workspace authorization, clients/projects/milestones, dashboard reads.~~ **Done.**
2. ~~Typed read tools and text chat; persistent conversations and events.~~ **Done.**
3. ~~PayPal Sandbox invoice/payment models and status verification; webhook reconciliation.~~ **Simulated path done; real mode needs credentials.**
4. ~~Telegram authorized-ingestion pipeline and agreement-aware scope review.~~ **Webhook and mapping done; real bot needs credentials.**
5. ~~Gmail preview/approve/send workflow; report preview.~~ **Simulated path done; real OAuth needs credentials.**
6. ~~Voice transcript fallback with shared history.~~ **Done. Gemini Live bridge is optional and credential-gated.**
7. ~~Calendar and leads; reliability hardening.~~ **Done; PostgreSQL/Alembic verified.**

**Cut scope, not trust guarantees.** When time is short, demonstrate fewer integrations end-to-end rather than many nonfunctional widgets. Align every backend action status with the neumorphic UI states specified in `frontend.md`.
