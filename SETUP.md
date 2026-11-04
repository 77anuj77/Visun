# Visun setup guide

This guide covers the three credential paths:

1. **Clerk** — real sign-in / sign-up and per-user workspaces.
2. **Supabase** — PostgreSQL for production data (SQLite remains the default).
3. **PayPal** — Sandbox invoice creation, status checks, and verified webhooks.

The product still runs with **no credentials**. Demo auth, simulated providers,
SQLite, and the deterministic agent are the defaults.

---

## 1. How the auth modes behave

| Setup | `Try Visun` | `Try demo` | `/app` |
|---|---|---|---|
| No Clerk key | Opens the demo workspace | Opens `/app?demo=1` | Open |
| Clerk key present | Opens the Clerk sign-in modal | Opens the seeded demo | Protected by Clerk |

With Clerk configured:

- `/app` redirects signed-out visitors to `/sign-in`.
- `/app?demo=1` sets a short-lived `visun_demo` cookie and opens the seeded
  workspace without an account.
- The profile menu can switch from the demo to a real session
  (`Sign in to your workspace`) or sign out.
- A signed-in first-time user gets an empty workspace. The seeded demo remains
  the separate demo path.

The backend accepts two credential styles in Clerk mode:

- `Authorization: Bearer <Clerk session JWT>` — verified against Clerk JWKS.
- `X-Visun-Demo: 1` — only when `ALLOW_PUBLIC_DEMO=true`; always resolves to the
  seeded demo workspace and never to a real user's data.

---

## 2. Local quick start (no credentials)

```bash
# Terminal 1 — API
cd backend
uv sync --extra dev
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload

# Terminal 2 — web
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Both `Try Visun` and `Try demo` work in demo mode;
the API is simulated and clearly labelled.

Verify:

```bash
curl http://localhost:8000/api/v1/health
curl -o /dev/null -w "%{http_code}\n" http://localhost:3000/app
```

---

## 3. Clerk

### 3.1 Create the Clerk application

1. Sign in at <https://dashboard.clerk.com>.
2. Create an application (for example `Visun`).
3. Enable the sign-in methods you want (email + password, email code, Google,
   etc.) under **User & authentication**.
4. Copy both keys from **Configure → API keys** (or **Developers → API keys**):
   - **Publishable key** — starts with `pk_test_` or `pk_live_`.
   - **Secret key** — starts with `sk_test_` or `sk_live_`.

The publishable key is public browser configuration. The secret key is
server-only and must never be committed or sent to the browser.

### 3.2 Set the Clerk paths

In the Clerk dashboard, set:

| Setting | Value |
|---|---|
| Sign-in URL | `/sign-in` |
| Sign-up URL | `/sign-up` |
| After sign-in URL | `/app` |
| After sign-up URL | `/app` |
| Home URL | `/` |

The app also passes these paths to `ClerkProvider` and its own sign-in /
sign-up pages, but the dashboard values keep Clerk's redirects consistent.

### 3.3 Optional: include name and email in the session token

The backend reads `sub`, `email`, `given_name`, `family_name`, and `name` from
the verified JWT. Clerk's default session token contains `sub` and standard
claims; the backend falls back to `Visun user` and a placeholder email when the
profile claims are absent.

To provision real names and emails, open **Sessions → Customize session token**
(or **Session tokens**) and add claims such as:

```json
{
  "email": "{{user.primary_email_address}}",
  "given_name": "{{user.first_name}}",
  "family_name": "{{user.last_name}}",
  "name": "{{user.full_name}}"
}
```

Claim template syntax can change between Clerk versions; check the current Clerk
dashboard preview before saving. Skipping this step does not block sign-in.

### 3.4 Frontend environment

Create `frontend/.env.local`:

```dotenv
BACKEND_ORIGIN=http://localhost:8000

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_secret_key

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
```

`CLERK_SECRET_KEY` is read by the Next.js proxy/middleware on the server. It is
not exposed by `NEXT_PUBLIC_*` and should not be prefixed that way.

Restart `npm run dev` after changing these values. `NEXT_PUBLIC_*` values are
inlined at build time, so a production deployment needs a fresh build.

### 3.5 Backend environment

Find the Frontend API URL in the Clerk dashboard (for example
`https://your-app.clerk.accounts.dev`). Create/update `backend/.env`:

```dotenv
AUTH_MODE=clerk
ALLOW_PUBLIC_DEMO=true

CLERK_ISSUER=https://your-app.clerk.accounts.dev
CLERK_JWKS_URL=
CLERK_JWT_AUDIENCE=
CLERK_SECRET_KEY=sk_test_your_secret_key
```

