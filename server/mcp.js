import crypto from 'node:crypto';
import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { pool } from './database.js';
import { invokeInternal } from './function-runner.js';
import { getModuleConfig } from './module-settings.js';
import { randomToken, sha256 } from './security.js';
import { serializeUser, store } from './store.js';

const MCP_RESOURCE = `${config.appUrl}/mcp`;
const STAFF_ROLES = new Set(['staff', 'admin']);
const PROTOCOL_VERSIONS = new Set(['2025-06-18', '2025-03-26', '2024-11-05']);

async function requireMcpModule(_request, reply) {
  if (!(await getModuleConfig('mcp')).enabled) return reply.code(404).send({ error: 'Not found' });
}

function oauthError(reply, status, error, description) {
  return reply.code(status).send({ error, error_description: description });
}

function redirectWithParams(uri, values) {
  const target = new URL(uri);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, value);
  }
  return target.toString();
}

function validRedirectUri(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function getOauthClient(clientId) {
  const result = await pool.query('SELECT * FROM mcp_oauth_clients WHERE client_id = $1', [clientId]);
  return result.rows[0] || null;
}

function validateAuthorizeRequest(query, client) {
  if (query.response_type !== 'code') return 'Only the authorization code flow is supported';
  if (!client) return 'Unknown OAuth client';
  if (!Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(query.redirect_uri)) return 'Unregistered redirect URI';
  if (!query.code_challenge || query.code_challenge_method !== 'S256') return 'PKCE with S256 is required';
  if (query.resource && query.resource !== MCP_RESOURCE) return 'The requested resource is not this MCP server';
  return null;
}

async function issueTokens({ clientId, userId, resource, scope, mfaVerifiedAt = null }) {
  const accessToken = `rmcp_at_${randomToken(32)}`;
  const refreshToken = `rmcp_rt_${randomToken(32)}`;
  await pool.query(
    `INSERT INTO mcp_oauth_tokens(
       client_id, user_id, access_token_hash, refresh_token_hash, resource, scope,
       access_expires_at, refresh_expires_at, mfa_verified_at
     ) VALUES ($1, $2, $3, $4, $5, $6, now() + interval '1 hour', now() + interval '30 days', $7)`,
    [clientId, userId, sha256(accessToken), sha256(refreshToken), resource || MCP_RESOURCE, scope || 'rootminster', mfaVerifiedAt],
  );
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: scope || 'rootminster',
    resource: resource || MCP_RESOURCE,
  };
}

