# Visun backend

FastAPI + SQLModel modular monolith for the Visun workspace. It owns the
workspace snapshot, grounded agent, approval state machine, provider adapters,
and audit trail.

```bash
uv sync --extra dev
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload
```

- API docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/api/v1/health>
- SQLite database: `backend/visun.db` by default

## Modes

| Variable | Default | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `production` refuses demo auth and requires https origins |
| `DATABASE_URL` | `sqlite:///./visun.db` | PostgreSQL/Supabase supported via `postgresql+psycopg://` |
| `AUTH_MODE` | `demo` | `clerk` verifies a real bearer JWT against JWKS |
| `PROVIDER_MODE` | `simulated` | `real` calls providers or fails honestly |
| `AGENT_BACKEND` | `deterministic` | `gemini` adds phrasing over the same tool results |
| `VOICE_BACKEND` | `browser` | `gemini_live` bridges the Live API over WebSocket |

Every integration is optional. With defaults the API seeds a complete demo
workspace on first start and makes no external calls.

## Approval contract

1. `POST /api/v1/actions/prepare` stores the exact payload, canonical hash,
   expiry, and requester. Status: `pending_approval`.
2. `POST /api/v1/actions/{id}/approve` requires `expected_hash`. A stale hash is
   rejected. Expired or non-pending actions cannot execute.
3. Execution is single-shot and idempotent. `ActionEvent` records every state
   transition; `ToolExecution` and `ActivityEvent` record agent reads.
4. Simulated providers return `simulated: true` and `sim-<provider>-<id>`
   references. Nothing is ever labelled delivered without a provider receipt.

## Tests and migrations

```bash
.venv/bin/pytest
.venv/bin/ruff check .
.venv/bin/alembic upgrade head
.venv/bin/alembic downgrade base
```

The suite passes on SQLite and PostgreSQL 16. Point `DATABASE_URL` at Postgres
to repeat the run there.
