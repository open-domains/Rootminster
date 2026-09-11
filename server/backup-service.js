import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupEncryptionConfigured, decryptBackup, encryptBackup, sha256File } from './backup-crypto.js';
import { config } from './config.js';
import { pool, withAdvisoryLock } from './database.js';
import { getModuleConfig } from './module-settings.js';
import { sendEmail } from './mail.js';
import { createR2Client, r2Limits } from './r2.js';

const here = dirname(fileURLToPath(import.meta.url));
const systemActor = { id: null, email: 'system@rootminster.local', role: 'admin', full_name: 'Rootminster Backups' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let restoreInProgress = false;

function databaseEnvironment() {
  const url = new URL(config.databaseUrl);
  const environment = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) environment.PGSSLMODE = sslMode;
  return environment;
}

function execute(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: databaseEnvironment(), stdio: ['ignore', 'ignore', 'pipe'], ...options });
    let errors = '';
    child.stderr.on('data', (chunk) => { errors = `${errors}${chunk}`.slice(-8000); });
    child.once('error', (error) => reject(Object.assign(new Error(`${command} could not start: ${error.message}`), { cause: error })));
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${errors.trim() || 'No diagnostic output'}`)));
  });
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function operationLimit(settings, operationClass) {
  return operationClass === 'a'
    ? Math.min(Number(settings.max_class_a_monthly) || r2Limits.safeClassAOperations, r2Limits.safeClassAOperations)
    : Math.min(Number(settings.max_class_b_monthly) || r2Limits.safeClassBOperations, r2Limits.safeClassBOperations);
}

async function reserveR2Operation(settings, operationClass) {
  const column = operationClass === 'a' ? 'class_a_operations' : 'class_b_operations';
  const limit = operationLimit(settings, operationClass);
  const result = await pool.query(
    `INSERT INTO backup_usage_monthly(month_key, ${column}, updated_at)
     VALUES ($1, 1, now())
     ON CONFLICT (month_key) DO UPDATE SET ${column} = backup_usage_monthly.${column} + 1, updated_at = now()
     WHERE backup_usage_monthly.${column} < $2
     RETURNING ${column}`,
    [monthKey(), limit],
  );
  if (!result.rowCount) {
    const label = operationClass === 'a' ? 'Class A' : 'Class B';
    throw Object.assign(new Error(`Rootminster's monthly R2 ${label} safety limit has been reached`), { status: 429 });
  }
}

function clientFor(settings) {
  validateR2Settings(settings);
  return createR2Client(settings, (operationClass) => reserveR2Operation(settings, operationClass));
}

export function validateR2Settings(settings) {
  if (!/^[a-f0-9]{32}$/i.test(String(settings.account_id || ''))) throw Object.assign(new Error('Enter a valid 32-character Cloudflare account ID'), { status: 400 });
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(String(settings.bucket_name || ''))) throw Object.assign(new Error('Enter a valid R2 bucket name'), { status: 400 });
  if (!settings.access_key_id || !settings.secret_access_key) throw Object.assign(new Error('Configure an R2 access key ID and secret'), { status: 400 });
  const prefix = String(settings.path_prefix || '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{0,199}$/.test(prefix) || prefix.includes('..')) throw Object.assign(new Error('Use a simple R2 path prefix without dots or special characters'), { status: 400 });
  return true;
}

async function audit(action, description, actor = systemActor) {
  await pool.query(
    `INSERT INTO entity_records(entity_type, data, created_by_id, created_by_email)
     VALUES ('AuditLog', $1::jsonb, $2, $3)`,
    [JSON.stringify({ actor_email: actor.email, actor_role: actor.role, action, entity_type: 'Backup', description }), actor.id || null, actor.email],
  );
}

async function updateRun(id, values) {
  const fields = [];
  const parameters = [];
  for (const [key, value] of Object.entries(values)) {
    parameters.push(value);
    fields.push(`${key} = $${parameters.length}`);
  }
  parameters.push(id);
  await pool.query(`UPDATE backup_runs SET ${fields.join(', ')} WHERE id = $${parameters.length}`, parameters);
}

