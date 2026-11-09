# Visun — Architecture

Visun is a voice-first operations workspace for freelancers and small studios. A Next.js frontend talks to a FastAPI backend over a same-origin proxy. The backend owns all secrets, persists workspace data in SQLite (or Postgres via SQLModel/Alembic), runs a tool-calling agent over that data, and bridges Gemini Live audio over a WebSocket. External writes (payments, email, calendar) never happen directly from the agent: they are *prepared*, hashed, and executed exactly once after explicit owner approval.

This document describes the runtime shape of the system and what every file in the repository is for. Generated or local-only paths (`node_modules/`, `.next/`, `__pycache__/`, `backend/visun.db`, `.env`) are intentionally not listed.

---

## 1. Runtime topology

```
Browser
  ├─ marketing pages        /, /pricing, /contact            (public, animated)
  ├─ Clerk sign-in/up       /sign-in, /sign-up               (optional)
  └─ workspace              /app/*                           (auth gate; demo cookie in demo mode)
        │
        │  same-origin fetch  /api/backend/*     ──rewrite──▶  FastAPI  /api/v1/*
        │  WebSocket         /api/backend/agent/voice ─────▶   FastAPI  /api/v1/agent/voice
        ▼
  Next.js server (proxy.ts)                          FastAPI (backend/app)
  ├─ /api/contact (Resend)                            ├─ API routers
  └─ rewrites to BACKEND_ORIGIN                       ├─ services (agent, voice, actions, providers, reports…)
                                                      ├─ SQLModel tables in visun.db / Postgres
                                                      └─ Gemini (text + Live), PayPal, Gmail,
                                                         Telegram, Google Calendar APIs
```

Key invariants:

- The browser never sees a provider secret. Gemini, PayPal, Gmail and Telegram credentials live in the backend, encrypted with `APP_ENCRYPTION_KEY`.
- Agent reads are grounded in persisted workspace records and return `sources`.
- Agent writes are `ActionApproval` rows. Approval is owner-only, hash-checked, expiring and idempotent.
- `PROVIDER_MODE=simulated` can move data inside Visun but never reports a real external write as sent.
- `AUTH_MODE=demo` is refused in production; Clerk is required there.

---

## 2. Root-level files

| File | Purpose |
| --- | --- |
| `README.md` | Product overview, feature tour, quick start, and repository layout. The main entry point for a new developer. |
| `PRD.md` | Product requirements: personas, jobs, feature scope, non-goals, and acceptance criteria that the implementation is measured against. |
| `SETUP.md` | Step-by-step local setup: Python/uv, Node, environment variables, demo vs Clerk mode, provider configuration, and troubleshooting. |
| `techstack.md` | Chosen stack and the reasoning behind each choice (Next.js App Router, FastAPI, SQLModel, Gemini Live, Clerk, Resend, Tailwind). |
| `backend.md` | Backend-focused notes: API surface, data model, agent/approval design, provider behavior, and operational caveats. |
| `frontend.md` | Frontend-focused notes: route groups, design system, store/data flow, animation conventions, and accessibility rules. |
| `architecture.md` | This file: system topology and a purpose statement for every file in the repo. |
| `.gitignore` | Excludes virtualenvs, `node_modules`, build output, local databases, `.env` files and caches. |

---

## 3. Backend (`backend/`)

FastAPI application, SQLModel persistence, and the agent/voice/provider services. Run with `uv run uvicorn app.main:app --reload` from `backend/`.

### 3.1 Application entry and package config

| File | Purpose |
| --- | --- |
| `backend/app/__init__.py` | Marks `app` as a Python package (empty). |
| `backend/app/main.py` | Creates the FastAPI app, configures CORS for the frontend origins, installs JSON error handlers, mounts the four routers under `/api/v1`, initializes logging/DB in `lifespan`, and serves a root metadata endpoint. |
| `backend/pyproject.toml` | Project metadata and dependencies (FastAPI, SQLModel, google-genai, google-adk, PyJWT, cryptography, ReportLab, ruff, pytest) plus tool configuration. |
| `backend/uv.lock` | Locked dependency graph for reproducible `uv sync` installs. |
| `backend/alembic.ini` | Alembic configuration pointing at `migrations/` and the database URL. |
| `backend/migrations/env.py` | Alembic runtime: binds SQLModel metadata, supports offline SQL generation and online migrations using the app's settings. |
| `backend/migrations/script.py.mako` | Template used by `alembic revision` to generate new migration files. |
| `backend/migrations/versions/0001_initial.py` | Baseline migration creating every Visun table (workspace, projects, invoices, approvals, credentials, preferences, webhook events…). |
| `backend/.env.example` | Documented environment template: auth mode, Clerk keys, database URL, Gemini models/keys, OAuth, PayPal, Telegram, encryption key, provider mode. Contains no secrets. |
| `backend/README.md` | Backend-specific run instructions, environment reference, and API/agent notes. |
| `backend/tests/__init__.py` | Marks the test package (empty). |

