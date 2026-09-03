import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { sendEmail } from './mail.js';
import { bindRequestActor } from './lib/platform-client.js';
import { getModuleConfig } from './module-settings.js';
import { captureServerMessage } from './glitchtip.js';

const FUNCTION_NAMES = new Set([
  'adminDirectCfOp', 'adminListUsers', 'adminMigrateDomains', 'analyticsManager',
  'appealRequest', 'approveRequest', 'checkAvailability', 'cleanupPendingDonations',
  'cleanupSuspendedRecords', 'createDonationSession', 'createNestedSubdomain',
  'deviceAuth', 'getCloudflareZones', 'getQueueStatus',
  'getRecaptchaSiteKey', 'getTurnstileSiteKey', 'githubMigrate',
  'githubMigrateVerify', 'manageDnsRecord', 'postComment', 'publicApi',
  'manageSafetyAssessment',
  'rdapLookup', 'rejectRequest', 'repairMissingCfRecords', 'scheduledSync',
  'sendDiscordNotification', 'stripeWebhook', 'submitAbuseReport', 'submitRequest',
  'syncCloudflare', 'twoFactorAuth', 'updateDnsRecord', 'verifyDnsRecords',
  'weeklyStatsDiscord',
]);

const HTTP_FUNCTION_NAMES = new Set([
  ...FUNCTION_NAMES,
]);
for (const internalOnly of ['cleanupPendingDonations', 'scheduledSync', 'weeklyStatsDiscord']) {
  HTTP_FUNCTION_NAMES.delete(internalOnly);
}

async function handlerFor(name) {
  if (!FUNCTION_NAMES.has(name)) throw Object.assign(new Error(`Unknown function: ${name}`), { status: 404 });
  return (await import(`./functions/${name}.js`)).default;
}

function webRequest(name, body, actor, options = {}) {
  const method = options.method || 'POST';
  const headers = new Headers(options.headers || {});
  let payload;
  if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string' || body instanceof Uint8Array) payload = body;
    else {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }
  }
  const request = new Request(`${config.appUrl}/functions/${name}${options.search || ''}`, { method, headers, body: payload });
  return bindRequestActor(request, actor);
}

async function decodeResponse(response) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return response.text();
}

export async function invokeInternal(name, body = {}, actor = null, options = {}) {
  const handler = await handlerFor(name);
  const response = await handler(webRequest(name, body, actor, options));
  if (!(response instanceof Response)) return response;
  const data = await decodeResponse(response);
  if (!response.ok) {
    const error = Object.assign(new Error(data?.error || `Function ${name} failed`), {
      status: response.status,
      data,
      response: { status: response.status, data },
    });
    throw error;
  }
  return data;
}

async function executeHttp(name, request, reply, rawBody) {
  if (!HTTP_FUNCTION_NAMES.has(name)) return reply.code(404).send({ error: 'Not found' });
  const actor = await authenticateRequest(request, { allowMfaPending: name === 'twoFactorAuth' });
  const handler = await handlerFor(name);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers || {})) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const body = rawBody ?? request.body;
  const web = webRequest(name, body, actor, {
    method: request.method,
    headers,
    search: request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '',
  });
  const response = await handler(web);
  if (!(response instanceof Response)) return response;
  const data = await decodeResponse(response);
  if (response.status >= 500 && config.production) {
    request.log?.error?.({ function: name, status: response.status }, 'Function returned a server error');
    captureServerMessage(`Function ${name} returned HTTP ${response.status}`, { function: name, requestId: request.id });
    return reply.code(response.status).send({ error: 'Internal server error' });
  }
  reply.code(response.status);
  for (const [key, value] of response.headers.entries()) {
    if (!['content-length', 'content-encoding'].includes(key.toLowerCase())) reply.header(key, value);
  }
  return data;
}

function cleanContactBody(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .slice(0, 20_000);
}

export async function registerFunctionRoutes(app) {
  app.post('/api/functions/sendEmail', { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const actor = await authenticateRequest(request);
    const message = request.body || {};
    if (!actor) {
      const email = await getModuleConfig('email');
      message.to = email.contact_email || config.contactEmail;
      message.subject = cleanContactBody(message.subject).slice(0, 200);
      message.body = cleanContactBody(message.body);
    } else if (actor.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await sendEmail(message);
    return { success: true };
  });

  for (const prefix of ['/api/functions', '/functions']) {
    app.get(`${prefix}/publicApi`, { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, (request, reply) => executeHttp('publicApi', request, reply));
    app.post(`${prefix}/twoFactorAuth`, { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, (request, reply) => executeHttp('twoFactorAuth', request, reply));
    app.post(`${prefix}/deviceAuth`, { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, (request, reply) => executeHttp('deviceAuth', request, reply));
    app.options(`${prefix}/*`, { config: { rateLimit: false } }, async (_request, reply) => reply.code(204).send());
    app.post(`${prefix}/:name`, (request, reply) => executeHttp(request.params.name, request, reply));
  }
  app.post('/api/webhooks/stripe', { config: { rawBody: true } }, (request, reply) => executeHttp('stripeWebhook', request, reply, request.rawBody));
}
