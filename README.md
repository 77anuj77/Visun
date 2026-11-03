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

Open <http://localhost:3000/app>. The frontend hydrates from
`/api/backend/bootstrap` (rewritten to FastAPI by `next.config.ts`) and falls
back to a local snapshot if the API is down. The topbar shows whether the API is
online, and labels simulated data as simulated.

API docs: <http://localhost:8000/docs>.

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
  app/              # marketing page + /app workspace routes
  components/       # shell, UI kit, brand
  lib/              # API client, store, types, demo data, agent fallback
```

## Known boundaries

- Gemini Live and real Gmail/Calendar/PayPal/Telegram calls need real
  credentials and are exercised by guarded code paths, not the demo.
- Report PDF rendering is optional (`weasyprint` extra); the UI exports a
  plain-text copy.
- The Next.js rewrite does not proxy WebSocket upgrades; the voice UI uses the
  browser speech stack and a transcript fallback, not a tunnelled Live socket.
