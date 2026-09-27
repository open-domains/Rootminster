# Module: Entity Store and Data Model

Rootminster uses PostgreSQL for all durable state. Identity/security tables are relational, while operational entities are stored in a flexible JSONB table through `server/store.js`.

## Responsibilities

- Define allowed entity names.
- Serialize users and entity records into frontend-compatible shapes.
- Filter/list/get/create/bulk-create/update/delete records.
- Map `User` operations to the `users` table and all other entities to `entity_records`.
- Provide special request search helpers used by MCP/public API/workflows.
- Enforce database migrations from `server/schema.sql`.

## Key Files

- `server/schema.sql` — PostgreSQL schema, indexes, default terms, backup/MCP/API support tables.
- `server/migrate.js` — migration runner.
- `server/database.js` — pool, transactions, advisory locks.
- `server/store.js` — entity abstraction and serialization.
- `server/entity-routes.js` — HTTP access control for entities.
- `shared/subdomain-requests.js` — request bundle/status helpers shared with frontend/server.

## Entity Names

`store.js` allow-lists: `AuditLog`, `SubdomainOwnership`, `SyncLog`, `Domain`, `SubdomainRequest`, `AbuseReport`, `PlatformSettings`, `RequestComment`, `TrustedDevice`, `CleanupMigrationState`, `EmailLog`, `Donation`, `DeviceCode`, `DnsRecord`, `ApiToken`, `BlocklistEntry`, `EditRequest`, `User`, and `SafetyAssessment`.

## Data Model

- `users`, `sessions`, `webauthn_credentials`, `webauthn_challenges`, verification/reset/OAuth tables, terms tables, backup tables, MCP OAuth tables, and other security tables are relational.
- `entity_records` stores typed operational records as JSONB plus creator metadata and timestamps.
- Store filtering supports simple equality, `$in`, `$ne`, and `$exists` over JSONB fields.
- Sort fields are normalized and only safe identifier-like field names are accepted.

## Access Rules

`entity-routes.js` decides who can read/write and redacts fields. Admins get broad access; staff get elevated read access and limited writes; users get their own records; anonymous callers can read domains and selected public settings.

## Dependencies

- **Uses:** PostgreSQL `pg`, JSONB operators, transactions.
- **Used by:** auth, entity API, function handlers, public API, MCP, jobs, module settings, backups.

## Gotchas

- `User` updates are column-aware; unknown user fields are merged into `metadata` unless blocked.
- `store.filter()` can scan up to 10,000 records; very broad user-facing reads are filtered after database query by `entity-routes.js`.
- Some invariants live in function handlers rather than the generic entity layer, especially DNS ownership and request lifecycle checks.