function archiveName(date = new Date(), trigger = 'manual') {
  return `rootminster-${date.toISOString().replace(/[:.]/g, '-')}-${trigger}.rmbak`;
}

function objectKey(settings, id, fileName) {
  return `${String(settings.path_prefix).replace(/\/+$/, '')}/${id}/${fileName}`;
}

function idFromObjectKey(settings, key) {
  const prefix = `${String(settings.path_prefix).replace(/\/+$/, '')}/`;
  if (!key.startsWith(prefix)) return null;
  const id = key.slice(prefix.length).split('/')[0];
  return UUID.test(id) ? id : null;
}

async function syncR2Inventory(client, settings, suppliedObjects) {
  const objects = suppliedObjects || await client.list();
  for (const object of objects) {
    const id = idFromObjectKey(settings, object.key);
    if (!id) continue;
    const existing = await pool.query('SELECT id FROM backup_runs WHERE id = $1', [id]);
    if (existing.rowCount) continue;
    const metadata = await client.head(object.key);
    if (metadata.backup_id !== id || !/^[a-f0-9]{64}$/i.test(metadata.checksum || '')) continue;
    const trigger = ['manual', 'scheduled', 'pre_restore'].includes(metadata.trigger) ? metadata.trigger : 'manual';
    await pool.query(
      `INSERT INTO backup_runs(id, status, trigger, provider, file_name, object_key, size_bytes, checksum_sha256, started_at, completed_at)
       VALUES ($1, 'completed', $2, 'cloudflare_r2', $3, $4, $5, $6, $7, $7)
       ON CONFLICT (id) DO NOTHING`,
      [id, trigger, object.key.split('/').at(-1), object.key, object.size || metadata.size, metadata.checksum, object.last_modified || new Date()],
    );
  }
  return objects;
}

async function prepareCapacity(client, settings, incomingBytes, protectedKey = null) {
  const storageLimit = Math.min(Math.round((Number(settings.max_storage_gb) || 9) * 1_000_000_000), r2Limits.safeStorageBytes);
  if (incomingBytes > storageLimit) throw Object.assign(new Error('This backup is larger than the configured R2 storage allowance'), { status: 413 });
  const objects = await syncR2Inventory(client, settings);
  let storedBytes = objects.reduce((total, object) => total + Number(object.size || 0), 0);
  const retention = Math.max(1, Math.min(Number(settings.retention_count) || 30, 365));
  const managed = objects.filter((object) => idFromObjectKey(settings, object.key)).sort((left, right) => new Date(left.last_modified) - new Date(right.last_modified));
  while (storedBytes + incomingBytes > storageLimit || managed.length + 1 > retention) {
    const candidateIndex = managed.findIndex((object) => object.key !== protectedKey);
    if (candidateIndex < 0) throw Object.assign(new Error('R2 storage limit reached and no older backup can be safely removed'), { status: 507 });
    const [candidate] = managed.splice(candidateIndex, 1);
    await client.delete(candidate.key);
    storedBytes -= Number(candidate.size || 0);
    await pool.query('UPDATE backup_runs SET deleted_at = now() WHERE object_key = $1', [candidate.key]);
  }
  return { stored_bytes: storedBytes, storage_limit_bytes: storageLimit };
}

async function notifyFailure(settings, error) {
  if (!settings.notify_on_failure) return;
  const email = await getModuleConfig('email');
  if (!email.enabled || !email.contact_email) return;
  await sendEmail({
    to: email.contact_email,
    subject: 'Rootminster backup failed',
    body: `<p>A Rootminster database backup failed.</p><p>${String(error.message || error).replace(/[&<>"']/g, '')}</p><p>Open Module Settings to investigate.</p>`,
  }).catch((notificationError) => console.error('[backups] Failure notification could not be sent', notificationError));
}

