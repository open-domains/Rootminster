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


const OBSERVER_SCAN_CURSOR_KEY = 'observer_scan_cursor';
const DEFAULT_OBSERVER_BATCH_SIZE = 20;

function observerFindingOpen(finding) {
  return !['dismissed', 'resolved'].includes(String(finding.status || 'open').toLowerCase());
}

function observerScanStatusFromResult(result) {
  const policy = result?.policy_result || result?.policy || {};
  const findings = Array.isArray(result?.findings)
    ? result.findings
    : Array.isArray(policy?.findings)
      ? policy.findings
      : [];
  const score = Number(result?.score ?? policy?.score ?? 0);
  const severity = String(result?.severity || policy?.severity || (findings.length ? 'unknown' : 'clear')).toLowerCase();
  return {
    status: findings.length ? 'flagged' : 'clear',
    severity: findings.length ? severity : 'clear',
    score,
    finding_count: findings.length,
    scanned_at: new Date().toISOString(),
  };
}

async function upsertObserverScanState(hostname, patch, storeImpl = store) {
  const normalised = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!normalised) return null;
  const rows = await storeImpl.filter('ObserverScanState', { hostname: normalised }, '-created_date', 1);
  const payload = { hostname: normalised, ...patch, last_scanned_at: patch.last_scanned_at || patch.scanned_at || new Date().toISOString() };
  return rows[0]
    ? storeImpl.update('ObserverScanState', rows[0].id, payload)
    : storeImpl.create('ObserverScanState', payload);
}

async function readObserverCursor(storeImpl = store) {
  const rows = await storeImpl.filter('PlatformSettings', { key: OBSERVER_SCAN_CURSOR_KEY }, '-created_date', 1);
  if (!rows[0]) return { row: null, cursor: 0 };
  try {
    const parsed = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return { row: rows[0], cursor: Math.max(Number(parsed?.cursor) || 0, 0) };
  } catch {
    return { row: rows[0], cursor: 0 };
  }
}

async function writeObserverCursor(cursor, storeImpl = store) {
  const current = await readObserverCursor(storeImpl);
  const payload = { key: OBSERVER_SCAN_CURSOR_KEY, value: JSON.stringify({ cursor: Math.max(Number(cursor) || 0, 0), updated_at: new Date().toISOString() }) };
  return current.row ? storeImpl.update('PlatformSettings', current.row.id, payload) : storeImpl.create('PlatformSettings', payload);
}

export function selectObserverBatch(records, cursor = 0, batchSize = DEFAULT_OBSERVER_BATCH_SIZE) {
  const targets = records
    .map(record => ({ record, hostname: hostnameFor(record) }))
    .filter(item => item.hostname)
    .sort((a, b) => a.hostname.localeCompare(b.hostname));
  if (!targets.length) return { records: [], nextCursor: 0 };
  const size = Math.min(Math.max(Number(batchSize) || DEFAULT_OBSERVER_BATCH_SIZE, 1), targets.length);
  const start = Math.max(Number(cursor) || 0, 0) % targets.length;
  const selected = Array.from({ length: size }, (_, offset) => targets[(start + offset) % targets.length]);
  return { records: selected.map(item => item.record), nextCursor: (start + size) % targets.length };
}

async function selectStoredObserverBatch(records, batchSize, storeImpl = store) {
  const state = await readObserverCursor(storeImpl);
  const selected = selectObserverBatch(records, state.cursor, batchSize);
  await writeObserverCursor(selected.nextCursor, storeImpl);
  return selected.records;
}

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

