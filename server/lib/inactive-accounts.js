// Inactive account cleanup: find ordinary user accounts that have no domains and
// no activity for a configurable period, email them a notice, then close the
// account once a grace period passes without any new activity.
//
// "Activity" is any sign that the person still uses the account: a fully
// authenticated browser session (password, passkey, Google, GitHub or Discord
// sign-in all end in one), a linked social account or passkey being used, an
// MCP or public API token being used, or anything they created. Impersonation
// sessions started by staff never count.
//
// Notices live in inactive_account_notices. Any activity after a notice was sent
// cancels it: recordUserActivity() deletes the open notice as soon as the person
// signs in, and every run re-checks open notices before closing anything.
import { OPEN_REQUEST_STATUSES } from '../../shared/subdomain-requests.js';
import { escapeHtml } from './html.js';

export const INACTIVE_ACCOUNT_ACTOR = Object.freeze({
  id: null,
  email: 'inactive-accounts@rootminster.local',
  role: 'system',
  full_name: 'Inactive account cleanup',
});

export const INACTIVE_ACCOUNT_DEFAULTS = Object.freeze({
  inactivity_days: 365,
  grace_days: 30,
  reminder_days: 7,
  closure_action: 'delete',
  max_notices_per_run: 100,
  max_closures_per_run: 50,
});

const DAY_MS = 86_400_000;
// Avoid a users-table write on every authenticated request.
const ACTIVITY_WRITE_INTERVAL = '10 minutes';
// A reminder only goes out once the first notice is at least this old.
const MIN_REMINDER_GAP_MS = DAY_MS;

function clampInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(number, max));
}

export function inactivitySettings(settings = {}) {
  return {
    enabled: Boolean(settings.enabled),
    inactivity_days: clampInt(settings.inactivity_days, INACTIVE_ACCOUNT_DEFAULTS.inactivity_days, 30, 3650),
    grace_days: clampInt(settings.grace_days, INACTIVE_ACCOUNT_DEFAULTS.grace_days, 7, 365),
    reminder_days: clampInt(settings.reminder_days, INACTIVE_ACCOUNT_DEFAULTS.reminder_days, 0, 30),
    closure_action: settings.closure_action === 'disable' ? 'disable' : 'delete',
    max_notices_per_run: clampInt(settings.max_notices_per_run, INACTIVE_ACCOUNT_DEFAULTS.max_notices_per_run, 1, 1000),
    max_closures_per_run: clampInt(settings.max_closures_per_run, INACTIVE_ACCOUNT_DEFAULTS.max_closures_per_run, 1, 1000),
  };
}

// Record that a user was active. Throttled, and in the same statement cancels
// any open inactivity notice so a sign-in during the grace period stops closure.
export async function recordUserActivity(db, userId) {
  if (!userId) return;
  await db.query(
    `WITH touched AS (
       UPDATE users SET last_active_at = now()
       WHERE id = $1 AND (last_active_at IS NULL OR last_active_at < now() - interval '${ACTIVITY_WRITE_INTERVAL}')
       RETURNING id
     )
     DELETE FROM inactive_account_notices
     WHERE closed_at IS NULL AND user_id IN (SELECT id FROM touched)`,
    [userId],
  );
}

// Latest activity for the users row aliased `u`. GREATEST ignores NULLs.
export const LAST_ACTIVITY_SQL = `GREATEST(
  u.created_at,
  u.email_verified_at,
  u.last_active_at,
  (SELECT max(s.last_used_at) FROM sessions s WHERE s.user_id = u.id AND s.impersonator_user_id IS NULL),
  (SELECT max(i.last_used_at) FROM user_identities i WHERE i.user_id = u.id),
  (SELECT max(w.last_used_at) FROM webauthn_credentials w WHERE w.user_id = u.id),
  (SELECT max(t.created_at) FROM mcp_oauth_tokens t WHERE t.user_id = u.id),
  (SELECT max(e.created_at) FROM entity_records e WHERE e.created_by_id = u.id),
  (SELECT max(CASE WHEN e.data->>'last_used' ~ '^\\d{4}-\\d{2}-\\d{2}T' THEN (e.data->>'last_used')::timestamptz END)
     FROM entity_records e
     WHERE e.entity_type = 'ApiToken' AND e.data @> jsonb_build_object('user_id', u.id::text))
)`;

