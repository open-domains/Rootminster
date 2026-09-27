# Module: Server Runtime and Routes

`server/index.js` is the Fastify entry point. It configures middleware, public config, health checks, route modules, static frontend serving, error handling, and graceful shutdown.

## Responsibilities

- Assert production configuration before serving.
- Configure server-side GlitchTip if enabled.
- Register cookies, Helmet/CSP, global rate limiting, raw-body support, and URL-encoded body parsing.
- Block unsafe cross-origin cookie requests with an origin check.
- Return `/api/health` database status.
- Return `/api/config` feature, OAuth, Discord, GlitchTip, and branding flags safe for the browser.
- Register all route modules.
- Serve `dist/index.html` for non-API SPA routes when a production build exists.
- Mask 500-class error messages in production and capture server exceptions.

## Key Files

- `server/index.js` — main runtime.
- `server/config.js` — normalized runtime configuration.
- `server/csp.js` — content-security-policy directives.
- `server/database.js` — PostgreSQL pool and advisory lock helpers.
- Route modules: `auth.js`, `entity-routes.js`, `function-runner.js`, `mcp.js`, `setup.js`, `discord.js`, `public-api.js`, `module-settings.js`, `design.js`, `backup-routes.js`, `terms-routes.js`, `account-deletion-routes.js`, `passkeys.js`, `impersonation-routes.js`, `docker-manager.js`, `glitchtip.js`.

## Runtime Flow

1. Build Fastify with configured logging and proxy trust.
2. Register security and parsing middleware.
3. Add global restore-in-progress guard so backup restores return 503 except `/api/health`.
4. Add unsafe-method origin check for cookie-authenticated requests.
5. Register health/config endpoints and all route modules.
6. Serve frontend build if present.
7. Install error/shutdown handlers.
8. Listen on configured host/port.

## Dependencies

- **Uses:** Fastify, `@fastify/cookie`, Helmet, rate limit, static serving, `fastify-raw-body`, PostgreSQL pool, module settings, backup state.
- **Used by:** `npm start`, Docker `app` service, development API watcher.

## Gotchas

- `/api/webhooks/stripe`, `/api/auth/logout`, `/oauth/authorize`, and `/api/design-auth/authorize` are explicit exceptions to the unsafe-method origin check.
- If `dist/index.html` does not exist, the server only exposes APIs and does not serve the SPA.
- The global rate limit is 300/minute unless a route overrides it.
