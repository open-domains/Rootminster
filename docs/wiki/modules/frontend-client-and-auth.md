# Module: Frontend Client and Auth

`src/api/rootminsterClient.js` is the browser-side API adapter. `src/lib/AuthContext.jsx` keeps current user state and exposes auth helpers to components.

## Responsibilities

- Normalize `fetch` calls, JSON encoding, cookie credentials, and error objects.
- Attach optional local-storage bearer tokens under `rootminster_access_token`.
- Expose entity CRUD through a dynamic `entities` proxy.
- Provide namespaced clients for setup, Discord, API tokens, passkeys, impersonation, public config, terms, account deletion, modules, Docker, backups, function invocation, and auth.
- Load `/api/auth/me` at startup and track `user`, `isAuthenticated`, `isLoadingAuth`, and `authError`.

## Key Files

- `src/api/rootminsterClient.js` — fetch wrapper and client namespaces.
- `src/lib/AuthContext.jsx` — React context for signed-in state.
- `src/lib/query-client.js` — TanStack Query client.
- `src/lib/public-config.js` — public config helpers.
- `src/lib/client-error-filter.js` — client error filtering.
- `src/lib/glitchtip.js` — optional browser monitoring initialization.

## Public API

`rootminster.entities.<Entity>` supports `list`, `filter`, `get`, `create`, `bulkCreate`, `update`, and `delete` against `/api/entities`.

`rootminster.functions.invoke(name, data)` wraps `POST /api/functions/:name` and returns `{ data: result }` for compatibility with existing component code.

`rootminster.auth` covers login, registration, email verification, password reset, profile update, logout, provider redirects, and local bearer-token storage helpers.

## Dependencies

- **Uses:** browser `fetch`, `localStorage`, `Headers`, React context/hooks.
- **Used by:** nearly every page/component that reads or mutates Rootminster state.

## Gotchas

- The fetch wrapper always sends cookies (`credentials: 'include'`), so server-side origin/CSRF checks matter for unsafe methods.
- API token local-storage support exists for bearer-token workflows but browser sessions are normally cookie-based.
- Errors thrown by the client include both a user-facing message and structured `status/code/data` fields; components should preserve those where possible.