// Users that may be closed for inactivity at all, ignoring how long they have
// been inactive: ordinary active or unverified accounts with no domains, DNS
// records, open requests, donations or pending deletion request. `$1` is the
// array of open request statuses; `extraFilter` narrows the users scanned.
function eligibleUsersSql(extraFilter) {
  return `
    WITH blocked AS MATERIALIZED (
      SELECT data->>'owner_id' AS user_id, lower(data->>'owner_email') AS email
      FROM entity_records WHERE entity_type IN ('DnsRecord', 'SubdomainOwnership')
      UNION ALL
      SELECT data->>'requester_id', lower(data->>'requester_email')
      FROM entity_records
      WHERE entity_type IN ('SubdomainRequest', 'EditRequest') AND coalesce(data->>'status', 'pending') = ANY($1::text[])
      UNION ALL
      SELECT data->>'user_id', lower(coalesce(data->>'user_email', data->>'email'))
      FROM entity_records WHERE entity_type = 'Donation' AND coalesce(data->>'status', '') <> 'pending'
      UNION ALL
      SELECT user_id::text, lower(user_email::text)
      FROM account_deletion_requests WHERE status = 'pending'
    ), eligible AS MATERIALIZED (
      SELECT u.*
      FROM users u
      WHERE u.role = 'user'
        AND u.status IN ('active', 'pending')
        AND NOT u.legacy_donor
        AND NOT u.ns_unlocked
        AND (${extraFilter})
        AND NOT EXISTS (SELECT 1 FROM blocked b WHERE b.user_id = u.id::text)
        AND NOT EXISTS (SELECT 1 FROM blocked b WHERE b.email = lower(u.email::text))
    )`;
}

export async function findInactiveCandidates(db, { inactivityDays, limit, now = new Date() }) {
  const cutoff = new Date(new Date(now).getTime() - inactivityDays * DAY_MS);
  const result = await db.query(
    `${eligibleUsersSql(`u.created_at < $2 AND coalesce(u.last_active_at, u.created_at) < $2
        AND NOT EXISTS (SELECT 1 FROM inactive_account_notices n WHERE n.user_id = u.id)`)}
     SELECT * FROM (
       SELECT u.id, u.email, u.full_name, ${LAST_ACTIVITY_SQL} AS last_activity_at
       FROM eligible u
     ) candidates
     WHERE last_activity_at < $2
     ORDER BY last_activity_at ASC
     LIMIT $3`,
    [OPEN_REQUEST_STATUSES, cutoff, limit],
  );
  return result.rows;
}

// Open notices, each with whether the account is still eligible and its latest activity.
export async function loadOpenNotices(db) {
  const result = await db.query(
    `${eligibleUsersSql('u.id IN (SELECT user_id FROM inactive_account_notices WHERE closed_at IS NULL)')}
     SELECT n.user_id, n.user_email, n.notified_at, n.closes_at, n.reminder_sent_at,
            u.id IS NOT NULL AS eligible, u.full_name, u.email AS current_email,
            CASE WHEN u.id IS NULL THEN NULL ELSE ${LAST_ACTIVITY_SQL} END AS last_activity_at
     FROM inactive_account_notices n
     LEFT JOIN eligible u ON u.id = n.user_id
     WHERE n.closed_at IS NULL
     ORDER BY n.closes_at ASC`,
    [OPEN_REQUEST_STATUSES],
  );
  return result.rows;
}

const time = (value) => (value ? new Date(value).getTime() : NaN);