export async function fetchObserverFindings(options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled) return [];
  const fetchImpl = options.fetchImpl || fetch;
  const params = new URLSearchParams({ status: 'open', limit: String(options.limit || 5000) });
  if (options.hostname) params.set('hostname', options.hostname);
  const response = await fetchImpl(observerScanUrl(settings, `/api/findings?${params}`), {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw Object.assign(new Error(`Observer findings failed with HTTP ${response.status}`), { status: response.status });
  const body = response.json ? await response.json() : {};
  const findings = Array.isArray(body.findings) ? body.findings : [];
  return findings.map(finding => normaliseObserverFinding(settings, finding, 'observer')).filter(finding => finding.hostname);
}

export function observerStatusesByHostname(findings = [], scanStates = []) {
  const statuses = new Map();
  for (const scan of scanStates) {
    const hostname = String(scan.hostname || '').toLowerCase().replace(/\.$/, '');
    if (!hostname) continue;
    statuses.set(hostname, {
      hostname,
      status: scan.status || 'clear',
      severity: scan.severity || (scan.status === 'flagged' ? 'unknown' : 'clear'),
      finding_count: Number(scan.finding_count) || 0,
      last_seen_at: scan.last_scanned_at || scan.scanned_at || scan.updated_date || '',
      score: Number(scan.score) || 0,
    });
  }
  for (const finding of findings.filter(observerFindingOpen)) {
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
    current.status = 'flagged';
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
  const storeImpl = options.storeImpl || store;
  let findings = [];
  let observer_error = '';
  try {
    findings = (await fetchObserverFindings({ settings, fetchImpl: options.fetchImpl }))
      .filter(observerFindingOpen)
      .sort((a, b) => findingTime(b) - findingTime(a));
  } catch (error) {
    observer_error = error.message || 'Could not fetch live Observer findings';
  }
  const scanStates = await storeImpl.list('ObserverScanState', '-updated_date', 10000).catch(() => []);
  return { findings, scanStates, observer_error };
}

export async function dismissObserverFinding(id, { dismissedBy = '', reason = '' } = {}, options = {}) {
  const settings = options.settings || await getModuleConfig('observer', { fresh: true });
  if (!settings.enabled) throw Object.assign(new Error('Observer module is not enabled'), { status: 503 });
  const findingId = String(id || '').trim();
  if (!/^\d+$/.test(findingId)) throw Object.assign(new Error('A valid Observer finding id is required'), { status: 400 });
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(observerScanUrl(settings, `/api/findings/${findingId}/dismiss`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ dismissed_by: String(dismissedBy).slice(0, 320), reason: String(reason).slice(0, 1000) }),
  });
  if (response.status === 404) throw Object.assign(new Error('Observer finding not found'), { status: 404 });
  if (!response.ok) throw Object.assign(new Error(`Observer dismiss failed with HTTP ${response.status}`), { status: 502 });
  const body = response.json ? await response.json() : {};
  return body.finding ? normaliseObserverFinding(settings, body.finding, 'observer') : null;
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
  const result = response.json ? await response.json() : { ok: true };
  const scanStatus = observerScanStatusFromResult(result);
  // Observer keeps the findings and screenshots; Rootminster only records the
  // hostname's latest scan summary.
  if (!options.skipPersistence) await upsertObserverScanState(hostname, scanStatus, options.storeImpl || store);
  return result;
}

export async function scanObserverRequestTarget(requestId, options = {}) {
  const storeImpl = options.storeImpl || store;
  const request = await storeImpl.get('SubdomainRequest', requestId);
  if (!request) throw Object.assign(new Error('Request not found'), { status: 404 });
  const result = await scanObserverTarget(request, { ...options, storeImpl });
  const scanStatus = observerScanStatusFromResult(result);
  await storeImpl.update('SubdomainRequest', request.id, {
    observer_status: scanStatus.status,
    observer_severity: scanStatus.severity,
    observer_score: scanStatus.score,
    observer_finding_count: scanStatus.finding_count,
    observer_scanned_at: scanStatus.scanned_at,
  });
  return { ...result, observer_status: scanStatus };
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
    body: JSON.stringify({ batch_size: options.batchSize || DEFAULT_OBSERVER_BATCH_SIZE }),
  });
  if (!response.ok) throw Object.assign(new Error(`Observer scan-all failed with HTTP ${response.status}`), { status: response.status });
  return response.json ? response.json() : { ok: true };
}

