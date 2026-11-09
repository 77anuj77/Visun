# Visun self-hosted installation

This guide installs one private Visun instance on a customer's own computer or
private server with Docker Compose. Each installation has its own SQLite
database volume, encryption key, and provider credentials. Nothing is shared
with the public demo or with another customer.

> **Scope:** the repository currently ships the application source and Docker
> configuration; it does not publish prebuilt images. Build them from the
> customer's checkout or from a release archive you provide.

---

## 1. What runs

```
Browser
  │  http://localhost:3000
  ▼
frontend (Next.js, port 3000, published)
  │  /api/backend/*  →  same-origin rewrite
  ▼
backend (FastAPI, port 8000, internal network only)
  └── /data/visun.db on the named volume `visun-data`
```

- Public marketing pages: `/`, `/pricing`, `/contact`.
- Free demo: `/app?demo=1`, no account required.
- Private workspace: `/app`, protected by Clerk.
- The API container is not published to the host. Only the web container is.
- The optional Caddy profile adds a reverse proxy on port 8080.

---

## 2. Requirements

| Requirement | Notes |
| --- | --- |
| Docker Engine + Compose plugin | Linux server, or Docker Desktop on macOS / Windows with WSL2. |
| 2 GB free RAM | More if the host is also running other services. |
| ~2 GB free disk | Images plus the SQLite database and backups. |
| A Clerk application | Required for private customer sign-in. See §4.1. |
| Outbound HTTPS | Needed for Clerk, Gemini, PayPal, Google, Telegram, Resend. |
| Optional: domain + TLS | Required for LAN/remote use; localhost is a secure context for microphone access. |

The backend deliberately refuses `AUTH_MODE=demo` when `ENVIRONMENT=production`.
A production customer installation therefore requires Clerk until a local
owner-account system is reviewed and approved (see
[`docs/authentication.md`](./authentication.md)). Local `localhost` installs may
use `ENVIRONMENT=development` with Clerk, which is the default template.

### Architecture support

The images use `python:3.12-slim` and `node:22-alpine`, which publish both
`linux/amd64` and `linux/arm64` variants. Builds on an Apple Silicon Mac or an
ARM server produce ARM64 images. Cross-architecture builds are possible with
Docker Buildx but are **not tested in this repository**. Test the target
architecture before promising it to a customer.

---

## 3. Get the files

```bash
git clone https://github.com/77anuj77/Visun.git
cd Visun/docker
```

Create the three configuration files:

```bash
cp .env.example .env
cp env/backend.env.example env/backend.env
cp env/frontend.env.example env/frontend.env
```

`docker/.env` is read by Compose (ports, public origin, Clerk publishable key).
`env/backend.env` and `env/frontend.env` are runtime secrets for each container.
None of these files belong in Git.

On Windows PowerShell, use `Copy-Item .env.example .env`, etc.

---

## 4. Configure the installation

### 4.1 Clerk (private app sign-in)

1. Create a Clerk application at <https://dashboard.clerk.com>.
2. Enable the sign-in methods the customer wants.
3. Set the paths:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in / sign-up: `/app`
4. Copy the **publishable key** (`pk_test_…` or `pk_live_…`) into
   `docker/.env` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
5. Copy the publishable key and the **secret key** (`sk_…`) into
   `docker/env/frontend.env`. The secret is used by the Next.js proxy at runtime.
6. Copy the secret key and the Frontend API URL into
   `docker/env/backend.env`:

```dotenv
AUTH_MODE=clerk
CLERK_ISSUER=https://your-app.clerk.accounts.dev
CLERK_JWKS_URL=
CLERK_JWT_AUDIENCE=
CLERK_SECRET_KEY=sk_...
```

`CLERK_JWKS_URL` is optional; when blank the backend derives
`<CLERK_ISSUER>/.well-known/jwks.json`. Restart after changing auth settings.

