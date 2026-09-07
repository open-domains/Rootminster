import { authenticateRequest } from './auth.js';
import {
  backupModuleStatus, createBackup, deleteBackup, encryptedBackupDownload,
  restoreBackup, testR2Connection, verifyBackup,
} from './backup-service.js';
import { verifyCurrentTotp } from './security.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin(request, reply) {
  const actor = await authenticateRequest(request);
  if (!actor) { reply.code(401).send({ error: 'Unauthorized' }); return null; }
  if (actor.role !== 'admin') { reply.code(403).send({ error: 'Forbidden' }); return null; }
  return actor;
}

function validBackupId(request, reply) {
  const id = String(request.params.id || '');
  if (!UUID.test(id)) { reply.code(400).send({ error: 'Invalid backup ID' }); return null; }
  return id;
}

export async function registerBackupRoutes(app) {
  app.get('/api/admin/backups', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    return reply.header('Cache-Control', 'no-store').send(await backupModuleStatus());
  });

  app.post('/api/admin/backups/r2/test', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    return testR2Connection(actor);
  });

  app.post('/api/admin/backups', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return;
    return reply.code(201).send({ backup: await createBackup({ actor, trigger: 'manual' }) });
  });

  app.post('/api/admin/backups/:id/verify', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validBackupId(request, reply);
    if (!id) return;
    return verifyBackup(id, actor);
  });

  app.get('/api/admin/backups/:id/download', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validBackupId(request, reply);
    if (!id) return;
    const { record, stream } = await encryptedBackupDownload(id);
    const fileName = String(record.file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    return reply.header('Content-Type', 'application/octet-stream').header('Content-Disposition', `attachment; filename="${fileName}"`).header('Cache-Control', 'no-store').send(stream);
  });

  app.post('/api/admin/backups/:id/restore', { config: { rateLimit: { max: 2, timeWindow: '1 hour' } } }, async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validBackupId(request, reply);
    if (!id) return;
    if (request.body?.confirmation !== 'RESTORE') return reply.code(400).send({ error: 'Enter RESTORE to confirm this destructive operation' });
    if (!verifyCurrentTotp(actor, request.body?.totp_code)) return reply.code(403).send({ error: 'Enter a current two-factor authentication code' });
    return restoreBackup(id, actor);
  });

  app.delete('/api/admin/backups/:id', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    const id = actor && validBackupId(request, reply);
    if (!id) return;
    return deleteBackup(id, actor);
  });
}