### 3.2 API layer (`backend/app/api/`)

| File | Purpose |
| --- | --- |
| `backend/app/api/__init__.py` | Package marker (empty). |
| `backend/app/api/system.py` | `GET /health` (deployment status + provider/agent/voice capabilities; authenticated callers also get a workspace credential overlay and effective `configured`/`model`/`source`), `GET /bootstrap` (the full serialized workspace snapshot the frontend hydrates from), and `POST /reset-demo` (rebuilds demo data; demo-only). |
| `backend/app/api/workspace.py` | The main CRUD/read surface: dashboard metrics, projects and milestones, scope findings, deadlines, leads, outstanding payments and rechecks, reports (preview/create/send/PDF), integrations and per-provider credentials (status, save, clear, live test), preferences, activities, and agreement change proposals. Every query is scoped to the caller's workspace and role. |
| `backend/app/api/assistant.py` | Conversation CRUD, message history, `POST /agent/chat` (one grounded agent turn), the `GET /agent/voice` WebSocket entry point, and the approval API (`prepare`, `get`, `approve`, `reject`, list actions, list tool executions). |
| `backend/app/api/webhooks.py` | Public, unauthenticated provider callbacks: Telegram webhook (secret-token checked), PayPal webhook (signature verified), and the Google OAuth start/callback flow with signed short-lived `state`. Includes event deduplication (`_dedupe`) and an audit record (`_record_event`). |

### 3.3 Core (`backend/app/core/`)

| File | Purpose |
| --- | --- |
| `backend/app/core/__init__.py` | Package marker (empty). |
| `backend/app/core/config.py` | Pydantic `Settings` loaded from `.env` (with legacy `VISUN_*` aliases), `DEFAULT_LIVE_MODEL`, CORS origin assembly, and a production guard that refuses demo auth, missing Clerk config, or plain-HTTP origins. |
| `backend/app/core/database.py` | SQLModel engine creation, SQLite pragmas (WAL, foreign keys), schema bootstrap, session dependency, `init_db()` startup work, and `reset_demo()` for the seeded demo workspace. |
| `backend/app/core/security.py` | Authentication and authorization: resolves a `Principal` from a Clerk JWT (JWKS/issuer), demo mode, or the opt-in public demo header; lazily provisions workspace/user/member rows; enforces writer/owner roles; provides `get_optional_principal` for anonymous-safe endpoints; and implements the in-process rate limiter used by chat/voice. |
| `backend/app/core/errors.py` | One consistent JSON error envelope (`code`, `message`, `detail`) and exception handlers so validation, HTTP and unhandled errors look identical to the client. |
| `backend/app/core/logging.py` | Structured logging setup (`configure_logging`) and the shared `log` instance used across services. |

### 3.4 Data model and contracts (`backend/app/`)

| File | Purpose |
| --- | --- |
| `backend/app/models.py` | All SQLModel tables: `User`, `Workspace`, `WorkspaceMember`, `Client`, `Project`, `Agreement`, `Milestone`, `Lead`, `Invoice`, `Payment`, `ExternalMessage`, `ScopeFinding`, `Conversation`, `ConversationMessage`, `ToolExecution`, `ActionApproval`, `ActionEvent`, `IntegrationCredential`, `Report`, `ProviderCredential`, `IntegrationConnection`, `ActivityEvent`, `Preference`, `WebhookEvent`. Defines timestamps, enums, uniqueness and workspace foreign keys. |
| `backend/app/schemas.py` | Pydantic request/response contracts for every mutating endpoint: chat, conversations, projects/milestones, scope review, reports, agreements, leads, actions, integrations/credentials, preferences, payments, activities, and the voice WebSocket hello frame. |
| `backend/app/serializers.py` | Converts ORM rows into the camelCase shapes the Next.js client consumes: users, workspace, clients, projects, milestones, agreements, invoices, leads, findings, messages, actions, conversations, reports, integrations, activities, preferences, and the composed `snapshot()` used by `/bootstrap`. |
| `backend/app/seed.py` | Seeds the demo workspace from the frontend's reference data, remaps ids consistently, guarantees idempotency, and only gives the documented sample account sample records. |
| `backend/app/timeutil.py` | Small date/money helpers: parse/emit ISO timestamps, convert dollars↔cents, and normalize timezone-aware values. |

