import cron from 'node-cron';
import { pool, withAdvisoryLock } from './database.js';
import { invokeInternal } from './function-runner.js';
import { runScheduledBackup } from './backup-service.js';
import { purgeApprovedAccountDeletionRequests } from './lib/account-deletion-retention.js';
import { config } from './config.js';
import { sendEmail } from './mail.js';
import { getModuleConfig } from './module-settings.js';
import { store } from './store.js';
import { deleteUserAccounts } from './lib/admin-user-deletion.js';
import { runInactiveAccountCleanup } from './lib/inactive-accounts.js';
import { cleanupExpiredAcmeChallenges } from './lib/acme-challenges.js';

const systemActor = { id: null, email: 'system@rootminster.local', role: 'admin', full_name: 'Rootminster Jobs' };

async function run(name, body = {}) {
  return withAdvisoryLock(`rootminster:${name}`, async () => {
    try {
      await invokeInternal(name, body, systemActor);
      console.log(`[jobs] ${name} completed`);
    } catch (error) {
      console.error(`[jobs] ${name} failed`, error);
    }
  });
}

cron.schedule('15 3 * * *', () => run('cleanupPendingDonations'), { timezone: 'UTC' });
// Ownership integrity is important application state, not just UI state. Reconcile every day
// rather than waiting a week, and also run once when the job process starts below.
cron.schedule('30 3 * * *', () => run('cleanupSuspendedRecords'), { timezone: 'UTC' });
cron.schedule('0 2 */6 * *', () => run('scheduledSync'), { timezone: 'UTC' });
cron.schedule('0 3 1 */2 *', () => run('verifyDnsRecords'), { timezone: 'UTC' });
cron.schedule('0 4,12,20 * * *', () => run('observerScanAll'), { timezone: 'UTC' });
// Re-scan instantly approved subdomains during their monitoring period.
cron.schedule('*/5 * * * *', () => run('instantApprovalRecheck'), { timezone: 'UTC' });
cron.schedule('0 23 * * 0', () => run('weeklyStatsDiscord'), { timezone: 'UTC' });
// ACME DNS-01 challenge TXT records live for at most a day.
cron.schedule('20 * * * *', () => withAdvisoryLock('rootminster:acmeChallengeCleanup', async () => {
  try {
    const summary = await cleanupExpiredAcmeChallenges({
      store,
      deleteRecord: (record) => invokeInternal('manageDnsRecord', { action: 'delete', record_id: record.id }, systemActor),
    });
    if (summary.deleted || summary.failed) console.log('[jobs] ACME challenge cleanup', summary);
  } catch (error) {
    console.error('[jobs] ACME challenge cleanup failed', error);
  }
}), { timezone: 'UTC' });
// Notify inactive accounts with no domains, and close them after the grace period.
cron.schedule('45 3 * * *', () => withAdvisoryLock('rootminster:inactiveAccountCleanup', async () => {
  try {
    const settings = await getModuleConfig('inactive_accounts', { fresh: true });
    if (!settings.enabled) return;
    const branding = await getModuleConfig('branding').catch(() => ({}));
    const summary = await runInactiveAccountCleanup({
      db: pool,
      settings,
      sendEmail,
      deleteAccounts: deleteUserAccounts,
      store,
      appUrl: config.appUrl,
      platformName: branding.enabled && branding.platform_name ? branding.platform_name : 'Open Domains',
    });
    console.log('[jobs] inactive account cleanup completed', summary);
  } catch (error) {
    console.error('[jobs] inactive account cleanup failed', error);
  }
}), { timezone: 'UTC' });
cron.schedule('*/15 * * * *', async () => {
  try {
    const result = await runScheduledBackup();
    if (!result?.skipped) console.log('[jobs] scheduled Cloudflare R2 backup completed');
  } catch (error) {
    console.error('[jobs] scheduled Cloudflare R2 backup failed', error);
  }
}, { timezone: 'UTC' });
cron.schedule('0 4 * * *', async () => {
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await pool.query('DELETE FROM email_verifications WHERE expires_at <= now()');
  await pool.query('DELETE FROM password_resets WHERE expires_at <= now() OR used_at IS NOT NULL');
  await pool.query('DELETE FROM oauth_states WHERE expires_at <= now()');
  await pool.query('DELETE FROM design_auth_codes WHERE expires_at <= now()');
  await pool.query('DELETE FROM design_auth_requests WHERE expires_at <= now()');
  const deletionRequestPurge = await purgeApprovedAccountDeletionRequests(pool);
  if (deletionRequestPurge.deleted) console.log(`[jobs] purged ${deletionRequestPurge.deleted} approved account deletion request(s)`);
}, { timezone: 'UTC' });

console.log('Rootminster job runner started.');
// Fire-and-forget startup repair. Advisory locking prevents overlap with the scheduled run.
void run('cleanupSuspendedRecords');

const shutdown = async () => {
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
