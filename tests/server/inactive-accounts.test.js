import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  inactivityEmail,
  inactivitySettings,
  planNoticeActions,
  recordUserActivity,
  runInactiveAccountCleanup,
} from '../../server/lib/inactive-accounts.js';
import { MODULE_DEFINITIONS } from '../../server/core/module-settings.js';

const DAY = 86_400_000;
const NOW = new Date('2026-11-23T03:45:00Z');
const SETTINGS = inactivitySettings({ enabled: true, inactivity_days: 365, grace_days: 30, reminder_days: 7, closure_action: 'delete', max_notices_per_run: 100, max_closures_per_run: 50 });
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString();
const ahead = (days) => new Date(NOW.getTime() + days * DAY).toISOString();
const notice = (overrides = {}) => ({
  user_id: 'u1', user_email: 'idle@example.test', current_email: 'idle@example.test', full_name: 'Idle',
  eligible: true, notified_at: ago(10), closes_at: ahead(20), reminder_sent_at: null, last_activity_at: ago(400),
  ...overrides,
});

// A fake pg client that answers by matching SQL fragments and records every call.
function fakeDb({ notices = [], candidates = [] } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes('ORDER BY last_activity_at ASC')) return { rows: candidates };
      if (sql.includes('FROM inactive_account_notices n')) return { rows: notices };
      return { rows: [], rowCount: 1 };
    },
  };
}
const run = (overrides = {}) => runInactiveAccountCleanup({
  db: fakeDb(), settings: SETTINGS, sendEmail: async () => ({ accepted: ['x'] }),
  deleteAccounts: async () => ({ users: 1 }), appUrl: 'https://open-domains.test', now: NOW, ...overrides,
});

test('settings are clamped to safe ranges and default to deletion', () => {
  const settings = inactivitySettings({ enabled: true, inactivity_days: 1, grace_days: 1, reminder_days: 99, closure_action: 'nuke', max_notices_per_run: 0 });
  assert.equal(settings.inactivity_days, 30);
  assert.equal(settings.grace_days, 7);
  assert.equal(settings.reminder_days, 30);
  assert.equal(settings.closure_action, 'delete');
  assert.equal(settings.max_notices_per_run, 1);
  assert.equal(inactivitySettings({ closure_action: 'disable' }).closure_action, 'disable');
  assert.equal(inactivitySettings({}).enabled, false);
});

test('the module is off by default and exposes the configurable periods', () => {
  const definition = MODULE_DEFINITIONS.inactive_accounts;
  assert.equal(definition.defaultEnabled, false);
  assert.equal(definition.env().enabled, false);
  const keys = definition.fields.map((field) => field.key);
  for (const key of ['inactivity_days', 'grace_days', 'reminder_days', 'closure_action']) assert.ok(keys.includes(key), key);
  assert.equal(definition.env().grace_days, 30);
});

test('any activity after the notice cancels closure, even once it is due', () => {
  const plan = planNoticeActions([notice({ closes_at: ago(1), last_activity_at: ago(2) })], SETTINGS, NOW);
  assert.equal(plan.cancel.length, 1);
  assert.equal(plan.close.length, 0);
});

test('accounts that gain a domain or stop being eligible are cancelled', () => {
  const plan = planNoticeActions([notice({ eligible: false, closes_at: ago(1), last_activity_at: null })], SETTINGS, NOW);
  assert.deepEqual(plan.cancel.map((item) => item.user_id), ['u1']);
});

test('due notices close, capped per run', () => {
  const due = [1, 2, 3].map((index) => notice({ user_id: `u${index}`, notified_at: ago(31), closes_at: ago(1) }));
  const plan = planNoticeActions(due, { ...SETTINGS, max_closures_per_run: 2 }, NOW);
  assert.deepEqual(plan.close.map((item) => item.user_id), ['u1', 'u2']);
});

test('one reminder goes out inside the reminder window only', () => {
  assert.equal(planNoticeActions([notice({ closes_at: ahead(10) })], SETTINGS, NOW).remind.length, 0);
  assert.equal(planNoticeActions([notice({ closes_at: ahead(6) })], SETTINGS, NOW).remind.length, 1);
  assert.equal(planNoticeActions([notice({ closes_at: ahead(6), reminder_sent_at: ago(1) })], SETTINGS, NOW).remind.length, 0);
  assert.equal(planNoticeActions([notice({ closes_at: ahead(6) })], { ...SETTINGS, reminder_days: 0 }, NOW).remind.length, 0);
  // A grace period shorter than the reminder window does not send a reminder the same day as the notice.
  assert.equal(planNoticeActions([notice({ notified_at: ago(0.1), closes_at: ahead(6) })], SETTINGS, NOW).remind.length, 0);
});