### 3.5 Services (`backend/app/services/`)

| File | Purpose |
| --- | --- |
| `backend/app/services/__init__.py` | Package marker (empty). |
| `backend/app/services/assistant.py` | Conversation orchestration shared by text and voice: ensure a conversation exists, allocate message sequence numbers, persist user/assistant turns, call the configured agent backend, attach proposed actions, and delete conversations with their messages. |
| `backend/app/services/agent.py` | Agent abstraction: `AgentBackend` interface with `DeterministicAgent` (grounded, no external model), `GeminiAgent` (Gemini function calling), and `AdkAgent` (Google ADK). `configured_agent()` picks one per workspace credentials/settings and `agent_status()` reports the choice. |
| `backend/app/services/agent_tools.py` | Read-only grounded tools shared by the deterministic and Gemini agents: open invoices, pending payments, deadlines, scope-change detection, leads, reports, integrations, project summaries, and drafting a payment reminder. Returns `ToolResult` with sources. |
| `backend/app/services/workspace_tools.py` | Write-capable workspace tools exposed to the ADK agent (create/update projects and deadlines, move leads, draft reports…). Enforces role checks, project ownership and workspace isolation, and refuses cross-workspace ids. |
| `backend/app/services/adk_agent.py` | Runs Google ADK with the workspace tools, normalizes tool traces into Visun's `ToolCall` shape, extracts the final assistant text, and raises `AdkUnavailable` so callers can fall back honestly. |
| `backend/app/services/actions.py` | The approval state machine and exactly-once execution: `prepare_action()` snapshots payload + hash + expiry, `approve_action()` checks owner/hash/expiry/provider connection and executes once, `reject_action()`, `sync_action_status()`, plus activity/audit events. |
| `backend/app/services/providers.py` | Provider adapters for PayPal, Gmail, Telegram and Google Calendar. Each implements `ProviderAdapter.execute()` returning a `ProviderResult`; simulated mode returns clearly-marked synthetic results, real mode calls the API and surfaces errors. Includes `adapter_for()` and `execute_provider_action()`. |
| `backend/app/services/credentials.py` | Per-workspace provider credentials: `PROVIDER_SPECS` (fields, env fallbacks, secret flags), encrypted `save_values()` / `clear_values()`, merged `resolve_values()`, masked `credential_status()`, source reporting, and real verification (`verify_provider()`) against Gemini, PayPal, Gmail, Calendar, Telegram and Discord. |
| `backend/app/services/crypto.py` | Fernet encryption/decryption derived from `APP_ENCRYPTION_KEY` (SHA-256), used for credential and OAuth-token storage. |
| `backend/app/services/hashing.py` | Canonical JSON serialization, payload hashing, and idempotency keys used by approvals and webhook processing. |
| `backend/app/services/ai_config.py` | Resolves the effective AI configuration for a workspace: stored provider values → environment → defaults. Adds `is_live_model()` / `_live_model()` guards so a text model in the Live field falls back to `DEFAULT_LIVE_MODEL`, and exposes `resolve_live_config`, `resolve_ai_config`, `ai_status`. |
| `backend/app/services/reports.py` | Builds source-backed reports: gathers project/workspace facts, computes default periods, generates a preview and optional Gemini narrative (honest fallback when unavailable), and renders the PDF with ReportLab. |
| `backend/app/services/voice.py` | The Gemini Live bridge: authenticates the socket, builds the Hinglish/Indian-English persona and language/style directions, negotiates native-audio `speech_config`, VAD, barge-in (`START_OF_ACTIVITY_INTERRUPTS`), handle-based session resumption, context compression, transcripts, live tool declarations and tool execution with the approval flow, and a browser-fallback signal when Live is unavailable. |