The publishable key is inlined into the browser bundle at build time. If you
change it later, rebuild the frontend image.

### 4.2 Encryption key

Generate one key **per installation**:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put it in `docker/env/backend.env` as `APP_ENCRYPTION_KEY`. This key encrypts
saved Gemini, PayPal, Google, and Telegram credentials. Do not reuse the
developer's key. Do not rotate it after credentials exist without a planned
rewrap/migration; rotating it makes existing encrypted values unreadable.

### 4.3 Gemini

Optional. Add a key in `docker/env/backend.env`:

```dotenv
GOOGLE_API_KEY=
GEMINI_TEXT_MODEL=
GEMINI_LIVE_MODEL=
AGENT_BACKEND=auto
VOICE_BACKEND=auto
```

Leave the model fields blank to use the documented defaults. The key can also
be saved per workspace after sign-in under **Settings → Integrations**, where it
is encrypted with `APP_ENCRYPTION_KEY`. Gemini API usage is billed by Google to
the customer's own account; it is not included in the installation price.

### 4.4 Contact email (Resend)

The marketing contact form sends installation requests to the owner's inbox.
Configure these in `docker/env/frontend.env`:

```dotenv
RESEND_API_KEY=
CONTACT_TO_EMAIL=
CONTACT_FROM_EMAIL="Visun <onboarding@resend.dev>"
```

Until a sending domain is verified in Resend, the configured `CONTACT_TO_EMAIL`
must be the email address on the Resend account. No inquiries are stored in the
database.

### 4.5 Optional providers

Set only what the customer has authorized. Keep `PROVIDER_MODE=simulated` until
real access is connected and tested.

```dotenv
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

For Google OAuth through the web origin, use:

```text
http://localhost:3000/api/backend/integrations/google/callback
```

When running behind a LAN/domain, replace `localhost:3000` with the real origin.
The backend is not published directly, so the callback must go through the
frontend rewrite.

---

## 5. Start Visun

From `docker/`:

```bash
docker compose up -d --build
```

The backend waits on its health check before the frontend starts. Follow logs:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

Open <http://localhost:3000>.

If port 3000 is taken, set `VISUN_PORT=3010` in `docker/.env`, update
`VISUN_APP_ORIGIN` to `http://localhost:3010`, then rebuild/restart.

---

## 6. First run and verification

Complete [`docs/first-run.md`](./first-run.md). Minimum checks:

1. `/` renders; there is no sign-in/sign-up CTA on the marketing pages.
2. `/pricing` shows **$0 Visun Demo**, **Contact for Pricing**, and **Custom
   Quote**. There is no checkout.
3. `/app?demo=1` opens the seeded demo without an account.
4. In the demo, approving a simulated provider action reports it as simulated.
5. `/app` redirects to Clerk sign-in; after sign-in the owner lands in their own
   workspace.
6. A project can be created and survives `docker compose restart`.
7. **Settings → Integrations** can save and test the owner's Gemini key.
8. A contact submission reaches `CONTACT_TO_EMAIL` (or reports 503 when Resend
   is not configured).
9. `curl -fsS http://localhost:3000/api/backend/health` returns JSON with
   `"status": "ok"`.

Voice requires microphone permission and a secure browser context. `localhost`
counts as secure; a plain-HTTP LAN address does not. Use HTTPS for LAN voice.

---

## 7. Persistence and backups

The database lives on the named volume `visun-data`, not in the image. Back up
before every upgrade.

### Backup (safe, backend stopped)

```bash
cd Visun/docker
mkdir -p backups
docker compose stop backend
docker run --rm \
  -v visun-data:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar czf /backup/visun-data-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .'
docker compose start backend
```

Keep a copy off the machine. The archive contains the database and any
credentials encrypted with `APP_ENCRYPTION_KEY`; protect it accordingly. Back up
`env/backend.env` separately and securely, because the encryption key is needed
to read those credentials.

### Restore (destructive)