test('a disabled module does nothing', async () => {
  const db = fakeDb();
  const summary = await run({ db, settings: { ...SETTINGS, enabled: false } });
  assert.equal(summary.skipped, true);
  assert.equal(db.calls.length, 0);
});

test('a notice is recorded only after the email was handed to the mail server', async () => {
  const candidate = { id: 'u9', email: 'idle@example.test', full_name: 'Idle', last_activity_at: ago(400) };
  const disabledDb = fakeDb({ candidates: [candidate] });
  const disabled = await run({ db: disabledDb, sendEmail: async () => ({ disabled: true }) });
  assert.equal(disabled.notified, 0);
  assert.equal(disabled.email_disabled, true);
  assert.ok(!disabledDb.calls.some((call) => call.sql.includes('INSERT INTO inactive_account_notices')));

  const failingDb = fakeDb({ candidates: [candidate] });
  const failed = await run({ db: failingDb, sendEmail: async () => { throw new Error('smtp down'); } });
  assert.equal(failed.failed, 1);
  assert.ok(!failingDb.calls.some((call) => call.sql.includes('INSERT INTO inactive_account_notices')));

  const db = fakeDb({ candidates: [candidate] });
  const sent = [];
  const summary = await run({ db, sendEmail: async (message) => { sent.push(message); return {}; } });
  assert.equal(summary.notified, 1);
  assert.equal(sent[0].to, 'idle@example.test');
  const insert = db.calls.find((call) => call.sql.includes('INSERT INTO inactive_account_notices'));
  assert.equal(insert.values[0], 'u9');
  assert.equal(new Date(insert.values[3]).getTime(), NOW.getTime() + 30 * DAY);
});

test('due accounts are deleted through the shared account deletion path', async () => {
  const deleted = [];
  const sent = [];
  const db = fakeDb({ notices: [notice({ notified_at: ago(31), closes_at: ago(1) })] });
  const summary = await run({
    db,
    deleteAccounts: async (ids, actor) => { deleted.push({ ids, actor: actor.email }); return { users: 1 }; },
    sendEmail: async (message) => { sent.push(message.subject); return {}; },
  });
  assert.equal(summary.closed, 1);
  assert.deepEqual(deleted, [{ ids: ['u1'], actor: 'inactive-accounts@rootminster.local' }]);
  assert.match(sent[0], /has been closed/);
});

test('closure is skipped when the user became active just before it', async () => {
  let loads = 0;
  const db = {
    calls: [],
    async query(sql, values) {
      this.calls.push({ sql, values });
      if (sql.includes('FROM inactive_account_notices n')) {
        loads += 1;
        return { rows: [notice({ notified_at: ago(31), closes_at: ago(1), last_activity_at: loads > 1 ? ago(0) : ago(400) })] };
      }
      return { rows: [] };
    },
  };
  let deleted = false;
  const summary = await run({ db, deleteAccounts: async () => { deleted = true; } });
  assert.equal(deleted, false);
  assert.equal(summary.closed, 0);
  assert.equal(summary.cancelled, 1);
});

test('disable mode keeps the account but signs it out', async () => {
  const db = fakeDb({ notices: [notice({ notified_at: ago(31), closes_at: ago(1) })] });
  const summary = await run({ db, settings: { ...SETTINGS, closure_action: 'disable' }, deleteAccounts: async () => { throw new Error('must not delete'); } });
  assert.equal(summary.closed, 1);
  assert.ok(db.calls.some((call) => call.sql.includes("status = 'disabled'")));
  assert.ok(db.calls.some((call) => call.sql.includes('DELETE FROM sessions')));
});

test('recording activity is throttled and cancels an open notice', async () => {
  const db = fakeDb();
  await recordUserActivity(db, 'u1');
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /last_active_at < now\(\) - interval/);
  assert.match(db.calls[0].sql, /DELETE FROM inactive_account_notices/);
  await recordUserActivity(db, null);
  assert.equal(db.calls.length, 1);
});

test('emails escape names and explain how to keep the account', () => {
  const email = inactivityEmail('notice', { user: { full_name: '<b>Eve</b>' }, appUrl: 'https://open-domains.test', closesAt: ahead(30), lastActivityAt: ago(400) });
  assert.ok(!email.body.includes('<b>Eve</b>'));
  assert.match(email.body, /https:\/\/open-domains\.test\/login/);
  assert.match(email.body, /Discord/);
});