### 3.6 Tests (`backend/tests/`)

| File | Purpose |
| --- | --- |
| `backend/tests/conftest.py` | Test harness: sets demo auth, browser voice backend and a throwaway encryption key; provides an HTTP client, `api` helpers, demo settings and a `clean_workspace` fixture that resets workspace-scoped rows. |
| `backend/tests/test_api.py` | End-to-end API behavior: health modes, demo-header opt-in, bootstrap shape, grounded dashboard, scope review persistence, agent grounding, approval prepare/approve/idempotency/stale-hash/expiry, simulated-provider honesty, reports, leads, unconfigured webhooks, shared voice/text history, persisted tool executions. |
| `backend/tests/test_agent_tools.py` | Tool safety: writes stay inside the agent's workspace, read-only roles cannot write, reminders require approval and are not sent, and ADK is selected only with workspace credentials (falling back otherwise). |
| `backend/tests/test_project_crud.py` | Manual project/milestone editing with no integration connected: create with new/existing client, partial updates, milestone create/update/delete, and cascade cleanup on project delete. |
| `backend/tests/test_reports.py` | Report generation from stored records, preview priority, empty-workspace honesty, PDF rendering, and listing. |
| `backend/tests/test_credentials.py` | Credential storage: encryption at rest, masking, workspace scoping, partial updates preserving existing values, honest verification results, and refusal to store secrets in the shared demo workspace. |
| `backend/tests/test_provisioning.py` | Provisioning rules: only the documented sample account gets sample records, every other account starts empty, seeding is idempotent, and existing records are never overwritten. |
| `backend/tests/test_voice_config.py` | Live voice config: default model/capabilities, workspace resolution, legacy fields gated by model family, voice preferences reaching the Live config, health capability reporting, text-model-in-Live-field fallback, authenticated workspace health overlay, and preference round-trip. |

---

## 4. Frontend (`frontend/`)

Next.js App Router with two route groups — `(marketing)` for public pages and `app/` for the authenticated workspace — plus a thin same-origin API proxy.

### 4.1 App routes (`frontend/app/`)

