# Inactive account cleanup

An optional module (Admin → Modules → **Inactive account cleanup**, off by default) that emails accounts nobody uses and closes them if they stay unused.

## Which accounts are affected

An account gets a notice when all of these hold:

- Role is `user` (staff, admins and domain providers are never touched) and status is `active` or `pending`.
- It owns no subdomains or DNS records, and has no open request (`pending`, `needs_info`, `user_responded`), no non-pending donation, no NS unlock or legacy donor flag, and no pending account deletion request.
- Its latest activity is older than **Inactive after (days)** (default 365).

Activity is the latest of: account creation, email verification, `users.last_active_at`, a non-impersonated session being used, a linked Google/GitHub/Discord account or passkey being used, an MCP token being issued, a public API token being used, or any record the user created.

`users.last_active_at` is written (at most every 10 minutes) whenever a fully authenticated request comes in through a browser session, the public API or MCP. Staff impersonation sessions and sessions still waiting for MFA do not count.

## Notice, reminder and closure

The job runs daily at 03:45 UTC.

1. **Notice.** Eligible accounts get an email saying when the account will close (now + **Grace period**, default 30 days). The notice is only recorded after the mail server accepted the email; if email is disabled, nothing is recorded and nobody can be closed.
2. **Reminder.** One reminder goes out **Reminder before closure** days before (default 7, 0 turns it off).
3. **Cancellation.** Any activity after the notice cancels it. Signing in deletes the notice straight away, and every run re-checks open notices, including just before closing an account. Gaining a subdomain, request or donation also cancels it.
4. **Closure.** After the grace period the account is either deleted through the same path as admin deletion (DNS cleanup, tombstone, data removal) or disabled and signed out, depending on **When an account is closed**. The user gets a final email and an `AuditLog` entry is written.

**Notices per daily run** and **Closures per daily run** cap the work per day, so turning the module on with a large backlog ramps up gradually.

## Data

- `users.last_active_at` — durable activity marker (sessions are deleted after they expire).
- `inactive_account_notices` — one row per notified user: `notified_at`, `closes_at`, `reminder_sent_at`, `closed_at` (disable mode only; deleted users cascade).

Existing installs have no `last_active_at` history, so the first runs rely on the other signals. Consider a long inactivity period or a low daily cap when first enabling the module.
