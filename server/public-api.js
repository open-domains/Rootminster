import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { invokeInternal } from './function-runner.js';
import { randomToken, sha256 } from './security.js';
import { store } from './store.js';

const API_VERSION = '1.0.0';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_REQUEST_STATUSES = ['pending', 'needs_info', 'user_responded'];

const readLimit = { max: 120, timeWindow: '1 minute', keyGenerator: apiRateKey };
const publicLimit = { max: 60, timeWindow: '1 minute' };
const writeLimit = { max: 30, timeWindow: '1 minute', keyGenerator: apiRateKey };

export function bearerToken(authorization = '') {
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function apiRateKey(request) {
  const token = bearerToken(request.headers?.authorization);
  return token ? `token:${sha256(token)}` : `ip:${request.ip}`;
}

export function parsePagination(query = {}) {
  const page = Math.min(Math.max(Number.parseInt(query.page, 10) || 1, 1), 10_000);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

function data(reply, value, status = 200, meta) {
  return reply.code(status).send(meta ? { data: value, meta } : { data: value });
}

function error(reply, status, code, message, details) {
  return reply.code(status).send({ error: { code, message, ...(details ? { details } : {}) } });
}

function publicRecord(record) {
  return {
    id: record.id,
    name: record.name,
    type: record.record_type,
    content: record.content,
    ttl: record.ttl,
    proxied: Boolean(record.proxied),
    status: record.status,
  };
}

function publicRequest(record) {
  return {
    id: record.id,
    hostname: `${record.subdomain}.${record.root_domain}`,
    subdomain: record.subdomain,
    root_domain: record.root_domain,
    record: {
      type: record.record_type,
      value: record.record_value,
      ttl: record.ttl,
      proxied: Boolean(record.proxied),
    },
    reason: record.reason || '',
    preview_url: record.preview_link || null,
    status: record.status,
    rejection_reason: record.rejection_reason || null,
    reviewed_by: record.reviewed_by || null,
    reviewed_at: record.reviewed_at || null,
    created_at: record.created_date,
    updated_at: record.updated_date,
  };
}

async function apiIdentity(request) {
  const raw = bearerToken(request.headers.authorization);
  if (!raw) return null;
  const tokens = await store.filter('ApiToken', { token_hash: sha256(raw) }, '-created_date', 10);
  const token = tokens.find((item) => item.revoked !== true && (!item.expires_at || new Date(item.expires_at) > new Date()));
  if (!token) return null;
  const user = token.user_id ? await store.get('User', token.user_id) : (await store.filter('User', { email: token.user_email }, '-created_date', 1))[0];
  if (!user || user.status !== 'active') return null;
  if (!token.last_used || Date.now() - new Date(token.last_used).getTime() > 300_000) {
    store.update('ApiToken', token.id, { last_used: new Date().toISOString() }).catch(() => {});
  }
  return { user, token };
}

function tokenHasScope(identity, scope) {
  if (!scope) return true;
  const scopes = Array.isArray(identity.token.scopes) ? identity.token.scopes : [];
  if (scopes.includes(scope)) return true;
  if (scopes.length) return false;
  // Legacy tokens retain normal user API access, but never inherit staff/admin powers.
  return !scope.startsWith('staff:');
}

async function requireApiIdentity(request, reply, roles, scope) {
  const identity = await apiIdentity(request);
  if (!identity) {
    error(reply, 401, 'invalid_token', 'Provide a valid API token using Authorization: Bearer <token>');
    return null;
  }
  if (roles && !roles.includes(identity.user.role)) {
    error(reply, 403, 'forbidden', 'This API token does not have permission to perform that action');
    return null;
  }
  if (!tokenHasScope(identity, scope)) {
    error(reply, 403, 'insufficient_scope', `This API token requires the ${scope} scope`);
    return null;
  }
  return identity;
}

async function paginated(entity, filter, query, sort = '-created_date') {
  const pagination = parsePagination(query);
  const rows = await store.filter(entity, filter, sort, pagination.limit + 1, pagination.skip);
  return {
    rows: rows.slice(0, pagination.limit),
    meta: { page: pagination.page, limit: pagination.limit, has_more: rows.length > pagination.limit },
  };
}

async function createBrowserToken(request, reply) {
  const user = await authenticateRequest(request);
  if (!user) return error(reply, 401, 'unauthorized', 'Sign in to manage API tokens');
  const name = String(request.body?.name || '').trim();
  if (!name || name.length > 80) return error(reply, 400, 'invalid_name', 'Token name must be between 1 and 80 characters');
  const allTokens = await store.filter('ApiToken', { user_id: user.id }, '-created_date', 100);
  const active = allTokens.filter((token) => token.revoked !== true);
  if (active.length >= 10) return error(reply, 409, 'token_limit_reached', 'Revoke an existing token before creating another');
  const raw = `od_${randomToken(32)}`;
  const created = await store.create('ApiToken', {
    user_id: user.id, user_email: user.email, name,
    token_hash: sha256(raw), token_prefix: raw.slice(0, 10), revoked: false,
    scopes: ['account:read', 'requests:read', 'requests:write', 'dns:read', 'dns:write'],
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  }, user);
  return data(reply, {
    id: created.id, name: created.name, token: raw, token_prefix: created.token_prefix,
    created_at: created.created_date,
  }, 201);
}

function openApiDocument() {
  return {
    openapi: '3.1.0',
    info: { title: 'Rootminster User API', version: API_VERSION, description: 'Versioned API for Open Domains availability, requests, DNS records, and account data.' },
    servers: [{ url: `${config.appUrl}/api/v1` }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'API token created in Settings → API Tokens' } },
      schemas: { Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } } } },
    },
    paths: {
      '/domains': { get: { summary: 'List requestable domains', tags: ['Public'], responses: { 200: { description: 'Domain list' }, 429: { description: 'Rate limit exceeded' } } } },
      '/availability': { get: { summary: 'Check subdomain availability', tags: ['Public'], parameters: [{ name: 'name', in: 'query', required: true, schema: { type: 'string' } }, { name: 'domain', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Availability result' } } } },
      '/me': { get: { summary: 'Get the token owner', tags: ['Account'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Account summary' }, 401: { description: 'Invalid token' } } } },
      '/requests': {
        get: { summary: 'List requests', tags: ['Requests'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Paginated request list' } } },
        post: { summary: 'Create a request', tags: ['Requests'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Request created' }, 422: { description: 'Validation failed' } } },
      },
      '/requests/{id}': { get: { summary: 'Get one request', tags: ['Requests'], security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Request' }, 404: { description: 'Not found' } } } },
      '/dns/records': { get: { summary: 'List public DNS records for a managed domain', tags: ['DNS'], parameters: [{ name: 'domain', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'DNS records' } } } },
      '/dns/records/{id}': {
        patch: { summary: 'Update an owned DNS record', tags: ['DNS'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Record updated' } } },
        delete: { summary: 'Delete an owned DNS record', tags: ['DNS'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'Record deleted' } } },
      },
      '/device/code': { post: { summary: 'Start device authorization', tags: ['Device authorization'], responses: { 200: { description: 'Device and user codes' } } } },
      '/device/token': { post: { summary: 'Poll device authorization', tags: ['Device authorization'], responses: { 200: { description: 'Authorization state or API token' } } } },
    },
  };
}

export async function registerPublicApiRoutes(app) {
  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.url.startsWith('/api/v1')) return payload;
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    reply.header('X-API-Version', API_VERSION);
    return payload;
  });

  app.options('/api/v1/*', { config: { rateLimit: false } }, async (_request, reply) => reply.code(204).send());

  app.get('/api/v1', { config: { rateLimit: publicLimit } }, async (_request, reply) => data(reply, {
    name: 'Rootminster User API', version: API_VERSION, documentation: `${config.appUrl}/api-docs`, openapi: `${config.appUrl}/api/v1/openapi.json`,
  }));
  app.get('/api/v1/openapi.json', { config: { rateLimit: publicLimit } }, async (_request, reply) => reply.send(openApiDocument()));

  app.get('/api/v1/domains', { config: { rateLimit: publicLimit } }, async (_request, reply) => {
    const domains = await store.list('Domain', 'name', 1000);
    return data(reply, domains.map((domain) => ({
      name: domain.name, requests_enabled: Boolean(domain.allow_new_requests), status: domain.status,
    })));
  });

  app.get('/api/v1/availability', { config: { rateLimit: publicLimit } }, async (request, reply) => {
    try {
      const result = await invokeInternal('checkAvailability', { subdomain: request.query?.name, root_domain: request.query?.domain }, { id: null, email: null, role: 'user' });
      return data(reply, result);
    } catch (cause) {
      return error(reply, cause.status || 400, 'availability_check_failed', cause.message);
    }
  });

  app.get('/api/v1/rdap/:domain', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const result = await invokeInternal('rdapLookup', { domain: request.params.domain }, null);
      return data(reply, result);
    } catch (cause) {
      return error(reply, cause.status || 400, 'rdap_lookup_failed', cause.message);
    }
  });

  app.get('/api/v1/dns/records', { config: { rateLimit: publicLimit } }, async (request, reply) => {
    const domain = String(request.query?.domain || '').trim().toLowerCase();
    if (!domain) return error(reply, 400, 'missing_domain', 'The domain query parameter is required');
    const records = await store.filter('DnsRecord', { zone_name: domain }, 'name', 10_000);
    return data(reply, records.map(publicRecord));
  });

  app.get('/api/v1/me', { config: { rateLimit: readLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'account:read');
    if (!identity) return;
    const [records, requests, tokens] = await Promise.all([
      store.filter('DnsRecord', { owner_id: identity.user.id }, '-created_date', 10_000),
      store.filter('SubdomainRequest', { requester_id: identity.user.id }, '-created_date', 10_000),
      store.filter('ApiToken', { user_id: identity.user.id }, '-created_date', 100),
    ]);
    return data(reply, {
      id: identity.user.id, email: identity.user.email, name: identity.user.display_name || identity.user.full_name,
      role: identity.user.role, ns_unlocked: Boolean(identity.user.ns_unlocked), created_at: identity.user.created_date,
      stats: { records: records.length, requests: requests.length, pending_requests: requests.filter((item) => ACTIVE_REQUEST_STATUSES.includes(item.status)).length, api_tokens: tokens.filter((token) => token.revoked !== true).length },
    });
  });

  app.get('/api/v1/requests', { config: { rateLimit: readLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'requests:read');
    if (!identity) return;
    const filter = { requester_id: identity.user.id };
    if (request.query?.status) filter.status = String(request.query.status);
    if (request.query?.scope === 'all' && ['staff', 'admin'].includes(identity.user.role)) {
      if (!tokenHasScope(identity, 'staff:requests:read')) return error(reply, 403, 'insufficient_scope', 'This API token cannot list staff review data');
      delete filter.requester_id;
    }
    const result = await paginated('SubdomainRequest', filter, request.query);
    return data(reply, result.rows.map(publicRequest), 200, result.meta);
  });

  app.get('/api/v1/requests/:id', { config: { rateLimit: readLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'requests:read');
    if (!identity) return;
    if (!UUID_PATTERN.test(request.params.id)) return error(reply, 400, 'invalid_id', 'Request ID must be a UUID');
    const record = await store.get('SubdomainRequest', request.params.id);
    const elevated = ['staff', 'admin'].includes(identity.user.role);
    if (!record || (!elevated && record.requester_id !== identity.user.id && record.requester_email !== identity.user.email)) {
      return error(reply, 404, 'request_not_found', 'Request not found');
    }
    return data(reply, publicRequest(record));
  });

  app.post('/api/v1/requests', { config: { rateLimit: writeLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'requests:write');
    if (!identity) return;
    try {
      const result = await invokeInternal('submitRequest', request.body || {}, { ...identity.user, trusted_source: 'api' });
      return data(reply, (result.requests || []).map(publicRequest), 201);
    } catch (cause) {
      return error(reply, cause.status || 422, 'request_rejected', cause.message, cause.data);
    }
  });

  app.patch('/api/v1/dns/records/:id', { config: { rateLimit: writeLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'dns:write');
    if (!identity) return;
    if (!UUID_PATTERN.test(request.params.id)) return error(reply, 400, 'invalid_id', 'Record ID must be a UUID');
    if (!['content', 'ttl', 'proxied'].some((field) => request.body?.[field] !== undefined)) {
      return error(reply, 400, 'missing_changes', 'Provide at least one of content, ttl, or proxied');
    }
    try {
      const result = await invokeInternal('manageDnsRecord', {
        action: 'update', record_id: request.params.id,
        content: request.body?.content, ttl: request.body?.ttl, proxied: request.body?.proxied,
      }, { ...identity.user, trusted_source: 'api' });
      return data(reply, result.record || result);
    } catch (cause) {
      return error(reply, cause.status || 422, 'record_update_failed', cause.message, cause.data);
    }
  });

  app.delete('/api/v1/dns/records/:id', { config: { rateLimit: writeLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, null, 'dns:write');
    if (!identity) return;
    if (!UUID_PATTERN.test(request.params.id)) return error(reply, 400, 'invalid_id', 'Record ID must be a UUID');
    try {
      const result = await invokeInternal('manageDnsRecord', { action: 'delete', record_id: request.params.id }, { ...identity.user, trusted_source: 'api' });
      return data(reply, result);
    } catch (cause) {
      return error(reply, cause.status || 422, 'record_delete_failed', cause.message, cause.data);
    }
  });

  app.get('/api/v1/staff/whois', { config: { rateLimit: readLimit } }, async (request, reply) => {
    const identity = await requireApiIdentity(request, reply, ['staff', 'admin'], 'staff:read');
    if (!identity) return;
    const name = String(request.query?.name || '').trim().toLowerCase();
    const domain = String(request.query?.domain || '').trim().toLowerCase();
    if (!name || !domain) return error(reply, 400, 'missing_name', 'Both name and domain are required');
    const records = await store.filter('DnsRecord', { name: `${name}.${domain}` }, 'created_date', 100);
    if (!records.length) return error(reply, 404, 'subdomain_not_found', 'Subdomain not found');
    const requests = await store.filter('SubdomainRequest', { subdomain: name, root_domain: domain }, '-created_date', 100);
    return data(reply, { hostname: `${name}.${domain}`, owner_id: records[0].owner_id, owner_email: records[0].owner_email, records: records.map(publicRecord), requests: requests.map(publicRequest) });
  });

  app.post('/api/v1/device/code', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    try {
      return data(reply, await invokeInternal('deviceAuth', { action: 'request_code', token_name: request.body?.token_name }, null));
    } catch (cause) {
      return error(reply, cause.status || 400, 'device_authorization_failed', cause.message);
    }
  });

  app.post('/api/v1/device/token', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      return data(reply, await invokeInternal('deviceAuth', { action: 'poll', device_code: request.body?.device_code }, null));
    } catch (cause) {
      return error(reply, cause.status || 400, 'device_token_failed', cause.message);
    }
  });

  app.get('/api/auth/tokens', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return error(reply, 401, 'unauthorized', 'Sign in to manage API tokens');
    const tokens = await store.filter('ApiToken', { user_id: user.id }, '-created_date', 100);
    return data(reply, tokens.filter((token) => token.revoked !== true).map((token) => ({ id: token.id, name: token.name, token_prefix: token.token_prefix, scopes: token.scopes || [], expires_at: token.expires_at || null, last_used: token.last_used || null, created_at: token.created_date })));
  });
  app.post('/api/auth/tokens', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, createBrowserToken);
  app.delete('/api/auth/tokens/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return error(reply, 401, 'unauthorized', 'Sign in to manage API tokens');
    if (!UUID_PATTERN.test(request.params.id)) return error(reply, 400, 'invalid_id', 'Token ID must be a UUID');
    const token = await store.get('ApiToken', request.params.id);
    if (!token || token.user_id !== user.id) return error(reply, 404, 'token_not_found', 'API token not found');
    await store.update('ApiToken', token.id, { revoked: true, revoked_by: user.email, revoked_at: new Date().toISOString() });
    return data(reply, { revoked: true });
  });
}
