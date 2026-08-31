import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { sendEmail } from './mail.js';
import { bindRequestActor } from './lib/platform-client.js';

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
  const actor = await authenticateRequest(request);
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
  reply.code(response.status);
  for (const [key, value] of response.headers.entries()) {
    if (!['content-length', 'content-encoding'].includes(key.toLowerCase())) reply.header(key, value);
  }
  const type = response.headers.get('content-type') || '';
  return type.includes('application/json') ? response.json() : response.text();
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
      message.to = config.contactEmail;
      message.subject = cleanContactBody(message.subject).slice(0, 200);
      message.body = cleanContactBody(message.body);
    } else if (actor.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    await sendEmail(message);
    return { success: true };
  });

  app.route({
    method: ['GET', 'POST', 'OPTIONS'],
    url: '/api/functions/:name',
    handler: (request, reply) => executeHttp(request.params.name, request, reply),
  });
  app.route({
    method: ['GET', 'POST', 'OPTIONS'],
    url: '/functions/:name',
    handler: (request, reply) => executeHttp(request.params.name, request, reply),
  });
  app.post('/api/webhooks/stripe', { config: { rawBody: true } }, (request, reply) => executeHttp('stripeWebhook', request, reply, request.rawBody));
}