- `CLERK_JWKS_URL` is optional. When blank, the backend derives
  `<CLERK_ISSUER>/.well-known/jwks.json`.
- `CLERK_JWT_AUDIENCE` is optional. Leave blank unless your Clerk JWT template
  sets an audience.
- `CLERK_SECRET_KEY` is not required for JWT verification (JWKS is), but keep it
  available for webhook or future Admin API work.
- `ALLOW_PUBLIC_DEMO=true` keeps `Try demo` working on a Clerk-protected
  deployment. Set it to `false` if the demo must be private.

Restart the API after changing auth settings.

### 3.6 Verify Clerk

```bash
# Signed-out bootstrap should be rejected.
curl -i http://localhost:8000/api/v1/bootstrap

# The explicitly opted-in demo should work.
curl -i -H "X-Visun-Demo: 1" http://localhost:8000/api/v1/bootstrap

# The web app should redirect /app to /sign-in.
curl -I http://localhost:3000/app
```

In the browser:

1. Open <http://localhost:3000>.
2. Click **Try Visun** — the Clerk modal opens.
3. Create an account — you land on `/app` with your own workspace.
4. Click **Try demo** — the seeded demo opens without requiring an account.
5. Use the profile menu → **Sign in to your workspace** to leave the demo.

### 3.7 Production notes

- Use the live Clerk keys (`pk_live_…`, `sk_live_…`) only in production.
- Serve the frontend over HTTPS. The backend refuses an `http://`
  `FRONTEND_ORIGIN` when `ENVIRONMENT=production`.
- Add the production domain to Clerk's allowed origins/redirect URLs.
- `AUTH_MODE=demo` is refused in production by the backend configuration guard.
- Keep `ALLOW_PUBLIC_DEMO=false` unless you intentionally want the demo public.

---

## 4. Supabase (PostgreSQL)

SQLite is the zero-config default. Use Supabase when you want a managed
PostgreSQL database for a deployed or shared workspace.

### 4.1 Create the project

1. Sign in at <https://supabase.com/dashboard>.
2. Create a project and save the database password.
3. Open **Project Settings → Database → Connection string**.
4. Choose the **SQLAlchemy** / URI format. It looks like:

```text
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

For a direct connection (IPv6-capable networks):

```text
postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

Add the SQLAlchemy driver prefix:

```text
postgresql+psycopg://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

If your password contains reserved URL characters (`@`, `:`, `/`, `#`), URL-
encode it or let the Supabase dashboard copy the escaped URI.

### 4.2 Install the driver and point the backend at Supabase

```bash
cd backend
uv sync --extra dev --extra postgres
```

`backend/.env`:

```dotenv
DATABASE_URL=postgresql+psycopg://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Apply the schema with Alembic, then start the API:

```bash
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

On startup the API also seeds the demo workspace when it is empty. The same seed
supports demo mode and Clerk mode.

### 4.3 Verify

```bash
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

`database` should be `"ok"` and `databaseUrl` should point at your Supabase host
(credentials are not returned).

### 4.4 Supabase URL and service-role key

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **optional** for the current
MVP. The backend talks to PostgreSQL directly through `DATABASE_URL`; it does
not need Supabase's REST keys. Add them only when you introduce Supabase
Storage, Realtime, or direct browser access.

Rules:

- Keep the service-role key server-side. Never put it in `NEXT_PUBLIC_*`.
- The backend bypasses Supabase RLS because it connects as the database owner.
  Enforce workspace authorization in FastAPI regardless.
- If the browser ever talks to Supabase directly, configure Clerk as a Supabase
  third-party auth provider and write RLS policies keyed on Clerk's `sub`.

---

## 5. PayPal Sandbox

### 5.1 Create sandbox credentials

1. Sign in at <https://developer.paypal.com/dashboard>.
2. Open **Apps & Credentials → Sandbox**.
3. Create an app (for example `Visun Sandbox`).
4. Copy the **Client ID** and **Secret**.
5. Under **Testing Tools → Sandbox Accounts**, keep a business account (the
   merchant) and a personal account (the payer) for testing.

### 5.2 Backend environment

```dotenv
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=

