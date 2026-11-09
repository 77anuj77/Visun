# Visun

Visun is a voice-first operations workspace for freelancers. Ask a question by
voice or text, see the grounded sources the answer came from, and approve any
outbound action before it leaves the workspace.

This repository contains both halves of the product:

| Path | What it is |
| --- | --- |
| `frontend/` | Next.js 16 + React 19 app (marketing site and authenticated workspace) |
| `backend/` | FastAPI + SQLModel modular monolith with agent, approvals, providers, and audit |
| `PRD.md` | Product requirements and demo script |
| `frontend.md` | Frontend architecture and interaction specification |
| `backend.md` | Backend architecture, data model, and API contract |
| `techstack.md` | Stack decisions, environment configuration, and verification |
| `SETUP.md` | Step-by-step Clerk, Supabase, and PayPal setup |

## Run it locally

The demo runs with **no credentials**. Auth is demo mode, providers are
simulated, and the agent is deterministic and grounded in the seeded SQLite
workspace.

```bash
# 1. API — http://localhost:8000
cd backend
uv sync --extra dev
cp .env.example .env        # optional; defaults already work
.venv/bin/uvicorn app.main:app --reload

# 2. Web — http://localhost:3000
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. Both entry points work without credentials:

- **Try Visun** — in demo mode this opens `/app`. With a Clerk publishable key it
  opens the Clerk sign-in/sign-up modal and protects `/app`.
- **Try demo** — opens the seeded demo workspace at `/app?demo=1`, even on a
  Clerk-protected deployment when the API sets `ALLOW_PUBLIC_DEMO=true`.

The frontend hydrates from `/api/backend/bootstrap` (rewritten to FastAPI by
`next.config.ts`) and falls back to a local snapshot if the API is down. The
topbar shows whether the API is online, and labels simulated data as simulated.

API docs: <http://localhost:8000/docs>. For real keys, follow `SETUP.md`.

## What works end to end

1. **Ask** — text or browser voice on `/app/copilot`.
2. **Ground** — the backend runs read-only tools against stored invoices,
   milestones, agreements, messages, and leads.
3. **Prepare** — a payment reminder, report delivery, calendar event, or
   agreement change becomes a pending action with a canonical payload hash.
4. **Approve** — the exact payload is confirmed, executed once, and audited.
   Edited drafts invalidate the old approval hash.
5. **Record** — provider reference, simulated flag, state transitions, and
   activity are persisted. A simulated send is never reported as a real send.

PayPal runs in sandbox and simulated modes. Never report a payment as settled
without a provider reference.

## Honest modes

Configuration is environment-based; see `backend/.env.example` and
`frontend/.env.example`.

- `AUTH_MODE=demo` trusts the seeded local principal. Production refuses demo
  auth and requires Clerk JWT configuration.
- Setting `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` enables Clerk sign-in/sign-up and
  protects `/app`; without it the app stays in credential-free demo mode.
- `ALLOW_PUBLIC_DEMO=true` lets a Clerk-mode API accept the seeded demo via
  `X-Visun-Demo: 1` (sent by `/app?demo=1`). It never grants a real user's data.
- `PROVIDER_MODE=simulated` records `simulated=True` and a `sim-*` reference.
  `PROVIDER_MODE=real` calls the provider or fails loudly when credentials are
  missing.
- `AGENT_BACKEND=deterministic` (default) or `gemini` for phrasing over the same
  grounded tool results.
- `VOICE_BACKEND=browser` uses Web Speech plus a backend transcript endpoint;
  `gemini_live` proxies the Gemini Live API when configured.
- `DATABASE_URL` defaults to SQLite and accepts a PostgreSQL/Supabase URL.
  Alembic owns schema changes.

## Verify

```bash
# Backend (SQLite)
cd backend
.venv/bin/pytest
.venv/bin/ruff check .

# Migrations
DATABASE_URL=sqlite:///./verify.db .venv/bin/alembic upgrade head
DATABASE_URL=sqlite:///./verify.db .venv/bin/alembic downgrade base

# Frontend
cd frontend
npm run typecheck
npm run lint
npm run build
```

`backend/tests/test_api.py` covers health/bootstrap, grounded answers, action
preparation, approval idempotency, stale hashes, expiry, honest credential
failure, disconnected providers, reports, leads, webhooks, voice history, and
tool audit persistence. The same suite passes against PostgreSQL 16 by setting
`DATABASE_URL`.

## Layout

```text
backend/
  app/
    api/            # system, workspace, assistant, webhooks routers
    core/           # config, database, security, errors, logging
    services/       # actions, agent, agent_tools, assistant, providers, voice
    models.py       # SQLModel tables (money in cents, UTC instants)
    seed.py         # demo workspace used by the frontend
  migrations/       # Alembic baseline
  tests/            # SQLite by default, Postgres-compatible
frontend/
  app/              # marketing, /sign-in, /sign-up, and /app workspace routes
  components/       # shell, UI kit, brand, auth buttons/provider bridge
  lib/              # API client, auth config, store, types, demo data, agent fallback
  proxy.ts          # Clerk /app protection and demo-cookie handling
```

## Known boundaries

- Clerk, Supabase, PayPal, Gemini Live, and real Gmail/Calendar/Telegram calls
  need real credentials; `SETUP.md` documents each one. The credential-free
  demo exercises the same code paths with explicit simulated results.
- A new Clerk user starts with an empty workspace; the seeded data is the
  separate demo path.
- Report PDF rendering is optional (`weasyprint` extra); the UI exports a
  plain-text copy.
- The Next.js rewrite does not proxy WebSocket upgrades; the voice UI uses the
  browser speech stack and a transcript fallback, not a tunnelled Live socket.

## Assets

The `assets/` folder contains UI screenshot references captured from the running
Visun frontend during the product demo. These are PNG images at 1920×1080 showing
various screens (Today, Copilot, Projects, Inbox, Payments, Calendar, Leads,
Reports, Activity, Integrations, Preferences) from the seeded Paroha Studio demo
workspace. They are used as visual references for the demo video composition and
should not be committed to the repository unless the demo assets are published.

| File | Screenshot |
| --- | --- |
| `activity.png` | Activity audit trail |
| `calendar.png` | Calendar month/week/agenda views |
| `copilot-approval.png` | Copilot approval card and tool trace |
| `inbox.png` | Scope Inbox evidence and accept flow |
| `integrations.png` | Provider cards (Gemini, PayPal, Gmail, Telegram, Google Calendar) |
| `leads.png` | Leads pipeline and Nina Patel detail |
| `payments.png` | Invoice ledger with overdue INV-1045 and Draft reminder |
| `preferences.png` | Voice, language, style, and motion settings |
| `projects.png` | Project cards and Northwind detail |
| `reports.png` | Report preview with source-backed facts |
| `today.png` | Today dashboard overview and metrics |

These assets are generated from the capture script and are intended as reference
material for the product demo video. They are typically not included in the
repository git history unless the demo assets are being published alongside the
codebase.