async function performBackup({ actor = systemActor, trigger = 'manual', protectedObjectKey = null } = {}) {
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  if (!settings.enabled) throw Object.assign(new Error('Cloudflare R2 backups are disabled'), { status: 409 });
  if (!backupEncryptionConfigured()) throw Object.assign(new Error('Backup encryption is not configured'), { status: 503 });
  const client = clientFor(settings);
  const id = crypto.randomUUID();
  const fileName = archiveName(new Date(), trigger);
  const key = objectKey(settings, id, fileName);
  await pool.query(
    `INSERT INTO backup_runs(id, status, trigger, provider, file_name, object_key, started_at, created_by_id, created_by_email)
     VALUES ($1, 'running', $2, 'cloudflare_r2', $3, $4, now(), $5, $6)`,
    [id, trigger, fileName, key, actor.id || null, actor.email],
  );
  const directory = await mkdtemp(join(tmpdir(), 'rootminster-backup-'));
  const dumpPath = join(directory, 'database.dump');
  const encryptedPath = join(directory, fileName);
  try {
    await execute('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-acl', '--exclude-table-data=backup_runs', '--file', dumpPath]);
    await encryptBackup(dumpPath, encryptedPath);
    const [checksum, details] = await Promise.all([sha256File(encryptedPath), stat(encryptedPath)]);
    await prepareCapacity(client, settings, details.size, protectedObjectKey);
    await client.put(encryptedPath, key, checksum, { 'backup-id': id, checksum, trigger });
    const completedAt = new Date();
    await updateRun(id, { status: 'completed', size_bytes: details.size, checksum_sha256: checksum, completed_at: completedAt, error_message: null });
    await audit('backup_completed', `${trigger} R2 backup ${fileName} completed`, actor);
    return { id, status: 'completed', trigger, file_name: fileName, object_key: key, size_bytes: details.size, checksum_sha256: checksum, completed_at: completedAt };
  } catch (error) {
    await updateRun(id, { status: 'failed', completed_at: new Date(), error_message: String(error.message || error).slice(0, 2000) }).catch(() => {});
    await audit('backup_failed', `${trigger} R2 backup failed: ${String(error.message || error).slice(0, 500)}`, actor).catch(() => {});
    await notifyFailure(settings, error);
    throw error;
  } finally {
    if (directory.startsWith(`${tmpdir()}/rootminster-backup-`)) await rm(directory, { recursive: true, force: true });
  }
}

export async function createBackup(options = {}) {
  const result = await withAdvisoryLock('rootminster:backup-operation', () => performBackup(options));
  if (result?.skipped) throw Object.assign(new Error('Another backup or restore is already running'), { status: 409 });
  return result;
}