> This replaces the current database. It cannot be undone.

```bash
cd Visun/docker
docker compose down
docker volume rm visun-data
docker volume create visun-data
docker run --rm \
  -v visun-data:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar xzf /backup/visun-data-YYYYMMDD-HHMMSS.tar.gz -C /data'
docker compose up -d
```

Restoring into an existing volume can leave stale rows; remove the volume first.

---

## 8. Upgrade

1. Take a backup (§7).
2. Fetch the new source/release.
3. Inspect release notes for environment changes.
4. Rebuild and restart:

```bash
cd Visun/docker
docker compose build --pull
docker compose up -d
```

The backend entrypoint runs `alembic upgrade head` before starting, so pending
schema revisions are applied automatically. If a migration fails, the container
exits and the old database remains; restore the backup if needed.

Never delete the volume to “fix” an upgrade unless you intend to lose data.

---

## 9. Uninstall

```bash
cd Visun/docker
docker compose down
```

This removes the containers and network. The database volume remains. Delete it
only when the customer explicitly wants their data destroyed:

```bash
docker volume rm visun-data
```

Remove the copied `docker/` checkout and local `backups/` afterwards. Revoke the
customer's Clerk keys and provider credentials if the installation is retired.

---

## 10. LAN or remote access

By default only the web port is published, and it listens on all host
interfaces. If you do not want LAN access, bind it explicitly:

```yaml
ports:
  - "127.0.0.1:${VISUN_PORT:-3000}:3000"
```

For a trusted LAN or domain:

1. Put HTTPS in front of the frontend. The optional Caddy profile is a starting
   point; configure certificates for the real hostname.
2. Set `VISUN_APP_ORIGIN=https://visun.example.com` in `docker/.env`.
3. Set `ENVIRONMENT=production` in `env/backend.env` only after HTTPS works.
4. Add the origin to Clerk's allowed origins and redirect URLs.
5. Keep the API container unpublished. Do not expose port 8000.
6. Update Google OAuth redirect URIs to the public origin.

Do not forward the API or database ports to the internet. Backend authorization
still applies, but there is no reason to expose those services.

---

## 11. Security boundaries

- Images contain no `.env`, no developer database, and no provider keys.
- The browser never receives Gemini, PayPal, Google, Telegram, or Resend secrets.
- Credentials saved through Settings are encrypted with `APP_ENCRYPTION_KEY`.
- External writes are prepared, hashed, expiring, and executed only by the
  workspace owner's explicit approval.
- The public demo never reaches a real provider: approvals and PayPal rechecks
  are forced to simulated mode, and its reset route only deletes demo rows.
- `AUTH_MODE=demo` is refused in production. Do not use it as customer auth.
- Keep `ALLOW_PUBLIC_DEMO=true` only if the free demo should be reachable. Set it
  to `false` for a fully private installation.

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` on compose | The build arg is required. Add the key to `docker/.env`. |
| Frontend builds but `/app` opens the demo | The key was empty at build time. Rebuild the frontend. |
| API returns 401 after sign-in | `AUTH_MODE=clerk`, `CLERK_ISSUER`, and `CLERK_SECRET_KEY` must match the same Clerk app on frontend and backend. |
| `/app` does not redirect | Clerk key missing from the frontend build, or `CLERK_SECRET_KEY` missing at runtime. |
| Mic permission is unavailable over LAN | Browsers require HTTPS (or localhost) for microphone access. |
| Contact form returns 503 | Resend variables are missing or invalid. Nothing was sent. |
| Database resets after `up` | A bind mount or removed volume was used instead of `visun-data`. |
| `database is locked` | Only the bundled SQLite setup is supported for one instance. Do not run multiple backend replicas against one file. |
| ARM/AMD image mismatch | Build on the target architecture or use Buildx; cross-arch is untested. |

For the authentication decision and remaining work, read
[`docs/authentication.md`](./authentication.md).
