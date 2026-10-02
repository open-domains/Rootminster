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


const SEVERITY_RANK = new Map([
  ['critical', 5],
  ['high', 4],
  ['medium', 3],
  ['low', 2],
  ['info', 1],
  ['unknown', 0],
]);

function normaliseObserverFinding(settings, finding, source = 'rootminster') {
  const hostname = String(finding.hostname || '').toLowerCase().replace(/\.$/, '').slice(0, 253);
  const observedAt = finding.observed_at || finding.last_seen_at || finding.updated_date || finding.created_date || new Date().toISOString();
  return {
    ...finding,
    id: String(finding.id || `${source}:${hostname}:${finding.finding_type || ''}:${observedAt}`),
    hostname,
    url: String(finding.url || '').slice(0, 2000),
    severity: String(finding.severity || finding.policy_result?.severity || 'unknown').slice(0, 40),
    score: Number(finding.score ?? finding.policy_result?.score ?? 0),
    finding_type: String(finding.finding_type || '').slice(0, 120),
    policy_section: String(finding.policy_section || '').slice(0, 240),
    evidence: String(finding.evidence || '').slice(0, 4000),
    recommended_action: String(finding.recommended_action || '').slice(0, 4000),
    status: String(finding.status || 'open').slice(0, 40),
    screenshot_url: normaliseScreenshotUrl(settings, finding),
    observed_at: observedAt,
    first_seen_at: finding.first_seen_at || finding.observed_at || finding.created_date || observedAt,
    last_seen_at: finding.last_seen_at || finding.observed_at || finding.updated_date || finding.created_date || observedAt,
    source,
  };
}

function findingTime(finding) {
  const raw = finding.last_seen_at || finding.observed_at || finding.updated_date || finding.created_date || finding.first_seen_at;
  const parsed = raw ? Date.parse(String(raw).replace(' ', 'T')) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function findingKey(finding) {
  return [
    String(finding.hostname || '').toLowerCase(),
    String(finding.url || '').toLowerCase(),
    String(finding.finding_type || '').toLowerCase(),
    String(finding.policy_section || '').toLowerCase(),
    String(finding.evidence || '').slice(0, 120),
  ].join('|');
}

export function mergeObserverFindings(storedFindings = [], liveFindings = []) {
  const merged = new Map();
  for (const finding of [...storedFindings, ...liveFindings]) {
    if (!finding.hostname) continue;
    const key = findingKey(finding);
    const existing = merged.get(key);
    if (!existing || finding.source === 'observer' || findingTime(finding) >= findingTime(existing)) {
      merged.set(key, finding);
    }
  }
  return [...merged.values()].sort((a, b) => findingTime(b) - findingTime(a));
}

export async function fetchObserverFindings(options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled) return [];
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(observerScanUrl(settings, '/api/findings'), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw Object.assign(new Error(`Observer findings failed with HTTP ${response.status}`), { status: response.status });
  const body = response.json ? await response.json() : {};
  const findings = Array.isArray(body.findings) ? body.findings : [];
  return findings.map(finding => normaliseObserverFinding(settings, finding, 'observer')).filter(finding => finding.hostname);
}

export function observerStatusesByHostname(findings = []) {
  const statuses = new Map();
  for (const finding of findings) {
    const hostname = String(finding.hostname || '').toLowerCase().replace(/\.$/, '');
    if (!hostname) continue;
    const severity = String(finding.severity || 'unknown').toLowerCase();
    const current = statuses.get(hostname) || {
      hostname,
      status: 'flagged',
      severity: 'unknown',
      finding_count: 0,
      last_seen_at: '',
      score: 0,
    };
    const rank = SEVERITY_RANK.get(severity) ?? 0;
    const currentRank = SEVERITY_RANK.get(String(current.severity || 'unknown').toLowerCase()) ?? 0;
    current.finding_count += 1;
    current.score = Math.max(Number(current.score) || 0, Number(finding.score) || 0);
    if (rank >= currentRank) current.severity = severity;
    if (findingTime(finding) >= findingTime({ last_seen_at: current.last_seen_at })) {
      current.last_seen_at = finding.last_seen_at || finding.observed_at || current.last_seen_at;
    }
    statuses.set(hostname, current);
  }
  return Object.fromEntries(statuses.entries());
}

export async function loadObserverFindings(options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  const stored = (await (options.storeImpl || store).list('ObserverFinding', '-created_date', 10000))
    .map(finding => normaliseObserverFinding(settings, finding, 'rootminster'))
    .filter(finding => finding.hostname);
  let live = [];
  let observer_error = '';
  try {
    live = await fetchObserverFindings({ settings, fetchImpl: options.fetchImpl });
  } catch (error) {
    observer_error = error.message || 'Could not fetch live Observer findings';
  }
  return { findings: mergeObserverFindings(stored, live), observer_error };
}

export function observerScanUrl(settings, path) {
  const base = String(settings.observer_internal_url || settings.observer_url || '').trim().replace(/\/$/, '');
  if (!base) throw Object.assign(new Error('Observer internal URL is not configured'), { status: 503 });
  return new URL(path, `${base}/`).href;
}

export function observerHostnameFor(record) {
  return hostnameFor(record);
}

export async function scanObserverTarget(record, options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled) return { skipped: true, reason: 'observer_disabled' };
  const hostname = hostnameFor(record);
  if (!hostname) return { skipped: true, reason: 'missing_hostname' };
  const fetchImpl = options.fetchImpl || fetch;
  const payload = {
    hostname,
    url: record.preview_link || record.url || `https://${hostname}`,
  };
  const response = await fetchImpl(observerScanUrl(settings, '/api/scan'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw Object.assign(new Error(`Observer scan failed with HTTP ${response.status}`), { status: response.status });
  return response.json ? response.json() : { ok: true };
}

export async function scanObserverOwnershipTarget(ownershipId, options = {}) {
  const storeImpl = options.storeImpl || store;
  const ownership = await storeImpl.get('SubdomainOwnership', ownershipId);
  if (!ownership) throw Object.assign(new Error('Subdomain not found'), { status: 404 });
  if (ownership.status === 'suspended') throw Object.assign(new Error('Only active subdomains can be scanned'), { status: 400 });
  return scanObserverTarget(ownership, options);
}

export async function scanAllObserverTargets(options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled) return { skipped: true, reason: 'observer_disabled' };
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(observerScanUrl(settings, '/api/scan-all'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw Object.assign(new Error(`Observer scan-all failed with HTTP ${response.status}`), { status: response.status });
  return response.json ? response.json() : { ok: true };
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
          status: String(finding.status || 'open').slice(0, 40),
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
    const result = await loadObserverFindings();
    return result;
  });

  app.get('/api/admin/observer/statuses', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || !['admin', 'staff'].includes(actor.role)) return reply.code(403).send({ error: 'Forbidden' });
    const result = await loadObserverFindings();
    return { statuses: observerStatusesByHostname(result.findings), observer_error: result.observer_error };
  });

  app.post('/api/admin/observer/scan-subdomain', { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || !['admin', 'staff'].includes(actor.role)) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const ownershipId = String(request.body?.ownership_id || request.body?.subdomain_id || '').trim();
      if (!ownershipId) return reply.code(400).send({ error: 'ownership_id is required' });
      const result = await scanObserverOwnershipTarget(ownershipId);
      await store.create('AuditLog', {
        action: 'observer.scan_subdomain',
        actor_id: actor.id,
        actor_email: actor.email,
        target_type: 'SubdomainOwnership',
        target_id: ownershipId,
        metadata: { result },
      }, actor);
      return { ok: true, result };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
  });
}