| File | Purpose |
| --- | --- |
| `frontend/app/layout.tsx` | Root layout: loads Inter, Instrument Serif and IBM Plex Mono, sets metadata/viewport, wraps the tree in `ClerkProvider` (only when configured) and imports `globals.css`. |
| `frontend/app/globals.css` | Tailwind v4 theme tokens (colors, fonts, radii, shadows), base styles, component/utility layers, and the `.mk-*` marketing-only namespace so cursor hiding and marquee motion never leak into the dashboard. |
| `frontend/app/(marketing)/layout.tsx` | Public shell: marketing nav, footer, custom cursor and smooth scroll around marketing pages. |
| `frontend/app/(marketing)/page.tsx` | Landing page: hero, story stack, agent preview, sticker sheet, feature sections, CTAs; client component using `motion/react` with reduced-motion handling. |
| `frontend/app/(marketing)/pricing/page.tsx` | Pricing page: Free/Pro/Studio comparison, billing notes, FAQ-style clarifications and CTAs. No invented prices beyond the published tiers defined there. |
| `frontend/app/(marketing)/pricing/layout.tsx` | Route metadata (title/description/OG) for `/pricing`. |
| `frontend/app/(marketing)/contact/page.tsx` | Contact page and validated form (name, email, message, honeypot, rate-limit feedback) posting to `/api/contact`. |
| `frontend/app/(marketing)/contact/layout.tsx` | Route metadata for `/contact`. |
| `frontend/app/api/contact/route.ts` | Node-runtime contact endpoint: validates input, escapes HTML, enforces a honeypot and in-memory rate limit, deduplicates recent sends, and delivers via Resend with `replyTo`. Returns structured errors; never logs message bodies or keys. |
| `frontend/app/app/layout.tsx` | Workspace layout: reads Clerk auth / demo cookie, redirects unauthenticated visitors to sign-in, and mounts `ClerkWorkspaceProvider`, `AppShell` and the toast provider. |
| `frontend/app/app/page.tsx` | Dashboard: outstanding revenue, deadlines, project health, agent activity, quick actions, and a command/voice entry point. |
| `frontend/app/app/copilot/page.tsx` | The agent workspace: conversation list, streaming-style chat, grounded sources/tool traces, approval cards, and the voice panel (start/stop, transcript, voice/language/style settings, barge-in controls). Largest client component. |
| `frontend/app/app/projects/page.tsx` | Projects index: filters, search, budget/deadline summaries, create/edit dialogs and navigation to detail. |
| `frontend/app/app/projects/[id]/page.tsx` | Project detail: milestones, agreement/scope findings, invoices, client info, deadline editing and agent shortcuts. |
| `frontend/app/app/calendar/page.tsx` | Deadline calendar with month/week views, drag-free scheduling, and create/edit via `DeadlineDialog`. |
| `frontend/app/app/leads/page.tsx` | Lead pipeline by stage with inline updates and conversion actions. |
| `frontend/app/app/inbox/page.tsx` | Unified client inbox: external messages, scope-change findings, review states and reply/draft shortcuts. |
| `frontend/app/app/payments/page.tsx` | Invoices and outstanding payments: status breakdown, reminder drafting through approvals, PayPal recheck, copy/email actions. |
| `frontend/app/app/reports/page.tsx` | Report builder/list: preview from real records, generate, download PDF, and send through an approval. |
| `frontend/app/app/activity/page.tsx` | Audit/activity feed of agent, approval, integration and user events with filters. |
| `frontend/app/app/settings/integrations/page.tsx` | Integrations hub: connection toggles, per-provider credential forms (masked previews), live "test connection" results, OAuth start for Google, and honest unconfigured states. |
| `frontend/app/app/settings/preferences/page.tsx` | Preferences: profile/timezone, agent behavior, notification and voice settings (voice, English/Hindi/Auto, Natural/Professional/Energetic), plus demo reset/export. |
| `frontend/app/sign-in/[[...sign-in]]/page.tsx` | Clerk `<SignIn />` page with branding and a graceful message when Clerk is not configured. |
| `frontend/app/sign-up/[[...sign-up]]/page.tsx` | Clerk `<SignUp />` page, same fallback behavior. |

### 4.2 Components (`frontend/components/`)

| File | Purpose |
| --- | --- |
| `frontend/components/ui/index.tsx` | The design-system primitives: `Button`, `Tone`, `Badge`, `Switch`, `Panel`, `SectionHeading`, `Progress`, `Avatar`, `Modal`, `Drawer`, `EmptyState`, plus `ToastProvider`/`useToast`. All workspace pages build on these. |
| `frontend/components/shell/AppShell.tsx` | Workspace chrome: sidebar/mobile nav state, topbar, command palette, page transition and keyboard shortcuts. |
| `frontend/components/shell/Sidebar.tsx` | Desktop navigation: grouped links, collapse behavior, workspace badge and settings entry. |
| `frontend/components/shell/MobileNav.tsx` | Slide-in mobile navigation mirroring the sidebar. |
| `frontend/components/shell/Topbar.tsx` | Contextual header: breadcrumb/page title, search/command trigger, notifications, connection state and account actions. |
| `frontend/components/shell/CommandPalette.tsx` | ⌘K palette: fuzzy navigation, quick agent prompts and page actions. |
| `frontend/components/shell/nav.ts` | Single source of truth for navigation items, groups and per-route metadata (`pageMeta`). |
| `frontend/components/auth/AuthActions.tsx` | Auth-aware CTAs (`SignInCta`, `SignUpCta`, `DemoLink`, `ClerkSignOut`) that degrade to demo links when Clerk is disabled. |
| `frontend/components/auth/ClerkWorkspaceProvider.tsx` | Bridges Clerk sessions into the app store: supplies the token getter to the API client, handles signed-out state and renders the demo/loading fallback. |
| `frontend/components/brand/Logo.tsx` | `LogoMark` and `Logo` wordmark components used across marketing and the app shell. |
| `frontend/components/projects/ProjectDialog.tsx` | Create/edit project modal with client reuse/creation, budget, status and due-date validation. |
| `frontend/components/calendar/DeadlineDialog.tsx` | Create/edit/delete milestone-and-deadline modal used by the calendar and project pages. |
| `frontend/components/marketing/MarketingNav.tsx` | Sticky public nav with scroll state, mobile menu and auth CTAs. |
| `frontend/components/marketing/MarketingFooter.tsx` | Public footer with product/company links, demo CTA and wordmark treatment. |
| `frontend/components/marketing/MarketingCursor.tsx` | Marketing-only custom cursor (disabled for touch/reduced motion; never mounted in the app). |
| `frontend/components/marketing/SmoothScroll.tsx` | Scoped Lenis smooth scrolling for marketing routes, synced with GSAP ticker and reduced-motion aware. |
| `frontend/components/marketing/Motion.tsx` | Reusable marketing motion primitives: `Reveal`, `FlipWord`, `Kicker`, `ArrowLink`. |
| `frontend/components/marketing/AgentPreview.tsx` | Animated product demo showing the agent reading invoices/deadlines and preparing an approval. |
| `frontend/components/marketing/StoryStack.tsx` | Scroll-driven narrative section (sticky/stacked panels) with per-step illustrations. |
| `frontend/components/marketing/StickerSheet.tsx` | Playful sticker collage of product capabilities used on the landing page. |
| `frontend/components/marketing/ClosingCta.tsx` | Shared closing call-to-action band for marketing pages. |
| `frontend/components/marketing/Faq.tsx` | Radix accordion FAQ component. |

