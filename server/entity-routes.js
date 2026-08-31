import { authenticateRequest, publicUser } from './auth.js';
import { store } from './store.js';
import { config } from './config.js';

const PUBLIC_SETTINGS = new Set([
  'maintenance_mode', 'maintenance_message', 'notification_banner_enabled',
  'notification_banner_text', 'external_link_warning_enabled',
  'requests_locked', 'requests_locked_message',
]);

const STAFF_WRITABLE = new Set([
  'AuditLog', 'SubdomainOwnership', 'SyncLog', 'SubdomainRequest',
  'AbuseReport', 'RequestComment', 'EmailLog', 'DnsRecord', 'EditRequest',
]);

function isElevated(user) {
  return user?.role === 'admin' || user?.role === 'staff';
}

function entityEnabled(entity) {
  return entity !== 'Donation' || config.donationsEnabled;
}

async function userCanRead(user, entity, record) {
  if (entity === 'Domain') return true;
  if (user?.role === 'admin') return true;
  if (entity === 'PlatformSettings') return PUBLIC_SETTINGS.has(record.key);
  if (!user) return false;
  if (isElevated(user)) return true;
  if (entity === 'User') return record.id === user.id;
  if (['DnsRecord', 'SubdomainOwnership'].includes(entity)) return record.owner_id === user.id || record.owner_email === user.email;
  if (['SubdomainRequest', 'EditRequest'].includes(entity)) return record.requester_id === user.id || record.requester_email === user.email;
  if (entity === 'Donation') return record.user_id === user.id || record.user_email === user.email || record.email === user.email;
  if (['ApiToken', 'TrustedDevice', 'DeviceCode'].includes(entity)) return record.user_id === user.id || record.user_email === user.email;
  if (entity === 'RequestComment') {
    if (record.is_internal) return false;
    const linked = await store.get(record.request_type === 'edit' ? 'EditRequest' : 'SubdomainRequest', record.request_id);
    return !!linked && (linked.requester_id === user.id || linked.requester_email === user.email);
  }
  return false;
}

function redact(user, entity, record) {
  if (!record) return record;
  if (entity === 'User') return publicUser(record);
  const copy = { ...record };
  if (entity === 'ApiToken') delete copy.token_hash;
  if (entity === 'TrustedDevice') delete copy.token_hash;
  if (entity === 'PlatformSettings' && user?.role !== 'admin' && !PUBLIC_SETTINGS.has(copy.key)) return null;
  return copy;
}

function canWrite(user, entity, action, record) {
  if (!user) return false;
  if (user.role === 'admin') return entity !== 'User' || action === 'update';
  if (user.role === 'staff') return STAFF_WRITABLE.has(entity);
  if (entity === 'ApiToken' && action === 'update') return record?.user_id === user.id;
  return false;
}

function safeFilter(raw) {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    throw Object.assign(new Error('Invalid filter JSON'), { status: 400 });
  }
}

export async function registerEntityRoutes(app) {
  app.get('/api/entities/:entity', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    const filter = safeFilter(request.query?.filter);
    const requestedLimit = Math.min(Number(request.query?.limit) || 1000, 10_000);
    const rows = await store.filter(request.params.entity, filter, request.query?.sort, isElevated(user) ? requestedLimit : 10_000, Number(request.query?.skip) || 0);
    const allowed = [];
    for (const row of rows) {
      if (await userCanRead(user, request.params.entity, row)) {
        const clean = redact(user, request.params.entity, row);
        if (clean) allowed.push(clean);
      }
      if (allowed.length >= requestedLimit) break;
    }
    if (!user && !['Domain', 'PlatformSettings'].includes(request.params.entity)) return reply.code(401).send({ error: 'Unauthorized' });
    return { data: allowed };
  });

  app.get('/api/entities/:entity/:id', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    const record = await store.get(request.params.entity, request.params.id);
    if (!record) return reply.code(404).send({ error: 'Not found' });
    if (!(await userCanRead(user, request.params.entity, record))) return reply.code(user ? 403 : 401).send({ error: user ? 'Forbidden' : 'Unauthorized' });
    return { data: redact(user, request.params.entity, record) };
  });

  app.post('/api/entities/:entity', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    if (!canWrite(user, request.params.entity, 'create')) return reply.code(user ? 403 : 401).send({ error: user ? 'Forbidden' : 'Unauthorized' });
    const created = await store.create(request.params.entity, request.body, user);
    return reply.code(201).send({ data: redact(user, request.params.entity, created) });
  });

  app.post('/api/entities/:entity/bulk', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    if (!canWrite(user, request.params.entity, 'create')) return reply.code(user ? 403 : 401).send({ error: user ? 'Forbidden' : 'Unauthorized' });
    const rows = await store.bulkCreate(request.params.entity, request.body?.rows, user);
    return reply.code(201).send({ data: rows.map((row) => redact(user, request.params.entity, row)) });
  });

  app.patch('/api/entities/:entity/:id', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    const existing = await store.get(request.params.entity, request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (!canWrite(user, request.params.entity, 'update', existing)) return reply.code(user ? 403 : 401).send({ error: user ? 'Forbidden' : 'Unauthorized' });
    const body = { ...(request.body || {}) };
    if (user.role === 'user' && request.params.entity === 'ApiToken') {
      for (const key of Object.keys(body)) if (!['revoked', 'revoked_by'].includes(key)) delete body[key];
    }
    const updated = await store.update(request.params.entity, request.params.id, body);
    return { data: redact(user, request.params.entity, updated) };
  });

  app.delete('/api/entities/:entity/:id', async (request, reply) => {
    if (!entityEnabled(request.params.entity)) return reply.code(404).send({ error: 'Not found' });
    const user = await authenticateRequest(request);
    const existing = await store.get(request.params.entity, request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Not found' });
    if (!canWrite(user, request.params.entity, 'delete', existing)) return reply.code(user ? 403 : 401).send({ error: user ? 'Forbidden' : 'Unauthorized' });
    const deleted = await store.delete(request.params.entity, request.params.id);
    return { data: redact(user, request.params.entity, deleted) };
  });
}