test('inactivity emails carry a plain-text part with the sign-in link, a preheader and a footer', () => {
  const email = inactivityEmail('notice', { user: { full_name: 'Sam' }, appUrl: 'https://open-domains.test', closesAt: '2026-12-27T03:45:00Z', lastActivityAt: '2025-11-02T00:00:00Z' });
  assert.match(email.text, /^Hi Sam,\n\n/);
  assert.match(email.text, /Sign in to keep your account: https:\/\/open-domains\.test\/login/);
  assert.match(email.text, /27 December 2026/);
  assert.ok(!/<[a-z]/i.test(email.text));
  assert.match(email.preheader, /27 December 2026/);
  assert.match(email.footer, /registered to this email address/);
  assert.match(email.body, /<strong>27 December 2026<\/strong>/);
  const closed = inactivityEmail('closed', { user: {}, appUrl: 'https://open-domains.test', closureAction: 'disable' });
  assert.match(closed.text, /^Hi there,/);
  assert.ok(!/deleted/.test(closed.text));
});

test('impersonated and MFA-pending sessions are not counted as activity', async () => {
  const auth = await readFile(new URL('../../server/routes/auth.js', import.meta.url), 'utf8');
  assert.match(auth, /if \(mfaVerified && !row\._impersonator_user_id\) recordUserActivity\(pool, row\.id\)/);
  const { LAST_ACTIVITY_SQL } = await import('../../server/lib/inactive-accounts.js');
  assert.match(LAST_ACTIVITY_SQL, /s\.impersonator_user_id IS NULL/);
});

test('schema adds the activity column and notice table', async () => {
  const schema = await readFile(new URL('../../server/schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamptz/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inactive_account_notices/);
});

test('due times are rounded up to the next daily job run at 03:45 UTC', async () => {
  const { nextJobRunAt } = await import('../../server/lib/inactive-accounts.js');
  assert.equal(nextJobRunAt('2026-11-23T03:00:00Z').toISOString(), '2026-11-23T03:45:00.000Z');
  assert.equal(nextJobRunAt('2026-11-23T03:45:00Z').toISOString(), '2026-11-23T03:45:00.000Z');
  assert.equal(nextJobRunAt('2026-11-23T10:00:00Z').toISOString(), '2026-11-24T03:45:00.000Z');
});

test('the notified accounts list shows when the reminder and closure happen', async () => {
  const { describeNotice } = await import('../../server/lib/inactive-accounts.js');
  const future = (days) => new Date(Date.now() + days * DAY).toISOString();
  const row = { user_id: 'u1', user_email: 'idle@example.test', full_name: 'Idle', notified_at: new Date().toISOString(), closes_at: future(30), reminder_sent_at: null, closed_at: null };
  const view = describeNotice(row, SETTINGS);
  assert.equal(view.status, 'notified');
  assert.equal(view.reminder_due_at.getTime(), new Date(row.closes_at).getTime() - 7 * DAY);
  assert.ok(view.reminder_expected_at >= view.reminder_due_at);
  assert.ok(view.closure_expected_at.getTime() >= new Date(row.closes_at).getTime());
  assert.ok(view.closure_expected_at.getTime() - new Date(row.closes_at).getTime() < DAY);

  const reminded = describeNotice({ ...row, reminder_sent_at: new Date().toISOString() }, SETTINGS);
  assert.equal(reminded.status, 'reminded');
  assert.equal(reminded.reminder_expected_at, null);
  assert.equal(describeNotice(row, { ...SETTINGS, reminder_days: 0 }).reminder_expected_at, null);

  const closed = describeNotice({ ...row, closed_at: new Date().toISOString() }, SETTINGS);
  assert.equal(closed.status, 'closed');
  assert.equal(closed.closure_expected_at, null);

  // An overdue notice (module was off) is expected on the next run, not in the past.
  const overdue = describeNotice({ ...row, notified_at: future(-40), closes_at: future(-10) }, SETTINGS);
  assert.ok(overdue.closure_expected_at.getTime() >= Date.now());
});

test('only admins can list notified accounts', async () => {
  const source = await readFile(new URL('../../server/core/module-settings.js', import.meta.url), 'utf8');
  const route = source.slice(source.indexOf("app.get('/api/admin/modules/inactive_accounts/notices'"));
  assert.ok(route.length > 0);
  assert.match(route.slice(0, 400), /actor\.role !== 'admin'\) return reply\.code\(403\)/);
});