export async function registerObserverRoutes(app) {
  app.post('/internal/observer/subdomains', { config: { rawBody: true } }, async (request, reply) => {
    try {
      await verifyObserverRequest(request);
      const batchSize = Number(request.body?.batch_size) || DEFAULT_OBSERVER_BATCH_SIZE;
      const records = (await store.list('SubdomainOwnership', 'full_name', 10000))
        .filter(record => record.status !== 'suspended');
      const batch = await selectStoredObserverBatch(records, batchSize);
      const subdomains = [];
      for (const record of batch) {
        const hostname = hostnameFor(record);
        if (!hostname) continue;
        await upsertObserverScanState(hostname, { status: 'clear', severity: 'clear', score: 0, finding_count: 0 });
        subdomains.push({
          id: record.id,
          hostname,
          requester_id: record.owner_id || record.requester_id || '',
          requester_email: record.owner_email || record.requester_email || '',
          status: record.status || 'active',
        });
      }
      return { subdomains };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
  });

  // Observer reports findings from its scheduled scans here. It keeps the findings
  // itself, so Rootminster only updates each hostname's scan summary.
  app.post('/internal/observer/findings', { config: { rawBody: true } }, async (request, reply) => {
    try {
      await verifyObserverRequest(request);
      const findings = Array.isArray(request.body?.findings) ? request.body.findings.slice(0, 100) : [];
      const byHostname = new Map();
      for (const finding of findings) {
        const hostname = String(finding.hostname || '').toLowerCase().replace(/\.$/, '').slice(0, 253);
        if (!hostname) continue;
        const severity = String(finding.severity || finding.policy_result?.severity || 'unknown').toLowerCase().slice(0, 40);
        const score = Number(finding.score ?? finding.policy_result?.score ?? 0);
        const current = byHostname.get(hostname) || { status: 'flagged', severity, score, finding_count: 0 };
        current.finding_count += 1;
        current.score = Math.max(current.score, score);
        if ((SEVERITY_RANK.get(severity) ?? 0) > (SEVERITY_RANK.get(current.severity) ?? 0)) current.severity = severity;
        byHostname.set(hostname, current);
      }
      for (const [hostname, state] of byHostname) await upsertObserverScanState(hostname, state);
      return { received: findings.length, hostnames: byHostname.size };
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
    return { statuses: observerStatusesByHostname(result.findings, result.scanStates), observer_error: result.observer_error };
  });

  app.post('/api/admin/observer/findings/dismiss', async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || !['admin', 'staff'].includes(actor.role)) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const reason = String(request.body?.reason || '').slice(0, 1000);
      const id = String(request.body?.id || request.body?.finding?.id || '').trim();
      const saved = await dismissObserverFinding(id, { dismissedBy: actor.email, reason });
      await store.create('AuditLog', {
        action: 'observer.finding_dismissed',
        actor_id: actor.id,
        actor_email: actor.email,
        target_type: 'ObserverFinding',
        target_id: id,
        metadata: { reason, hostname: saved?.hostname || request.body?.finding?.hostname },
      }, actor);
      return { ok: true, finding: saved };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
  });

  app.post('/api/admin/observer/scan-request', { config: { rateLimit: { max: 60, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const actor = await authenticateRequest(request);
    if (!actor || !['admin', 'staff'].includes(actor.role)) return reply.code(403).send({ error: 'Forbidden' });
    try {
      const requestId = String(request.body?.request_id || '').trim();
      if (!requestId) return reply.code(400).send({ error: 'request_id is required' });
      const result = await scanObserverRequestTarget(requestId);
      await store.create('AuditLog', {
        action: 'observer.scan_request',
        actor_id: actor.id,
        actor_email: actor.email,
        target_type: 'SubdomainRequest',
        target_id: requestId,
        metadata: { observer_status: result.observer_status },
      }, actor);
      return { ok: true, result };
    } catch (error) {
      return reply.code(error.status || 500).send({ error: error.message });
    }
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
