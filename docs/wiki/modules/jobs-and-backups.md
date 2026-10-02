# Module: Jobs and Backups

Rootminster runs scheduled maintenance in a separate Node process using `server/jobs.js`. Backups are implemented in `server/backup-service.js` and configured through the Cloudflare R2 Backup module.

## Responsibilities

- Schedule routine cleanup, DNS sync, DNS verification, Discord stats, and R2 backup checks.
- Invoke internal function handlers as `system@rootminster.local`.
- Use PostgreSQL advisory locks to avoid duplicate job execution.
- Delete expired sessions, email verifications, password resets, OAuth states, and design auth records.
- Create encrypted PostgreSQL backups, upload them to R2, verify, restore, and audit outcomes.
- Enforce R2 free-tier safety budgets for storage and operation counts.

## Key Files

- `server/jobs.js` — cron schedule and job runner process.
- `server/database.js` — advisory lock helper.
- `server/backup-service.js` — backup, restore, verification, capacity, retention, audit, and notification logic.
- `server/backup-crypto.js` — backup encryption/decryption/checksum helpers.
- `server/backup-routes.js` — admin backup HTTP routes.
- `server/r2.js` — R2 client wrapper and limits.
- `server/functions/cleanupPendingDonations.js` — donation cleanup.
- `server/functions/cleanupSuspendedRecords.js` — DNS ownership cleanup.
- `server/functions/scheduledSync.js` — periodic Cloudflare sync.
- `server/functions/verifyDnsRecords.js` — DNS record verification.
- `server/functions/weeklyStatsDiscord.js` — Discord weekly stats.

## Schedule

- `15 3 * * *` UTC — `cleanupPendingDonations`.
- `30 3 * * *` UTC — `cleanupSuspendedRecords`.
- `0 2 */6 * *` UTC — `scheduledSync`.
- `0 3 1 */2 *` UTC — `verifyDnsRecords`.
- `0 4,12,20 * * *` UTC — `observerScanAll`, scanning 20 Observer targets per run / 60 per day.
- `0 23 * * 0` UTC — `weeklyStatsDiscord`.
- `*/15 * * * *` UTC — check whether a scheduled R2 backup should run.
- `0 4 * * *` UTC — purge expired auth/session helper rows.
- Startup — fire-and-forget `cleanupSuspendedRecords`.

## Backup Flow

`createBackup()` obtains advisory lock `rootminster:backup-operation`, runs `pg_dump --format=custom --compress=6 --no-owner --no-acl`, encrypts the dump, calculates SHA-256, prepares R2 capacity/retention, uploads with metadata, updates `backup_runs`, and writes an audit record.

Restore mode sets a global restore-in-progress flag used by `server/index.js` to return 503 for non-health requests. Restore first creates a safety backup, validates/decrypts the selected archive, restores in a transaction, revokes active sessions/access grants, and audits.

## Dependencies

- **Uses:** node-cron, PostgreSQL, `pg_dump`, `pg_restore`, R2 module settings, backup encryption key, SMTP notifications.
- **Used by:** Docker `jobs` service and admin backup UI/routes.

## Gotchas

- The job runner intentionally has no HTTP server. In some Docker deployments it may inherit an app HTTP healthcheck and look unhealthy even while logs show `Rootminster job runner started.`
- Backups require both R2 module settings and backup encryption configuration.
- R2 operation/storage counters cover Rootminster activity only; use a dedicated bucket/credentials as the README recommends.
