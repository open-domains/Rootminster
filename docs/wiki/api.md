# API Surface

Rootminster exposes several API layers. They share the same PostgreSQL data and auth primitives but serve different callers.

## Browser Auth API

Implemented mostly in `server/auth.js`, `server/passkeys.js`, and supporting route modules.

Common endpoints include:

- `POST /api/auth/register` — create an account, optionally requiring email verification.
- `POST /api/auth/verify-email` — activate a pending account from a single-use token.
- `POST /api/auth/login` — password login; sets the configured HTTP-only session cookie.
- `GET /api/auth/me` — return the current public user, allowing MFA-pending sessions.
- `PATCH /api/auth/me` — update allowed profile fields.
- `POST /api/auth/logout` — delete session and clear cookie.
- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password` — password reset flow.
- Passkey and MFA routes are registered from `server/passkeys.js` and used by `rootminster.passkeys`.

The frontend wrapper lives in `src/api/rootminsterClient.js` under `rootminster.auth`, `rootminster.passkeys`, and related namespaces.

## Entity API

Implemented by `server/entity-routes.js` and `server/store.js`.

- `GET /api/entities/:entity`
- `GET /api/entities/:entity/:id`
- `POST /api/entities/:entity`
- `POST /api/entities/:entity/bulk`
- `PATCH /api/entities/:entity/:id`
- `DELETE /api/entities/:entity/:id`

Important behavior:

- `Domain` and selected public `PlatformSettings` can be read anonymously.
- Admins can read most entities and update users.
- Staff can read elevated operational data and write `AbuseReport`.
- Normal users can read their own users, requests, DNS records, ownerships, API tokens, trusted devices, donations, and non-internal comments tied to their requests.
- `ApiToken` and `TrustedDevice` hashes are redacted.
- `Donation` routes are disabled unless the donations module is enabled.

## Function API

Implemented by `server/function-runner.js` with handlers under `server/functions/`.

- `POST /api/functions/:name`
- `POST /functions/:name`
- special routes: `GET /api/functions/publicApi`, `POST /api/functions/twoFactorAuth`, `POST /api/functions/deviceAuth`, `POST /api/webhooks/stripe`

Representative function handlers:

- Request lifecycle: `submitRequest`, `approveRequest`, `rejectRequest`, `appealRequest`, `postComment`, `getRequestConversation`, `getQueueStatus`.
- DNS: `manageDnsRecord`, `updateDnsRecord`, `verifyDnsRecords`, `syncCloudflare`, `scheduledSync`, `repairMissingCfRecords`, `checkAvailability`, `checkDomainHealth`, `getCloudflareZones`.
- Admin/migration: `adminListUsers`, `adminMigrateDomains`, `adminDirectCfOp`, `githubMigrate`, `githubMigrateVerify`.
- Integrations: `analyticsManager`, `createDonationSession`, `stripeWebhook`, `sendDiscordNotification`, `weeklyStatsDiscord`, `rdapLookup`, `deviceAuth`, `twoFactorAuth`.

`cleanupPendingDonations`, `scheduledSync`, and `weeklyStatsDiscord` are allow-listed for internal invocation but removed from the HTTP-exposed function set.

## Versioned Public API

Implemented by `server/public-api.js` and exposed under `/api/v1`.

Documented endpoints are served from:

- `GET /api/v1/openapi.json`
- UI route `/api-docs`

The code defines API version `1.2.0`, bearer token parsing, token rate-limit keys, pagination, public record/request serializers, token scopes, hostname restrictions, DNS record restrictions, and Dynamic DNS IP validation.

Token scopes include:

- `account:read`
- `requests:read`
- `requests:write`
- `dns:read`
- `dns:write`
- `dns:dynamic`
- `analytics:read`
- `analytics:write`

Dynamic DNS requires tokens restricted to owned hostnames and A/AAAA record types. The API rejects private, loopback, documentation, multicast, and link-local addresses.

## MCP Remote Control Plane

Implemented by `server/mcp.js` at `/mcp` when the `mcp` module is enabled.

It provides:

- OAuth 2.1 authorization-code flow with PKCE.
- Dynamic client registration.
- Bearer access tokens and rotating refresh-token storage in PostgreSQL.
- User tools: account info, own subdomains, own requests.
- Staff tools: pending reviews, get review request, approve request, reject request.

Staff/admin MCP token use requires MFA verification according to the token query in `authenticateMcp()`.

## Frontend API Client

`src/api/rootminsterClient.js` centralizes fetch behavior:

- Sends `credentials: 'include'` for cookie sessions.
- Adds a local-storage bearer token if present.
- JSON-encodes bodies except `FormData`.
- Converts non-OK responses into `Error` objects with `status`, `code`, `data`, and `response`.
- Provides namespaced helpers for entities, setup, Discord linking, API tokens, passkeys, impersonation, terms, account deletion, modules, Docker, backups, functions, integrations, and auth.
