import { config } from './config.js';
import { getModuleConfig } from './module-settings.js';

let sdk;
let activeClient;

function sampleRate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : fallback;
}

export function buildEnvelopeEndpoint(value) {
  const dsn = new URL(value);
  if (!['https:', 'http:'].includes(dsn.protocol) || !dsn.username || dsn.password) throw new Error('Invalid GlitchTip DSN');
  const parts = dsn.pathname.split('/').filter(Boolean);
  const projectId = parts.pop();
  if (!/^\d+$/.test(projectId || '')) throw new Error('Invalid GlitchTip project ID');
  const prefix = parts.length ? `/${parts.join('/')}` : '';
  return `${dsn.protocol}//${dsn.host}${prefix}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(dsn.username)}&sentry_version=7`;
}

export function scrubServerEvent(event) {
  const clean = { ...event };
  delete clean.user;
  delete clean.breadcrumbs;
  delete clean.extra;
  if (clean.request) {
    clean.request = { ...clean.request };
    delete clean.request.cookies;
    delete clean.request.data;
    delete clean.request.headers;
    if (clean.request.url) clean.request.url = clean.request.url.split(/[?#]/)[0];
  }
  if (clean.transaction) clean.transaction = clean.transaction.split(/[?#]/)[0];
  if (clean.spans) clean.spans = clean.spans.map((span) => ({ ...span, data: undefined, description: span.description?.split(/[?#]/)[0] }));
  return clean;
}

export async function configureServerGlitchTip(settings) {
  if (settings?.enabled && settings.dsn) buildEnvelopeEndpoint(settings.dsn);
  if (activeClient) {
    await activeClient.close(2_000);
    activeClient = null;
  }
  if (!settings?.enabled || !settings.dsn) return;
  sdk ||= await import('@sentry/node');
  activeClient = sdk.init({
    dsn: settings.dsn,
    environment: settings.environment || (config.production ? 'production' : 'development'),
    sampleRate: sampleRate(settings.error_sample_rate, 1),
    tracesSampleRate: sampleRate(settings.trace_sample_rate, 0),
    sendDefaultPii: false,
    beforeSend: scrubServerEvent,
    beforeSendTransaction: scrubServerEvent,
  });
}

export function captureServerException(error, tags = {}) {
  if (!activeClient || !sdk) return;
  sdk.withScope((scope) => {
    scope.setTags(tags);
    sdk.captureException(error);
  });
}

export function captureServerMessage(message, tags = {}) {
  if (!activeClient || !sdk) return;
  return sdk.withScope((scope) => {
    scope.setTags(tags);
    return sdk.captureMessage(message, 'error');
  });
}

async function sendTestEvent(actor) {
  if (!activeClient || !sdk) throw Object.assign(new Error('GlitchTip monitoring is not enabled'), { status: 409 });
  const eventId = captureServerMessage('Rootminster GlitchTip test event', { source: 'admin_test', actorRole: actor.role });
  const delivered = await activeClient.flush(5_000);
  if (!delivered) throw Object.assign(new Error('The GlitchTip test event could not be delivered'), { status: 502 });
  return eventId;
}

export async function closeServerGlitchTip() {
  if (activeClient) await activeClient.close(2_000);
  activeClient = null;
}

export async function registerGlitchTipRoutes(app) {
  app.addContentTypeParser('application/x-sentry-envelope', { parseAs: 'buffer', bodyLimit: 262_144 }, (_request, body, done) => done(null, body));
  app.post('/api/observability/envelope', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const settings = await getModuleConfig('glitchtip');
    if (!settings.enabled || !settings.dsn) return reply.code(404).send({ error: 'Not found' });
    const endpoint = buildEnvelopeEndpoint(settings.dsn);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-sentry-envelope' },
      body: request.body,
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    return reply.code(response.ok ? 202 : 502).send();
  });
  app.post('/api/admin/modules/glitchtip/test', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || actor.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    const eventId = await sendTestEvent(actor);
    return { success: true, event_id: eventId };
  });
}
