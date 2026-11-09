# First-run configuration

This is the manual first-run flow for one customer installation. It assumes the
steps in [`docs/installation.md`](./installation.md) are complete and the stack
is running.

There is intentionally **no browser setup wizard** yet. An unauthenticated
setup endpoint that can create an owner or write secrets is a security risk; the
secure local-account setup flow is pending approval (see
[`docs/authentication.md`](./authentication.md)). Until then, the installer
configures the files and verifies the instance with the customer.

## 1. Generate the installation identity

- [ ] Generate a unique `APP_ENCRYPTION_KEY` and put it in
      `docker/env/backend.env`.
- [ ] Confirm the image does **not** contain a database:
      `docker compose exec backend ls -la /data`
      should show only the runtime database, never a copied `visun.db` from the
      developer.
- [ ] Confirm the named volume exists: `docker volume inspect visun-data`.

Never reuse the developer's key, database, or `.env` files.

## 2. Configure private sign-in

- [ ] Create/choose the customer's Clerk application.
- [ ] Put the publishable key in `docker/.env` and rebuild the frontend.
- [ ] Put the secret key in `docker/env/frontend.env`.
- [ ] Put `AUTH_MODE=clerk`, `CLERK_ISSUER`, and `CLERK_SECRET_KEY` in
      `docker/env/backend.env`.
- [ ] Add the installation origin to Clerk's allowed origins and redirect URLs.
- [ ] Restart and complete one sign-in/sign-out round trip.
- [ ] Confirm the signed-in owner gets their own workspace, not the demo.

The first owner account is created through Clerk on first sign-in. The backend
provisions the user, workspace, and owner membership automatically.

## 3. Decide demo exposure

- [ ] For a public marketing site, keep `ALLOW_PUBLIC_DEMO=true`.
- [ ] For a fully private installation, set `ALLOW_PUBLIC_DEMO=false` and verify
      `/app?demo=1` no longer reaches the backend.
- [ ] In the demo, approve one prepared action and confirm the result says it
      was **simulated** and no external provider was contacted.
- [ ] Confirm the demo reset only restores demo records. It must never remove a
      real workspace.

## 4. Configure AI

- [ ] Either set `GOOGLE_API_KEY` / models in `backend.env`, or sign in and save
      the key under **Settings → Integrations**.
- [ ] Use **Test connection**. It performs a real text-model request instead of
      trusting the model list.
- [ ] Run one text chat and confirm the backend used Gemini or clearly fell back
      to the deterministic engine.
- [ ] If voice is wanted, grant microphone permission on `localhost` or HTTPS,
      start a Live session, and verify barge-in and the saved transcript.
- [ ] Set voice, language (English / Hindi / Auto), and style preferences.

## 5. Configure optional integrations

Do only what the customer has authorized.

- [ ] **PayPal:** sandbox credentials first; keep `PROVIDER_MODE=simulated`
      until a real sandbox test passes.
- [ ] **Google:** OAuth client, redirect URI on the public origin, Gmail and/or
      Calendar consent.
- [ ] **Telegram:** bot token, webhook secret, allowed chat IDs, chat/project
      map. Point the webhook at the public origin.
- [ ] **Resend:** key and owner inbox for installation inquiries.
- [ ] Record which providers are simulated, connected, or untested.

## 6. Verify persistence and recovery

- [ ] Create a project and a deadline.
- [ ] `docker compose restart` and confirm both still exist.
- [ ] Save a credential in Settings, restart, and confirm it still decrypts.
- [ ] Take a backup using the installation guide.
- [ ] Restore it into a scratch environment if the customer wants a rehearsal.

## 7. Handover checklist

- [ ] Customer knows the local URL and how to start/stop the stack.
- [ ] Customer owns the Clerk, Gemini, PayPal, Google, Telegram, and Resend
      accounts and keys.
- [ ] Backups are scheduled and stored off the machine.
- [ ] The encryption key and `backend.env` are stored securely.
- [ ] The customer knows updates are manual and no automatic update exists.
- [ ] Known limitations are stated: internet required for Gemini, no offline
      AI, multi-user Studio deployment untested, cross-architecture untested.
- [ ] Demo and private data are clearly explained.