### 4.3 Libraries (`frontend/lib/`)

| File | Purpose |
| --- | --- |
| `frontend/lib/api.ts` | Typed client for the FastAPI backend. Handles auth headers (Clerk token or demo header), same-origin `/api/backend` base URL, timeouts, structured `ApiResult` errors, every endpoint wrapper (bootstrap, chat, actions, projects, reports, credentials, preferences…), and `openVoiceSocket()` for the Live WebSocket. |
| `frontend/lib/voice-client.ts` | Gemini Live browser client: microphone capture (mono Float32 → 16 kHz PCM16), streaming over the WebSocket, queued 24 kHz playback, barge-in on speech, mute/teardown without leaks, reconnect/status events, and transcript callbacks. |
| `frontend/lib/store.tsx` | Global `AppStoreProvider`/`useAppStore`: hydrates from `/bootstrap`, exposes connection/auth/provider state, keeps demo state in `localStorage` only in demo mode, and implements optimistic mutations (projects, milestones, leads, actions, preferences) with rollback on API failure. |
| `frontend/lib/types.ts` | Shared TypeScript domain types used by the store, pages and components: projects, milestones, invoices, leads, actions, conversations, integrations, voice preferences, workspace state. |
| `frontend/lib/demo-data.ts` | The seeded reference workspace: clients, projects, milestones, agreements, findings, invoices, leads, reports, activities, integrations, preferences, conversations and `defaultState`. Also used by the backend seed logic. |
| `frontend/lib/agent.ts` | Deterministic local reply builder (`buildAgentReply`) used for demo/offline previews: matches prompts to grounded workspace facts, tool traces, sources and a reminder action. |
| `frontend/lib/utils.ts` | Formatting and domain helpers: `cn`, money/date/time formatting, relative time, overdue/upcoming checks, initials, ids, status labels/tone, sums and percentages. |
| `frontend/lib/auth-config.ts` | Clerk opt-in flags and URLs derived from env (`clerkEnabled`, sign-in/up URLs, after-auth destinations), plus the demo cookie name shared with `frontend/proxy.ts`. |

### 4.4 Frontend configuration

| File | Purpose |
| --- | --- |
| `frontend/next.config.ts` | Rewrites `/api/backend/:path*` to `${BACKEND_ORIGIN}/api/v1/:path*`, enables strict mode, Turbopack root, package-import optimization, and disables unrelated agent rules. Keeps browser calls same-origin (no CORS secrets). |
| `frontend/proxy.ts` | Clerk middleware (exported as the Next proxy): protects `/app(.*)` when Clerk is configured, implements the 8-hour `?demo=1` cookie / `?demo=0` sign-out path, and always lets a real session win. Skips Next internals and API rewrites via the matcher. |
| `frontend/package.json` | Frontend scripts (`dev`, `build`, `start`, `lint`) and dependencies (Next, React, Clerk, Tailwind v4, motion, Radix, lucide, date-fns, recharts, Resend). |
| `frontend/package-lock.json` | npm lockfile for reproducible installs. |
| `frontend/tsconfig.json` | TypeScript configuration: strict mode, bundler resolution, `@/*` path alias to the frontend root, Next plugin. |
| `frontend/eslint.config.mjs` | ESLint flat config built on Next core-web-vitals + TypeScript, with documented rule relaxations for the React Compiler heuristic on intentional client-only animation code. |
| `frontend/postcss.config.mjs` | PostCSS setup registering `@tailwindcss/postcss` (Tailwind v4). |
| `frontend/.env.example` | Frontend env template: `BACKEND_ORIGIN`, Clerk publishable key, and Resend contact-form keys. No secrets. |

