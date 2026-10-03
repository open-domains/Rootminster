# Module: Modules, Integrations, and Configuration

`server/module-settings.js` defines Rootminster's optional integration modules and how their settings are loaded, normalized, encrypted, cached, and exposed to admins.

## Responsibilities

- Declare module IDs, names, descriptions, default enabled state, fields, and environment fallbacks.
- Normalize field values by type: boolean, number, select, text, URL, secret.
- Encrypt/decrypt secret fields using security helpers.
- Cache loaded module config briefly to reduce database reads.
- Support admin updates and environment import.
- Provide safe public config through `server/index.js`.

## Module Definitions

Defined modules include:

- `docker_engine`
- `r2_backup`
- `glitchtip`
- `disposable_email`
- `branding`
- `cloudflare`
- `email`
- `turnstile`
- `donations`
- `google_oauth`
- `github_oauth`
- `discord`
- `safety`
- `mcp`
- `analytics`
- `design`

## Key Files

- `server/module-settings.js` — module definitions and admin routes.
- `server/config.js` — bootstrap environment config.
- `server/security.js` — setting secret encryption/decryption.
- `server/mail.js` — SMTP integration.
- `server/discord.js` and `server/lib/discord-requests.js` — Discord interactions.
- `server/r2.js` and `server/backup-service.js` — R2 backups.
- `server/glitchtip.js` / `src/lib/glitchtip.js` — monitoring.
- `server/docker-manager.js` — Hostinger VPS Docker manager integration.
- `server/design.js` — Design site-builder authorization/publishing integration.

## Data Storage

Module values are stored as `PlatformSettings` records with keys prefixed by `module_config:`. Secret fields are encrypted before persistence and decrypted when loading module config. Browser-safe flags are returned from `/api/config`; secret values should not be returned to the browser.

## Dependencies

- **Uses:** store, environment config, encryption helpers.
- **Used by:** auth, mail, Cloudflare, Turnstile, donations, Discord, backups, public config, analytics, Docker manager, MCP, Design integration.

## Gotchas

- `getModuleConfig(id, { fresh: true })` bypasses the short cache and should be used where immediate admin changes matter.
- Some modules default to enabled if environment bootstrap values exist; others require explicit admin configuration.
- Keep README/docs synchronized when adding module fields because operators configure most integrations from Admin → Module Settings.
