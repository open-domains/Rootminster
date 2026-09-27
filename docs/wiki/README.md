# Rootminster Code Wiki

Rootminster is the self-hosted management platform behind Open Domains. It combines a React/Vite web interface, a Fastify API, PostgreSQL persistence, Cloudflare DNS operations, staff review workflows, public API tokens, optional integrations, and a scheduled job runner in one Node.js application.

Source inspected: `/root/Rootminster` at `26c9f26aacb006269da47e3788f8de338a623a1e`.

## Key Concepts

- **Entities** — durable operational records exposed through `/api/entities/:entity`; regular users see only their own records while staff/admins get wider access.
- **Function handlers** — domain-specific commands under `server/functions/` invoked through `/api/functions/:name` and internally by jobs/MCP/API adapters.
- **Module settings** — optional integrations such as Cloudflare DNS, SMTP, Discord, Stripe, Umami, R2 backups, MCP, and branding are defined in `server/module-settings.js` and stored as encrypted settings.
- **Request bundles** — grouped subdomain requests and comments are handled together for staff review, approval, rejection, and MCP views.
- **Ownership namespaces** — approved DNS records and `SubdomainOwnership` records determine what hostnames a user can later manage.
- **Background automation** — `server/jobs.js` runs cleanup, DNS sync, DNS verification, weekly Discord stats, and scheduled R2 backups.

## Entry Points

- `src/main.jsx` — mounts the React application.
- `src/App.jsx` — declares public, authenticated, staff, and admin routes.
- `src/api/rootminsterClient.js` — browser API client used throughout the frontend.
- `server/index.js` — Fastify server, middleware, route registration, health endpoint, static frontend serving, and shutdown handling.
- `server/jobs.js` — scheduled maintenance process.
- `server/migrate.js` + `server/schema.sql` — database schema initialization and migrations.
- `scripts/import-data.js` — import path for existing entity data.

## High-Level Architecture

The browser talks to a Fastify API using cookie-backed browser sessions and, for the versioned public API, bearer API tokens. Most business operations are implemented as function handlers that receive a bound platform client; handlers then read/write the entity store, call integration modules, and sometimes mutate Cloudflare DNS.

See `architecture.md` for the system diagram and runtime flows.

## Module Map

| Module | Purpose |
|---|---|
| `modules/frontend-routing-and-ui.md` | React route tree, layouts, pages, and UI composition. |
| `modules/frontend-client-and-auth.md` | Browser API wrapper, auth context, local bearer token support, and client-side integrations. |
| `modules/server-runtime-and-routes.md` | Fastify boot process, middleware, route registration, health checks, and static serving. |
| `modules/authentication-and-security.md` | Sessions, login, registration, OAuth, MFA/passkeys, CSRF-origin checks, and sanitization. |
| `modules/entity-store-and-data-model.md` | PostgreSQL schema, JSONB entity store, serialization, filtering, and access rules. |
| `modules/function-handlers-and-dns-workflows.md` | `/api/functions` execution model, subdomain requests, DNS approval/management, Cloudflare calls. |
| `modules/public-api-and-mcp.md` | `/api/v1` token API, OpenAPI generation, DDNS, and MCP OAuth/tooling. |
| `modules/modules-integrations-and-configuration.md` | Optional module definitions, encrypted settings, environment import, and public config. |
| `modules/jobs-and-backups.md` | Cron schedules, advisory locks, encrypted R2 backups, restore behavior, and job runner gotchas. |

## Diagrams

- `architecture.md` — system architecture and data flow.
- `diagrams/class-diagram.md` — main data types and service relationships.
- `diagrams/sequences.md` — request submission, approval, API token, and scheduled backup workflows.

## Getting Started

See `getting-started.md`.

## API Notes

See `api.md` for the browser API, entity API, function API, versioned public API, and MCP surfaces.