// Pure decision for open notices. Returns the notices to cancel, remind and close.
export function planNoticeActions(notices, settings, now = new Date()) {
  const nowMs = new Date(now).getTime();
  const plan = { cancel: [], remind: [], close: [] };
  for (const notice of notices) {
    const notifiedMs = time(notice.notified_at);
    const activityMs = time(notice.last_activity_at);
    if (!notice.eligible || (Number.isFinite(activityMs) && activityMs > notifiedMs)) {
      plan.cancel.push(notice);
      continue;
    }
    const closesMs = time(notice.closes_at);
    if (closesMs <= nowMs) {
      if (plan.close.length < settings.max_closures_per_run) plan.close.push(notice);
      continue;
    }
    const reminderDue = notice.reminder_sent_at ? null : reminderDueAt(notice, settings);
    if (reminderDue && nowMs >= reminderDue.getTime()) plan.remind.push(notice);
  }
  return plan;
}

// The job runs daily at this UTC time (see server/jobs.js).
export const JOB_RUN_UTC = Object.freeze({ hour: 3, minute: 45 });

// First scheduled job run at or after `value`: when something due then actually happens.
export function nextJobRunAt(value) {
  const due = new Date(value);
  const run = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), JOB_RUN_UTC.hour, JOB_RUN_UTC.minute));
  if (run < due) run.setUTCDate(run.getUTCDate() + 1);
  return run;
}

// When the reminder becomes due under the current settings, or null if none will be sent.
export function reminderDueAt(notice, settings) {
  if (settings.reminder_days <= 0) return null;
  const closesMs = time(notice.closes_at);
  const dueMs = Math.max(closesMs - settings.reminder_days * DAY_MS, time(notice.notified_at) + MIN_REMINDER_GAP_MS);
  return dueMs < closesMs ? new Date(dueMs) : null;
}

// Admin view of every notified account, with when its reminder and closure happen.
export function describeNotice(row, rawSettings) {
  const settings = inactivitySettings(rawSettings);
  const closed = Boolean(row.closed_at);
  const reminderDue = row.reminder_sent_at || closed ? null : reminderDueAt(row, settings);
  let status = 'notified';
  if (closed) status = 'closed';
  else if (row.reminder_sent_at) status = 'reminded';
  return {
    user_id: row.user_id,
    email: row.current_email || row.user_email,
    full_name: row.full_name || null,
    status,
    last_activity_at: row.last_activity_at || null,
    notified_at: row.notified_at,
    reminder_sent_at: row.reminder_sent_at || null,
    reminder_due_at: reminderDue,
    reminder_expected_at: reminderDue ? nextJobRunAt(Math.max(reminderDue.getTime(), Date.now())) : null,
    closes_at: row.closes_at,
    closure_expected_at: closed ? null : nextJobRunAt(Math.max(time(row.closes_at), Date.now())),
    closed_at: row.closed_at || null,
  };
}

export async function listInactiveAccountNotices(db, settings) {
  const result = await db.query(
    `SELECT n.user_id, n.user_email, n.last_activity_at, n.notified_at, n.closes_at, n.reminder_sent_at, n.closed_at,
            u.email AS current_email, u.full_name
     FROM inactive_account_notices n
     LEFT JOIN users u ON u.id = n.user_id
     ORDER BY n.closed_at IS NOT NULL, n.closes_at ASC
     LIMIT 1000`,
  );
  return result.rows.map((row) => describeNotice(row, settings));
}


function formatDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Every message carries its own plain-text version with the sign-in link
// written out, a preheader, and a footer that says why the person got it.
export function inactivityEmail(kind, { user, platformName = 'Open Domains', appUrl, closesAt, lastActivityAt, closureAction = 'delete' }) {
  const rawName = String(user.full_name || '').trim() || 'there';
  const name = escapeHtml(rawName);
  const platform = escapeHtml(platformName);
  const loginUrl = `${appUrl}/login`;
  const safeLoginUrl = escapeHtml(loginUrl);
  const outcome = closureAction === 'disable' ? 'closed' : 'closed and its data permanently deleted';
  const footer = `You are receiving this because an account at ${platform} is registered to this email address. This is a one-off service notice about that account, not a marketing email.`;
  if (kind === 'notice' || kind === 'reminder') {
    const closes = formatDate(closesAt);
    const leadText = kind === 'reminder'
      ? `This is a reminder that your ${platformName} account will be ${outcome} on ${closes} because it has been inactive.`
      : `Your ${platformName} account has had no activity since ${formatDate(lastActivityAt)} and has no subdomains, so it is scheduled to be ${outcome} on ${closes}.`;
    const leadHtml = escapeHtml(leadText).replace(escapeHtml(closes), `<strong>${escapeHtml(closes)}</strong>`);
    const keep = 'If you want to keep it, just sign in before then and nothing else is needed.';
    const how = 'Signing in any way you normally do keeps your account: email and password, a passkey, or a linked Google, GitHub or Discord account.';
    const nothing = 'If you no longer need the account, you do not have to do anything.';
    return {
      subject: kind === 'reminder' ? `Reminder: your ${platformName} account closes soon` : `Your ${platformName} account will be closed for inactivity`,
      preheader: `Sign in before ${closes} to keep your account.`,
      footer,
      body: `<p style="margin:0 0 16px">Hi ${name},</p>`
        + `<p style="margin:0 0 16px">${leadHtml}</p>`
        + `<p style="margin:0 0 16px">${escapeHtml(keep)}</p>`
        + `<p style="margin:0 0 16px"><a href="${safeLoginUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#6d5dfc;color:#ffffff;text-decoration:none;font-weight:600">Sign in to keep my account</a></p>`
        + `<p style="margin:0 0 16px">${escapeHtml(how)}</p>`
        + `<p style="margin:0 0 16px">${escapeHtml(nothing)}</p>`
        + `<p style="margin:0;font-size:13px;color:#6b7280">If the button does not work, copy this link into your browser:<br><a href="${safeLoginUrl}" style="color:#6d5dfc">${safeLoginUrl}</a></p>`,
      text: `Hi ${rawName},\n\n${leadText}\n\n${keep}\n\nSign in to keep your account: ${loginUrl}\n\n${how}\n\n${nothing}`,
    };
  }
  const closedText = `Your ${platformName} account has been ${outcome} because it stayed inactive after our earlier notice.`;
  const again = 'You are welcome to create a new account at any time. If you think this was a mistake, please contact support.';
  return {
    subject: `Your ${platformName} account has been closed`,
    preheader: 'Your account was closed after a period of inactivity.',
    footer,
    body: `<p style="margin:0 0 16px">Hi ${name},</p><p style="margin:0 0 16px">${escapeHtml(closedText)}</p><p style="margin:0">${escapeHtml(again)}</p>`,
    text: `Hi ${rawName},\n\n${closedText}\n\n${again}`,
  };
}

async function auditLog(store, action, notice, description) {
  if (!store) return;
  await store.create('AuditLog', {
    actor_id: null,
    actor_email: INACTIVE_ACCOUNT_ACTOR.email,
    actor_role: INACTIVE_ACCOUNT_ACTOR.role,
    action,
    entity_type: 'User',
    entity_id: notice.user_id || notice.id,
    description,
  }, INACTIVE_ACCOUNT_ACTOR).catch((error) => console.error('[inactive-accounts] audit log failed', error));
}

