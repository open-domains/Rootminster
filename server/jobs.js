import cron from 'node-cron';
import { pool, withAdvisoryLock } from './database.js';
import { invokeInternal } from './function-runner.js';
import { config } from './config.js';

const systemActor = { id: null, email: 'system@rootminster.local', role: 'admin', display_name: 'Rootminster Jobs' };

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

if (config.donationsEnabled) {
  cron.schedule('15 3 * * *', () => run('cleanupPendingDonations'), { timezone: 'UTC' });
}
cron.schedule('30 3 * * 0', () => run('cleanupSuspendedRecords'), { timezone: 'UTC' });
cron.schedule('0 2 */6 * *', () => run('scheduledSync'), { timezone: 'UTC' });
cron.schedule('0 3 1 */2 *', () => run('verifyDnsRecords'), { timezone: 'UTC' });
cron.schedule('0 23 * * 0', () => run('weeklyStatsDiscord'), { timezone: 'UTC' });
cron.schedule('0 4 * * *', async () => {
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
  await pool.query('DELETE FROM email_verifications WHERE expires_at <= now()');
  await pool.query('DELETE FROM password_resets WHERE expires_at <= now() OR used_at IS NOT NULL');
  await pool.query('DELETE FROM oauth_states WHERE expires_at <= now()');
}, { timezone: 'UTC' });

console.log('Rootminster job runner started.');

const shutdown = async () => {
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
