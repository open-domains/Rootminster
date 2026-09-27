# Module: Authentication and Security

Authentication centers on `server/auth.js`, with supporting modules for password hashing, passkeys/MFA, impersonation, setup, terms, and route-level authorization.

## Responsibilities

- Register users with email/password, optional email verification, and disposable-email blocking.
- Authenticate password logins and OAuth users.
- Store sessions as hashed random tokens in PostgreSQL and issue HTTP-only cookies.
- Enforce MFA for users with TOTP/passkeys and for staff/admin roles.
- Publicly serialize users without password hashes, TOTP secrets, metadata, session internals, or parent-session internals.
- Support password resets, logout, profile updates, OAuth state, and administrator impersonation metadata.

## Key Files

- `server/auth.js` — registration, login, sessions, OAuth user upsert, auth middleware, password reset, profile routes.
- `server/security.js` — token generation, hashing, password verification, setting-secret encryption helpers.
- `server/passkeys.js` — WebAuthn/passkey registration, login, and MFA flows.
- `server/impersonation-routes.js` — admin impersonation session controls.
- `server/setup.js` — initial administrator setup.
- `server/terms-routes.js` — terms publishing and acceptance flows.
- `server/csp.js` — browser security policy.
- `server/entity-routes.js` — server-side read/write authorization for generic entities.

## Session Model

`authenticateRequest()` reads a bearer token or configured cookie, hashes it with SHA-256, and joins `sessions` to active `users`. It returns serialized user data plus session internals needed for authorization. The session row records user agent, IP, expiry, MFA verification time, impersonation details, and optional parent session.

## Security Controls

- Argon2id password hashing via `server/security.js`.
- HTTP-only, same-site session cookie; secure in production.
- Origin check for unsafe cookie-authenticated requests.
- MFA required for staff/admins and accounts with TOTP/passkeys.
- Rate limits on sensitive endpoints such as register, login, resend verification, password reset, contact email, two-factor, device auth, and public API.
- Error masking for function/server 500s in production.
- Secret redaction/encryption for module settings and sensitive entity fields.

## Dependencies

- **Uses:** PostgreSQL, SMTP mail, module settings, disposable email rules, security helpers.
- **Used by:** route modules, entity authorization, function execution, MCP/API auth adapters.

## Gotchas

- UI route guards are not authorization boundaries; server handlers must keep checking role and ownership.
- `authenticateRequest(..., { allowMfaPending: true })` is only for flows that need to inspect a logged-in but not MFA-verified session.
- `publicUser()` intentionally strips internal auth fields; do not bypass it in user-facing responses.