export async function disableInactiveAccount(db, userId) {
  await db.query(
    `UPDATE users SET status = 'disabled', updated_at = now(),
       metadata = metadata || jsonb_build_object('closed_for_inactivity_at', now())
     WHERE id = $1`,
    [userId],
  );
  await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

// One cleanup pass. Dependencies are injected so the job is testable without a database.
export async function runInactiveAccountCleanup({
  db,
  settings: rawSettings,
  sendEmail,
  deleteAccounts,
  store = null,
  appUrl,
  platformName = 'Open Domains',
  now = new Date(),
}) {
  const settings = inactivitySettings(rawSettings);
  const summary = { notified: 0, reminded: 0, cancelled: 0, closed: 0, failed: 0 };
  if (!settings.enabled) return { skipped: true, reason: 'disabled', ...summary };
  const nowMs = new Date(now).getTime();
  const mail = (kind, notice, extra = {}) => {
    const message = inactivityEmail(kind, {
      user: { full_name: notice.full_name }, platformName, appUrl, closureAction: settings.closure_action, ...extra,
    });
    return sendEmail({ to: notice.current_email || notice.user_email || notice.email, ...message });
  };

  // 1. Re-check open notices first, so cancellations win over closures.
  const plan = planNoticeActions(await loadOpenNotices(db), settings, now);
  for (const notice of plan.cancel) {
    await db.query('DELETE FROM inactive_account_notices WHERE user_id = $1 AND closed_at IS NULL', [notice.user_id]);
    summary.cancelled += 1;
  }

  for (const notice of plan.close) {
    try {
      // Closing must not race a sign-in: re-check activity just before acting.
      const [fresh] = (await loadOpenNotices(db)).filter((row) => row.user_id === notice.user_id);
      if (!fresh || planNoticeActions([fresh], settings, now).close.length !== 1) {
        await db.query('DELETE FROM inactive_account_notices WHERE user_id = $1 AND closed_at IS NULL', [notice.user_id]);
        summary.cancelled += 1;
        continue;
      }
      if (settings.closure_action === 'disable') {
        await disableInactiveAccount(db, notice.user_id);
        await db.query('UPDATE inactive_account_notices SET closed_at = now() WHERE user_id = $1', [notice.user_id]);
      } else {
        // Deleting the user cascades to the notice row.
        await deleteAccounts([notice.user_id], INACTIVE_ACCOUNT_ACTOR);
      }
      summary.closed += 1;
      await auditLog(store, 'inactive_account_closed', notice, `Closed (${settings.closure_action}) after ${settings.grace_days} day inactivity notice sent ${new Date(notice.notified_at).toISOString()}.`);
      await mail('closed', fresh).catch((error) => console.error('[inactive-accounts] closure email failed', error));
    } catch (error) {
      summary.failed += 1;
      console.error(`[inactive-accounts] could not close ${notice.user_id}`, error);
    }
  }

  for (const notice of plan.remind) {
    try {
      const delivery = await mail('reminder', notice, { closesAt: notice.closes_at });
      if (delivery?.disabled) break;
      await db.query('UPDATE inactive_account_notices SET reminder_sent_at = now() WHERE user_id = $1', [notice.user_id]);
      summary.reminded += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[inactive-accounts] reminder to ${notice.user_id} failed`, error);
    }
  }

  // 2. Notify newly inactive accounts. A notice is only recorded once the email was
  // handed to the mail server, so nobody is closed without being told first.
  const candidates = await findInactiveCandidates(db, { inactivityDays: settings.inactivity_days, limit: settings.max_notices_per_run, now });
  const closesAt = new Date(nowMs + settings.grace_days * DAY_MS);
  for (const candidate of candidates) {
    try {
      const delivery = await mail('notice', candidate, { closesAt, lastActivityAt: candidate.last_activity_at });
      if (delivery?.disabled) {
        summary.email_disabled = true;
        break;
      }
      await db.query(
        `INSERT INTO inactive_account_notices(user_id, user_email, last_activity_at, notified_at, closes_at)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (user_id) DO NOTHING`,
        [candidate.id, candidate.email, candidate.last_activity_at, closesAt],
      );
      summary.notified += 1;
      await auditLog(store, 'inactive_account_notified', candidate, `Inactivity notice sent; account closes on ${closesAt.toISOString()} unless the user is active again.`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[inactive-accounts] notice to ${candidate.id} failed`, error);
    }
  }

  return summary;
}
