import crypto from 'node:crypto';
import { getModuleConfig } from './module-settings.js';
import { store } from './store.js';

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function signingHeaders(secret, body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const payload = Buffer.concat([Buffer.from(timestamp), Buffer.from('.'), Buffer.from(body)]);
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    'x-observer-id': 'opendomains-observer',
    'x-observer-timestamp': timestamp,
    'x-observer-signature': `sha256=${signature}`,
  };
}

async function verifyObserverRequest(request) {
  const settings = await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled || !settings.shared_secret) throw Object.assign(new Error('Observer module is not enabled'), { status: 403 });
  const timestamp = String(request.headers['x-observer-timestamp'] || '');
  const signature = String(request.headers['x-observer-signature'] || '');
  const observedAt = Number(timestamp) * 1000;
  if (!timestamp || !Number.isFinite(observedAt) || Math.abs(Date.now() - observedAt) > MAX_CLOCK_SKEW_MS) {
    throw Object.assign(new Error('Invalid observer timestamp'), { status: 401 });
  }
  const body = request.rawBody || JSON.stringify(request.body || {});
  const expected = signingHeaders(settings.shared_secret, body, timestamp)['x-observer-signature'];
  if (!timingSafeEqual(signature, expected)) throw Object.assign(new Error('Invalid observer signature'), { status: 401 });
  return settings;
}

function hostnameFor(record) {
  const full = record.full_name || record.hostname;
  if (full) return String(full).toLowerCase().replace(/\.$/, '');
  if (record.subdomain && record.root_domain) return `${record.subdomain}.${record.root_domain}`.toLowerCase().replace(/\.$/, '');
  return '';
}

function normaliseScreenshotUrl(settings, finding) {
  const raw = finding.screenshot_page_url || finding.screenshot_url || finding.screenshot_path || '';
  if (!raw) return '';
  if (/^https:\/\//i.test(raw)) return raw;
  if (!settings.observer_url) return raw;
  return new URL(raw, settings.observer_url).href;
}

export async function registerObserverRoutes(app) {
  app.post('/internal/observer/subdomains', { config: { rawBody: true } }, async (request, reply) => {
    try {
      await verifyObserverRequest(request);
      const records = await store.filter('SubdomainRequest', { status: 'approved' }, '-updated_date', 5000);
      const subdomains = records.map(record => ({
        id: record.id,
        hostname: hostnameFor(record),
        requester_id: record.requester_id || '',
        requester_email: record.requester_email || '',
        status: record.status,
      })).filter(record => record.hostname);
      return { subdomains };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
  });

  app.post('/internal/observer/findings', { config: { rawBody: true } }, async (request, reply) => {
    try {
      const settings = await verifyObserverRequest(request);
      const findings = Array.isArray(request.body?.findings) ? request.body.findings.slice(0, 100) : [];
      const saved = [];
      for (const finding of findings) {
        const hostname = String(finding.hostname || '').toLowerCase().replace(/\.$/, '').slice(0, 253);
        if (!hostname) continue;
        saved.push(await store.create('ObserverFinding', {
          hostname,
          url: String(finding.url || '').slice(0, 2000),
          severity: String(finding.severity || finding.policy_result?.severity || 'unknown').slice(0, 40),
          score: Number(finding.score ?? finding.policy_result?.score ?? 0),
          finding_type: String(finding.finding_type || '').slice(0, 120),
          policy_section: String(finding.policy_section || '').slice(0, 240),
          evidence: String(finding.evidence || '').slice(0, 4000),
          recommended_action: String(finding.recommended_action || '').slice(0, 4000),
          screenshot_url: normaliseScreenshotUrl(settings, finding),
          observed_at: new Date().toISOString(),
          raw: finding,
        }));
      }
      return { saved: saved.length, findings: saved };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
  });

  app.get('/api/admin/observer/findings', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || !['admin', 'staff'].includes(actor.role)) return reply.code(403).send({ error: 'Forbidden' });
    const findings = await store.list('ObserverFinding', '-created_date', 100);
    return { findings };
  });
}