export async function listBackups(limit = 50) {
  const result = await pool.query(
    `SELECT id, status, trigger, provider, file_name, object_key, size_bytes, checksum_sha256,
            started_at, completed_at, verified_at, deleted_at, error_message, created_by_email
     FROM backup_runs ORDER BY started_at DESC LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 50, 100))],
  );
  return result.rows;
}

async function backupRecord(id) {
  const result = await pool.query(`SELECT * FROM backup_runs WHERE id = $1 AND status = 'completed' AND deleted_at IS NULL`, [id]);
  if (!result.rowCount) throw Object.assign(new Error('Backup not found'), { status: 404 });
  return result.rows[0];
}

async function withDownloadedBackup(record, callback) {
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  const client = clientFor(settings);
  const directory = await mkdtemp(join(tmpdir(), 'rootminster-backup-'));
  const encryptedPath = join(directory, 'backup.rmbak');
  try {
    await client.download(record.object_key, encryptedPath);
    const checksum = await sha256File(encryptedPath);
    if (checksum !== record.checksum_sha256) throw new Error('Backup checksum does not match; restoration has been blocked');
    return await callback({ directory, encryptedPath, checksum });
  } finally {
    if (directory.startsWith(`${tmpdir()}/rootminster-backup-`)) await rm(directory, { recursive: true, force: true });
  }
}

export async function verifyBackup(id, actor = systemActor) {
  const record = await backupRecord(id);
  return withDownloadedBackup(record, async ({ directory, encryptedPath }) => {
    const dumpPath = join(directory, 'verified.dump');
    await decryptBackup(encryptedPath, dumpPath);
    await execute('pg_restore', ['--list', dumpPath]);
    const verifiedAt = new Date();
    await updateRun(id, { verified_at: verifiedAt });
    await audit('backup_verified', `R2 backup ${record.file_name} passed checksum, decryption and archive validation`, actor);
    return { success: true, verified_at: verifiedAt };
  });
}

export async function encryptedBackupDownload(id) {
  const record = await backupRecord(id);
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  return { record, stream: await clientFor(settings).stream(record.object_key) };
}

export async function deleteBackup(id, actor) {
  const record = await backupRecord(id);
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  await clientFor(settings).delete(record.object_key);
  await updateRun(id, { deleted_at: new Date() });
  await audit('backup_deleted', `Deleted R2 backup ${record.file_name}`, actor);
  return { success: true };
}

async function restoreArchive(record, actor) {
  return withDownloadedBackup(record, async ({ directory, encryptedPath }) => {
    const dumpPath = join(directory, 'restore.dump');
    await decryptBackup(encryptedPath, dumpPath);
    await execute('pg_restore', ['--clean', '--if-exists', '--single-transaction', '--exit-on-error', '--no-owner', '--no-acl', '--dbname', databaseEnvironment().PGDATABASE, dumpPath]);
    const schema = await readFile(join(here, 'schema.sql'), 'utf8');
    await pool.query(schema);
    await pool.query('DELETE FROM sessions; DELETE FROM password_resets; DELETE FROM email_verifications; DELETE FROM oauth_states; DELETE FROM mcp_oauth_codes; DELETE FROM mcp_oauth_consents; UPDATE mcp_oauth_tokens SET revoked_at = now() WHERE revoked_at IS NULL;');
    await audit('backup_restored', `Database restored from R2 backup ${record.file_name} by ${actor.email}; all sessions and access grants were revoked`, systemActor);
    return { success: true, sessions_revoked: true };
  });
}

async function usageForCurrentMonth() {
  const result = await pool.query('SELECT month_key, class_a_operations, class_b_operations FROM backup_usage_monthly WHERE month_key = $1', [monthKey()]);
  return result.rows[0] || { month_key: monthKey(), class_a_operations: 0, class_b_operations: 0 };
}

export async function restoreBackup(id, actor) {
  if (restoreInProgress) throw Object.assign(new Error('A restore is already running'), { status: 409 });
  const selected = await backupRecord(id);
  const result = await withAdvisoryLock('rootminster:backup-operation', async () => {
    restoreInProgress = true;
    try {
      const safetyBackup = await performBackup({ actor, trigger: 'pre_restore', protectedObjectKey: selected.object_key });
      const usageBeforeRestore = await usageForCurrentMonth();
      const restored = await restoreArchive(selected, actor);
      await pool.query(
        `INSERT INTO backup_usage_monthly(month_key, class_a_operations, class_b_operations, updated_at)
         VALUES ($1, $2, $3, now()) ON CONFLICT (month_key) DO UPDATE SET
           class_a_operations = greatest(backup_usage_monthly.class_a_operations, excluded.class_a_operations),
           class_b_operations = greatest(backup_usage_monthly.class_b_operations, excluded.class_b_operations), updated_at = now()`,
        [usageBeforeRestore.month_key, usageBeforeRestore.class_a_operations, Number(usageBeforeRestore.class_b_operations) + 1],
      );
      for (const backup of [selected, safetyBackup]) {
        await pool.query(
          `INSERT INTO backup_runs(id, status, trigger, provider, file_name, object_key, size_bytes, checksum_sha256, started_at, completed_at, created_by_email)
           VALUES ($1, 'completed', $2, 'cloudflare_r2', $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [backup.id, backup.trigger, backup.file_name, backup.object_key, backup.size_bytes, backup.checksum_sha256, backup.started_at || backup.completed_at, backup.completed_at, backup.created_by_email || actor.email],
        );
      }
      return { ...restored, safety_backup_id: safetyBackup.id };
    } finally { restoreInProgress = false; }
  });
  if (result?.skipped) throw Object.assign(new Error('Another backup or restore is already running'), { status: 409 });
  return result;
}

