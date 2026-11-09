# Self-hosted authentication strategy

This document evaluates authentication for a customer-owned Visun instance. It
is a **recommendation, not an implemented replacement**. Clerk remains the only
supported private-app authentication today. No local owner-account system has
been built.

## Current behavior

| Mode | Status | Security notes |
| --- | --- | --- |
| `AUTH_MODE=demo` | Local development and the public seeded demo only | Refused when `ENVIRONMENT=production`. Never use it for a customer's private workspace. |
| `AUTH_MODE=clerk` | Implemented and supported | Verifies Clerk JWTs against JWKS; provisions a per-user workspace; preserves owner checks, approvals, and WebSocket authentication. |
| Local owner account | Not implemented | Requires explicit approval and a security review before implementation. |

The backend resolves every request to a `Principal` with `user_id`,
`workspace_id`, `role`, and identity fields. Every query and write is scoped by
workspace, approvals require `owner`, and the voice WebSocket authenticates its
first frame with the same principal resolution. Any replacement must preserve
these invariants rather than bypassing them.

## Options

### 1. Keep Clerk (recommended for now)

- **Pros:** already integrated end to end (middleware, JWT verification,
  workspace provisioning, WebSocket handshake, account recovery, MFA options).
  Little new security surface. Works for a private instance that has internet.
- **Cons:** an external account dependency and an online sign-in. The customer
  must create a Clerk application and provide keys. Clerk outages or key
  misconfiguration block private sign-in.
- **Offline:** the app and SQLite database run locally, but private sign-in
  needs Clerk. The public demo does not.
- **Verdict:** ship this for initial installations. Document it clearly.

### 2. Local owner account (best long-term fit, needs approval)

A local account would make a customer installation independent of a hosted
identity provider.

Minimum design requirements:

- **Password hashing:** Argon2id (or scrypt) with per-password salt and
  calibrated parameters. Never store or log plaintext passwords.
- **Sessions:** random server-side session tokens, stored hashed, delivered in
  `HttpOnly`, `Secure`, `SameSite=Lax` cookies. Rotate on login; expire idle and
  absolute sessions; revoke on logout.
- **CSRF:** origin checks plus a per-session CSRF token for state-changing
  requests. The current API uses bearer headers, so the client and backend
  contract would change.
- **Rate limiting:** login, recovery, and registration attempts limited per IP
  and account. The current in-process limiter is per instance; acceptable for a
  single-container install, not a cluster.
- **Account recovery:** a one-time recovery code generated at setup and stored
  offline by the owner, or a CLI reset executed with local machine access.
  Email-based recovery reintroduces an external dependency.
- **First-run setup:** a one-time setup route that is disabled after the owner
  exists, protected by a short-lived setup token printed to the container logs
  or written to a root-only file. It must not be an unauthenticated permanent
  endpoint.
- **Authorization:** map the local user to the existing `Principal` and
  `WorkspaceMember` rows. Preserve owner/member/viewer checks and approval rules.
- **WebSocket:** authenticate the socket with the session cookie or a
  short-lived signed token in the first frame; never put reusable credentials in
  the URL.
- **Multi-user:** do not advertise Studio multi-user access until invitations,
  per-user credentials, role enforcement, and isolation are tested.

Risks: passwords and recovery become the customer's responsibility; a local
account system is security-critical code and must be reviewed before it is sold.
A compromised host already owns the database and encryption key, so local auth
does not protect against a root-level attacker.

### 3. External identity provider (Clerk, Auth0, Keycloak, etc.)

- **Pros:** mature MFA, recovery, and session handling; no password storage in
  Visun.
- **Cons:** another online dependency, configuration burden, and vendor cost.
  Keycloak could be self-hosted but adds a service to operate and back up.
- **Verdict:** Clerk is the current implementation; a different provider is only
  worth it if a customer requires it.

## Recommendation

1. **Short term:** ship private installations with Clerk. Keep
   `ALLOW_PUBLIC_DEMO=true` for the marketing demo and force all demo provider
   work to simulated mode.
2. **Before selling an offline-first local install:** approve and build a local
   owner authentication system with Argon2id, secure cookie sessions, CSRF
   protection, rate limiting, one-time setup, and recovery. Do not reuse
   `AUTH_MODE=demo`.
3. **Do not** expose private application data to unauthenticated callers, and do
   not remove Clerk until the replacement is implemented, tested against the
   existing API and WebSocket paths, and approved.

## Impact if a local account is approved

| Area | Change |
| --- | --- |
| `backend/app/core/security.py` | Add local session resolution alongside Clerk; keep `Principal` and role checks. |
| Database | New users/sessions tables with hashed passwords and hashed session tokens; migration required. |
| Frontend middleware | Validate a session cookie instead of Clerk middleware; protect `/app`. |
| API client | Send cookies or a session token; preserve authorization headers and workspace isolation. |
| WebSocket | Authenticate with the session and keep the existing first-frame contract semantics. |
| Approvals | Unchanged: owner-only, hash-checked, expiring, idempotent. |
| Demo | Stays unauthenticated and simulated; it is not production auth. |

## Decision needed

**Approve or reject a local owner-account implementation.** Until then, the
Docker installation requires Clerk and the docs state that limitation
explicitly.