---

## 5. How the main flows cross files

### Boot and auth
`frontend/app/layout.tsx` → `frontend/lib/auth-config.ts` → `frontend/app/app/layout.tsx` → `frontend/proxy.ts` (Clerk or demo cookie) → `frontend/components/auth/ClerkWorkspaceProvider.tsx` → `frontend/lib/store.tsx` → `frontend/lib/api.ts` `bootstrap()` → `backend/app/api/system.py` → `backend/app/core/security.py` resolves/provisions the workspace → `backend/app/serializers.py` `snapshot()`.

### One agent turn
`frontend/app/app/copilot/page.tsx` → `frontend/lib/api.ts` `agentChat()` → `backend/app/api/assistant.py` → `backend/app/services/assistant.py` `chat()` → `backend/app/services/agent.py` (`DeterministicAgent` / `GeminiAgent` / `AdkAgent`) → `backend/app/services/agent_tools.py` or `backend/app/services/workspace_tools.py` → serializers → persisted `ConversationMessage` and optional `ActionApproval`.

### Approval and external write
`backend/app/services/actions.py` `prepare_action()` stores payload hash + expiry → UI approval card or voice confirmation → `POST /actions/{id}/approve` → `approve_action()` re-checks owner/hash/expiry/connection → `backend/app/services/providers.py` `execute_provider_action()` (simulated or real) → `ToolExecution` + `ActionEvent` + activity record. Replays return the original result.

### Voice
Copilot start → `frontend/lib/voice-client.ts` captures mic → WebSocket `/api/backend/agent/voice` → `backend/app/api/assistant.py` `agent_voice` → `backend/app/core/security.py` `websocket_principal` → `backend/app/services/voice.py` `handle_voice_socket` resolves the workspace's Live config via `backend/app/services/ai_config.py` → streams PCM to Gemini Live and back → transcripts persisted through `backend/app/services/assistant.py` → tool calls reuse the same approval path.

### Credentials and health
`frontend/app/app/settings/integrations/page.tsx` → `frontend/lib/api.ts` credential methods → `backend/app/api/workspace.py` → `backend/app/services/credentials.py` (`save_values`/`verify_provider`, encrypted via `backend/app/services/crypto.py`) → `ProviderCredential` rows. `GET /health` overlays those same resolved values for authenticated callers via `backend/app/services/ai_config.py`, without exposing secrets.

---

## 6. Conventions and extension points

- **Add an API route:** schema in `backend/app/schemas.py` → logic in `backend/app/api/workspace.py` (or a new router mounted in `backend/app/main.py`) → serializer if the shape is new → typed wrapper in `frontend/lib/api.ts` → store mutation if the UI should cache it.
- **Add an agent tool:** read-only in `backend/app/services/agent_tools.py`; writes in `backend/app/services/workspace_tools.py` and exposed through `backend/app/services/voice.py` `_live_tools` only if it is safe to prepare (never execute) from voice.
- **Add a provider:** extend `PROVIDER_SPECS` and `verify_provider` in `backend/app/services/credentials.py`, add an adapter in `backend/app/services/providers.py`, then wire UI in the integrations page.
- **Add a table:** model in `backend/app/models.py`, serializer projection, Alembic revision, and seed/reset handling in `backend/app/seed.py`/`backend/app/core/database.py`.
- **Styling:** use tokens from `frontend/app/globals.css` and primitives from `frontend/components/ui`; marketing-only effects stay behind `.mk-*` and the `(marketing)` route group.
- **Secrets:** never in `NEXT_PUBLIC_*`, never in responses, never logged. The backend is the only place that talks to providers.