async function authenticateMcp(request) {
  const authorization = String(request.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return null;
  const raw = authorization.slice(7).trim();
  const result = await pool.query(
    `SELECT u.* FROM mcp_oauth_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.access_token_hash = $1 AND t.access_expires_at > now()
       AND t.revoked_at IS NULL AND u.status = 'active'
       AND (u.role = 'user' OR t.mfa_verified_at IS NOT NULL)`,
    [sha256(raw)],
  );
  return serializeUser(result.rows[0]);
}

const userTools = [
  {
    name: 'get_my_account',
    title: 'Get my Rootminster account',
    description: 'Return the signed-in Rootminster account profile and current role.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'list_my_subdomains',
    title: 'List my subdomains',
    description: 'List DNS records owned by the signed-in Rootminster account.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'list_my_requests',
    title: 'List my requests',
    description: 'List subdomain requests submitted by the signed-in Rootminster account.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

const staffTools = [
  {
    name: 'list_pending_reviews',
    title: 'List pending reviews',
    description: 'List pending subdomain requests for staff review.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'get_review_request',
    title: 'Get a review request',
    description: 'Return one subdomain request by its Rootminster request ID.',
    inputSchema: { type: 'object', required: ['request_id'], properties: { request_id: { type: 'string', format: 'uuid' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'approve_review',
    title: 'Approve a subdomain request',
    description: 'Approve a pending subdomain request and create its DNS record. This changes external DNS.',
    inputSchema: { type: 'object', required: ['request_id'], properties: { request_id: { type: 'string', format: 'uuid' }, admin_notes: { type: 'string', maxLength: 2000 } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'reject_review',
    title: 'Reject a subdomain request',
    description: 'Reject a pending subdomain request and notify its requester.',
    inputSchema: { type: 'object', required: ['request_id', 'rejection_reason'], properties: { request_id: { type: 'string', format: 'uuid' }, rejection_reason: { type: 'string', minLength: 1, maxLength: 2000 }, admin_notes: { type: 'string', maxLength: 2000 } }, additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  },
];

function limitValue(value) {
  return Math.min(Math.max(Number(value) || 25, 1), 100);
}

function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

async function ownedRecords(entity, user, limit) {
  const byId = await store.filter(entity, { [entity === 'SubdomainRequest' ? 'requester_id' : 'owner_id']: user.id }, '-created_date', limit);
  if (byId.length >= limit) return byId;
  const key = entity === 'SubdomainRequest' ? 'requester_email' : 'owner_email';
  const byEmail = await store.filter(entity, { [key]: user.email }, '-created_date', limit);
  return [...new Map([...byId, ...byEmail].map((item) => [item.id, item])).values()].slice(0, limit);
}

async function reviewWithSafety(request) {
  const rows = await store.filter('SafetyAssessment', { request_id: request.id }, '-created_date', 1);
  return { ...request, safety_assessment: rows[0] || null };
}

async function callTool(name, args, user) {
  if (name === 'get_my_account') return toolResult({ account: { id: user.id, email: user.email, first_name: user.full_name, display_name: user.display_name, role: user.role } });
  if (name === 'list_my_subdomains') return toolResult({ subdomains: await ownedRecords('DnsRecord', user, limitValue(args.limit)) });
  if (name === 'list_my_requests') return toolResult({ requests: await ownedRecords('SubdomainRequest', user, limitValue(args.limit)) });
  if (!STAFF_ROLES.has(user.role)) throw Object.assign(new Error('This tool requires a staff or admin role'), { status: 403 });
  if (name === 'list_pending_reviews') {
    const requests = await store.filter('SubdomainRequest', { status: { $in: ['pending', 'user_responded', 'needs_info'] } }, 'created_date', limitValue(args.limit));
    return toolResult({ requests: await Promise.all(requests.map(reviewWithSafety)) });
  }
  if (name === 'get_review_request') {
    const request = await store.get('SubdomainRequest', args.request_id);
    if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
    return toolResult({ request: await reviewWithSafety(request) });
  }
  if (name === 'approve_review' || name === 'reject_review') {
    if (!args.request_id) throw Object.assign(new Error('request_id is required'), { status: 400 });
    const review = await store.get('SubdomainRequest', args.request_id);
    if (!review) throw Object.assign(new Error('Request not found'), { status: 404 });
    if (review.status !== 'pending') throw Object.assign(new Error(`Request is already ${review.status || 'not pending'}`), { status: 409 });
  }
  if (name === 'approve_review') return toolResult(await invokeInternal('approveRequest', { request_id: args.request_id, admin_notes: args.admin_notes || '' }, user));
  if (name === 'reject_review') {
    if (!String(args.rejection_reason || '').trim()) throw Object.assign(new Error('rejection_reason is required'), { status: 400 });
    return toolResult(await invokeInternal('rejectRequest', { request_id: args.request_id, rejection_reason: String(args.rejection_reason).trim(), admin_notes: args.admin_notes || '' }, user));
  }
  throw Object.assign(new Error(`Unknown tool: ${name}`), { status: 404 });
}

async function handleMcp(request, reply) {
  const user = await authenticateMcp(request);
  if (!user) {
    reply.header('WWW-Authenticate', `Bearer resource_metadata="${config.appUrl}/.well-known/oauth-protected-resource"`);
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const body = request.body || {};
  const id = body.id ?? null;
  if (body.method === 'initialize') {
    const requestedVersion = String(body.params?.protocolVersion || '');
    const protocolVersion = PROTOCOL_VERSIONS.has(requestedVersion) ? requestedVersion : '2025-06-18';
    return { jsonrpc: '2.0', id, result: { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'Rootminster', version: '2.0.0' } } };
  }
  if (body.method === 'notifications/initialized') return reply.code(202).send();
  if (body.method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (body.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: STAFF_ROLES.has(user.role) ? [...userTools, ...staffTools] : userTools } };
  }
  if (body.method === 'tools/call') {
    try {
      const result = await callTool(String(body.params?.name || ''), body.params?.arguments || {}, user);
      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: error.message }], isError: true } };
    }
  }
  return reply.code(400).send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
}

export async function registerMcpRoutes(app) {
  app.get('/.well-known/oauth-protected-resource', { preHandler: requireMcpModule }, async () => ({
    resource: MCP_RESOURCE,
    authorization_servers: [config.appUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: ['rootminster'],
  }));
  app.get('/.well-known/oauth-protected-resource/mcp', { preHandler: requireMcpModule }, async () => ({
    resource: MCP_RESOURCE,
    authorization_servers: [config.appUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: ['rootminster'],
  }));
  app.get('/.well-known/oauth-authorization-server', { preHandler: requireMcpModule }, async () => ({
    issuer: config.appUrl,
    authorization_endpoint: `${config.appUrl}/oauth/authorize`,
    token_endpoint: `${config.appUrl}/oauth/token`,
    registration_endpoint: `${config.appUrl}/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['rootminster'],
  }));

  app.post('/oauth/register', { preHandler: requireMcpModule, config: { rateLimit: { max: 20, timeWindow: '1 hour' } } }, async (request, reply) => {
    const redirectUris = request.body?.redirect_uris;
    if (!Array.isArray(redirectUris) || !redirectUris.length || redirectUris.length > 10 || !redirectUris.every(validRedirectUri)) {
      return oauthError(reply, 400, 'invalid_redirect_uri', 'Provide one to ten HTTPS redirect URIs');
    }
    if (request.body?.token_endpoint_auth_method && request.body.token_endpoint_auth_method !== 'none') {
      return oauthError(reply, 400, 'invalid_client_metadata', 'Only public PKCE clients are supported');
    }
    const clientId = `rmcp_client_${randomToken(24)}`;
    const clientName = String(request.body?.client_name || 'MCP client').slice(0, 120);
    await pool.query('INSERT INTO mcp_oauth_clients(client_id, client_name, redirect_uris) VALUES ($1, $2, $3::jsonb)', [clientId, clientName, JSON.stringify(redirectUris)]);
    return reply.code(201).send({ client_id: clientId, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: clientName, redirect_uris: redirectUris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
  });

  app.get('/oauth/authorize', { preHandler: requireMcpModule }, async (request, reply) => {
    const query = Object.fromEntries(Object.entries(request.query || {}).map(([key, value]) => [key, String(value)]));
    const client = await getOauthClient(query.client_id);
    const problem = validateAuthorizeRequest(query, client);
    if (problem) return reply.code(400).type('text/plain').send(problem);
    const user = await authenticateRequest(request);
    if (!user) return reply.redirect(`/login?return_to=${encodeURIComponent(request.url)}`);
    const consentToken = randomToken(32);
    const requestData = Object.fromEntries(
      ['client_id', 'redirect_uri', 'response_type', 'state', 'code_challenge', 'code_challenge_method', 'resource', 'scope']
        .map((key) => [key, query[key] || '']),
    );
    await pool.query(
      `INSERT INTO mcp_oauth_consents(token_hash, user_id, client_id, request_data, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, now() + interval '10 minutes')`,
      [sha256(consentToken), user.id, query.client_id, JSON.stringify(requestData)],
    );
    const fields = `<input type="hidden" name="consent_token" value="${escapeHtml(consentToken)}">`;
    reply.header('Cache-Control', 'no-store');
    return reply.type('text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize Rootminster</title><style>body{font-family:system-ui;background:#111827;color:#f9fafb;display:grid;min-height:100vh;place-items:center;margin:0}.card{max-width:520px;padding:32px;border:1px solid #374151;border-radius:16px;background:#1f2937}button{padding:12px 18px;border:0;border-radius:8px;font-weight:700;cursor:pointer}.allow{background:#7c3aed;color:white}.deny{background:#374151;color:white}form{display:flex;gap:12px}</style></head><body><main class="card"><h1>Connect ${escapeHtml(client.client_name)}</h1><p>This connection uses your Rootminster account as <strong>${escapeHtml(user.email)}</strong>. It can read your account data. Staff and admins can also review, approve, and reject subdomain requests according to their current Rootminster role.</p><form method="post" action="/oauth/authorize">${fields}<button class="allow" name="decision" value="allow">Authorize</button><button class="deny" name="decision" value="deny">Cancel</button></form></main></body></html>`);
  });

  app.post('/oauth/authorize', { preHandler: requireMcpModule }, async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).type('text/plain').send('Sign in before authorizing this connection');
    const consentToken = String(request.body?.consent_token || '');
    const consentResult = await pool.query(
      `DELETE FROM mcp_oauth_consents
       WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()
       RETURNING request_data`,
      [sha256(consentToken), user.id],
    );
    if (!consentResult.rowCount) return reply.code(400).type('text/plain').send('This authorization request is invalid or has expired');
    const body = Object.fromEntries(Object.entries(consentResult.rows[0].request_data || {}).map(([key, value]) => [key, String(value)]));
    const client = await getOauthClient(body.client_id);
    const problem = validateAuthorizeRequest(body, client);
    if (problem) return reply.code(400).type('text/plain').send(problem);
    if (String(request.body?.decision || '') !== 'allow') return reply.redirect(redirectWithParams(body.redirect_uri, { error: 'access_denied', state: body.state }));
    const code = `rmcp_code_${randomToken(32)}`;
    await pool.query(
      `INSERT INTO mcp_oauth_codes(code_hash, client_id, user_id, redirect_uri, code_challenge, resource, scope, expires_at, mfa_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '10 minutes', now())`,
      [sha256(code), body.client_id, user.id, body.redirect_uri, body.code_challenge, body.resource || MCP_RESOURCE, body.scope || 'rootminster'],
    );
    return reply.redirect(redirectWithParams(body.redirect_uri, { code, state: body.state }));
  });

  app.post('/oauth/token', { preHandler: requireMcpModule, config: { rateLimit: { max: 60, timeWindow: '15 minutes' } } }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    const body = request.body || {};
    if (body.grant_type === 'authorization_code') {
      const verifier = String(body.code_verifier || '');
      const result = await pool.query(
        `DELETE FROM mcp_oauth_codes WHERE code_hash = $1 AND client_id = $2 AND redirect_uri = $3 AND expires_at > now() RETURNING *`,
        [sha256(String(body.code || '')), String(body.client_id || ''), String(body.redirect_uri || '')],
      );
      const saved = result.rows[0];
      if (!saved) return oauthError(reply, 400, 'invalid_grant', 'Invalid or expired authorization code');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      if (!verifier || challenge !== saved.code_challenge) return oauthError(reply, 400, 'invalid_grant', 'PKCE verification failed');
      return issueTokens({ clientId: saved.client_id, userId: saved.user_id, resource: saved.resource, scope: saved.scope, mfaVerifiedAt: saved.mfa_verified_at });
    }
    if (body.grant_type === 'refresh_token') {
      const result = await pool.query(
        `DELETE FROM mcp_oauth_tokens WHERE refresh_token_hash = $1 AND client_id = $2 AND refresh_expires_at > now() AND revoked_at IS NULL RETURNING *`,
        [sha256(String(body.refresh_token || '')), String(body.client_id || '')],
      );
      const saved = result.rows[0];
      if (!saved) return oauthError(reply, 400, 'invalid_grant', 'Invalid or expired refresh token');
      return issueTokens({ clientId: saved.client_id, userId: saved.user_id, resource: saved.resource, scope: saved.scope, mfaVerifiedAt: saved.mfa_verified_at });
    }
    return oauthError(reply, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  });

  app.post('/mcp', { preHandler: requireMcpModule, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, handleMcp);
  app.get('/mcp', { preHandler: requireMcpModule }, async (_request, reply) => reply.code(405).send({ error: 'Use POST for MCP requests' }));
}