# simulated keeps the demo local; real calls the Sandbox API.
PROVIDER_MODE=simulated
```

Switch to real Sandbox calls only when you want the adapter to create invoices
and fetch status:

```dotenv
PROVIDER_MODE=real
```

With `PROVIDER_MODE=real` and missing credentials, the action fails loudly. It is
never reported as a simulated success. With `PROVIDER_MODE=simulated`, every
result carries `simulated=true` and a `sim-*` reference; no PayPal request is
made.

### 5.3 Webhook (optional but recommended for verification)

1. In the PayPal app, add a webhook URL:

   ```text
   https://your-api.example.com/api/v1/integrations/paypal/webhook
   ```

2. Subscribe to the invoice/payment events you need (for example
   `INVOICING.INVOICE.PAID`).
3. Copy the webhook ID into `PAYPAL_WEBHOOK_ID`.
4. The backend verifies PayPal's signature headers and deduplicates event IDs
   before marking a payment verified.

For local development, expose the API with a tunnel (for example
`ngrok http 8000`) and use the public HTTPS URL in the webhook configuration.

### 5.4 What the integration currently does

- Creates a PayPal **Invoicing v2** invoice / payment request in Sandbox.
- Looks up invoice status for reconciliation.
- Verifies webhook signatures and records verified payment events.
- Never treats an AI-generated sentence, an optimistic UI update, or a draft
  invoice as proof of payment.

The client still has to approve and pay the invoice in PayPal. Do not describe a
created invoice as "paid".

---

## 6. Optional providers

These are not required for the core demo:

- **Gemini / Google ADK** — `GOOGLE_API_KEY`, `GEMINI_TEXT_MODEL`,
  `GEMINI_LIVE_MODEL`, `AGENT_BACKEND=gemini`, `VOICE_BACKEND=gemini_live`.
- **Gmail / Google Calendar** — `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, redirect URI
  `http://localhost:8000/api/v1/integrations/google/callback`.
- **Telegram** — bot token, webhook secret, allowed chat IDs, and a
  chat-to-project map.

Each starts in simulated mode and must be explicitly switched to real mode.

---

## 7. Deployment checklist

### Frontend (Vercel or similar)

```dotenv
BACKEND_ORIGIN=https://your-api.example.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_or_test_...
CLERK_SECRET_KEY=sk_live_or_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
```

- Rebuild after changing any `NEXT_PUBLIC_*` value.
- The Next rewrite forwards `/api/backend/*` to `BACKEND_ORIGIN/api/v1/*`.

### Backend

```dotenv
ENVIRONMENT=production
DATABASE_URL=postgresql+psycopg://...
AUTH_MODE=clerk
ALLOW_PUBLIC_DEMO=false
FRONTEND_ORIGIN=https://your-frontend.example.com
CLERK_ISSUER=https://your-app.clerk.accounts.dev
CLERK_SECRET_KEY=sk_live_...
PROVIDER_MODE=real
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENVIRONMENT=live
PAYPAL_WEBHOOK_ID=...
```

- Production refuses `AUTH_MODE=demo` and non-HTTPS `FRONTEND_ORIGIN`.
- Run `alembic upgrade head` before starting the API.
- Never commit `.env`, `.env.local`, service-role keys, or PayPal secrets.

---

## 8. Troubleshooting

| Symptom | Likely fix |
|---|---|
| `Try Visun` opens the demo instead of Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is empty or the app was not rebuilt after adding it. |
| Clerk modal opens but API calls return 401 | Backend `AUTH_MODE` is still `demo`, `CLERK_ISSUER` is wrong, or the session token audience does not match `CLERK_JWT_AUDIENCE`. |
| `/app` does not redirect to sign-in | Clerk key missing in the frontend environment, or `npm run dev` was not restarted. |
| `Try demo` returns 401 in Clerk mode | Set `ALLOW_PUBLIC_DEMO=true` in `backend/.env`; the browser sends `X-Visun-Demo: 1`. |
| New Clerk user sees no projects | Expected: new users start with an empty workspace. The seeded data is the demo path. |
| Supabase connection times out | Use the pooler host/port (`6543`) on IPv4-only networks, or the direct `5432` host where IPv6 is available. |
| `psycopg` import error | Run `uv sync --extra postgres`. |
| PayPal returns a credential error in real mode | Add Sandbox client ID/secret or switch back to `PROVIDER_MODE=simulated`. |
| PayPal webhook returns 401 | `PAYPAL_WEBHOOK_ID` is missing or the signature headers did not survive the tunnel/proxy unchanged. |
| A simulated action looks real | Check the activity detail: simulated results always say so and use a `sim-*` reference. |
