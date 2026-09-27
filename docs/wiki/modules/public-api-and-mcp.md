# Module: Public API and MCP

Rootminster has a versioned public REST API under `/api/v1` and a role-aware MCP endpoint under `/mcp`.

## Responsibilities

- Create, list, and revoke scoped API tokens from the browser.
- Authenticate bearer API tokens by hashed `ApiToken` entity values.
- Enforce token scopes, expiry, revocation, owner status, hostname restrictions, and DNS record type restrictions.
- Expose public domain/availability endpoints and authenticated account/request/DNS/analytics/DDNS endpoints.
- Serve an OpenAPI 3.1 document.
- Provide MCP OAuth 2.1/PKCE dynamic client registration and role-aware tools.

## Key Files

- `server/public-api.js` — `/api/v1` route registration, token auth, OpenAPI document, scopes, DDNS validation.
- `server/mcp.js` — MCP OAuth, token storage, client registration, tool schemas, user/staff tools.
- `src/pages/ApiDocs.jsx` — frontend API docs route.
- `src/components/ApiTokenManager.jsx` — user token creation/revocation UI.
- `server/functions/publicApi.js` — legacy `/functions/publicApi?action=...` compatibility handler.

## Public API Token Model

Tokens are generated with an `od_` prefix, stored only as SHA-256 hashes, and exposed once at creation. User-created scopes are selected from `account:read`, `requests:read`, `requests:write`, `dns:read`, `dns:write`, `dns:dynamic`, `analytics:read`, and `analytics:write`.

Hostname restrictions must be exact DNS hostnames. Dynamic DNS additionally requires hostname restrictions and A/AAAA record-type restrictions.

## MCP Model

The MCP server advertises user tools and staff tools. OAuth clients use authorization-code flow with PKCE S256. Access tokens expire after one hour; refresh tokens after 30 days. Staff/admin access requires MFA verification because `authenticateMcp()` only accepts elevated users when `mfa_verified_at` is present.

## Dependencies

- **Uses:** store, auth, config, function runner, request bundle helpers, PostgreSQL OAuth/MCP tables.
- **Used by:** external automation, API clients, ChatGPT/Claude-style remote control, API docs UI.

## Gotchas

- Legacy tokens with no scopes retain normal user API access, but never inherit `dns:dynamic` or staff scopes.
- Token rate limiting keys use a SHA-256 hash of the presented token when present, otherwise client IP.
- MCP tools can call approval/rejection handlers, so tool schemas and role/MFA checks are part of the security boundary.