export function backupRestoreInProgress() { return restoreInProgress; }

export function backupDue(frequency, lastCompletedAt, now = new Date(), hourUtc = 2, weekdayUtc = 0) {
  if (frequency === 'manual') return false;
  if (now.getUTCHours() < Number(hourUtc)) return false;
  const last = lastCompletedAt ? new Date(lastCompletedAt) : null;
  if (frequency === 'weekly') {
    if (now.getUTCDay() !== Number(weekdayUtc)) return false;
    return !last || now.getTime() - last.getTime() >= 6 * 86_400_000;
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return !last || last.getTime() < today;
}

export async function runScheduledBackup() {
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  if (!settings.enabled || settings.frequency === 'manual') return { skipped: true };
  const last = await pool.query(`SELECT completed_at FROM backup_runs WHERE status = 'completed' AND trigger = 'scheduled' ORDER BY completed_at DESC LIMIT 1`);
  if (!backupDue(settings.frequency, last.rows[0]?.completed_at, new Date(), settings.backup_hour_utc, settings.backup_weekday_utc)) return { skipped: true };
  try { return await createBackup({ actor: systemActor, trigger: 'scheduled' }); }
  catch (error) { if (error.status === 409) return { skipped: true }; throw error; }
}

export async function testR2Connection(actor) {
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  if (!settings.enabled) throw Object.assign(new Error('Enable and save the Cloudflare R2 Backup module first'), { status: 409 });
  await clientFor(settings).test();
  await audit('backup_provider_tested', 'Cloudflare R2 backup connection tested successfully', actor);
  return { success: true };
}

export async function backupModuleStatus() {
  const settings = await getModuleConfig('r2_backup', { fresh: true });
  await pool.query(`UPDATE backup_runs SET status = 'failed', completed_at = now(), error_message = 'Backup process stopped before completion' WHERE status = 'running' AND started_at < now() - interval '1 hour'`);
  let connectionError = null;
  let remoteStorageBytes = 0;
  if (settings.enabled) {
    try {
      const client = clientFor(settings);
      const objects = await syncR2Inventory(client, settings);
      remoteStorageBytes = objects.reduce((total, object) => total + Number(object.size || 0), 0);
    } catch (error) { connectionError = String(error.message || error).slice(0, 500); }
  }
  const [backups, usage] = await Promise.all([listBackups(), usageForCurrentMonth()]);
  const storageLimit = Math.min(Math.round((Number(settings.max_storage_gb) || 9) * 1_000_000_000), r2Limits.safeStorageBytes);
  return {
    enabled: Boolean(settings.enabled), configured: Boolean(settings.account_id && settings.bucket_name && settings.access_key_id && settings.secret_access_key),
    encryption_configured: backupEncryptionConfigured(), connection_error: connectionError, storage_used_bytes: remoteStorageBytes,
    limits: {
      storage_bytes: storageLimit,
      class_a_monthly: operationLimit(settings, 'a'), class_b_monthly: operationLimit(settings, 'b'),
      class_a_used: Number(usage.class_a_operations), class_b_used: Number(usage.class_b_operations), month: usage.month_key,
      note: 'Rootminster-only counters; other R2 usage in the Cloudflare account is not visible here.',
    },
    backups,
  };
}
