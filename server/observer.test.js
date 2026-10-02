import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signingHeaders, observerScanUrl, scanObserverTarget, scanAllObserverTargets,
  scanObserverOwnershipTarget, fetchObserverFindings, mergeObserverFindings,
  observerStatusesByHostname, loadObserverFindings, selectObserverBatch,
} from './observer.js';

const observerSettings = {
  enabled: true,
  observer_internal_url: 'http://observer:8080',
};

test('observer signing headers match the python client format', () => {
  const headers = signingHeaders('secret', '{}', '123');
  assert.equal(headers['x-observer-id'], 'opendomains-observer');
  assert.equal(headers['x-observer-timestamp'], '123');
  assert.equal(headers['x-observer-signature'], 'sha256=4468c5e304ca107335ae2982d764fdf304214175c7dc3ad06921848d275abb92');
});

test('observerScanUrl prefers internal observer URL for system calls', () => {
  assert.equal(observerScanUrl(observerSettings, '/api/scan'), 'http://observer:8080/api/scan');
  assert.equal(observerScanUrl({ observer_url: 'https://observer.open-domains.com' }, '/api/scan'), 'https://observer.open-domains.com/api/scan');
});

test('scanObserverTarget posts a new request hostname to Observer internal URL', async () => {
  const calls = [];
  await scanObserverTarget({ full_name: 'new.example.test', preview_link: 'https://preview.example.test' }, {
    settings: observerSettings,
    skipPersistence: true,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://observer:8080/api/scan');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    hostname: 'new.example.test',
    url: 'https://preview.example.test',
  });
});

test('scanAllObserverTargets asks Observer to scan the next Rootminster batch', async () => {
  const calls = [];
  await scanAllObserverTargets({
    settings: observerSettings,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ scanned: 2 }) };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://observer:8080/api/scan-all');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { batch_size: 20 });
});

test('selectObserverBatch rotates stable hostname batches and wraps', () => {
  const records = Array.from({ length: 5 }, (_, index) => ({ full_name: `site-${index + 1}.example.test` }));
  const first = selectObserverBatch(records, 0, 2);
  const second = selectObserverBatch(records, first.nextCursor, 2);
  const third = selectObserverBatch(records, second.nextCursor, 2);
  assert.deepEqual(first.records.map(item => item.full_name), ['site-1.example.test', 'site-2.example.test']);
  assert.deepEqual(second.records.map(item => item.full_name), ['site-3.example.test', 'site-4.example.test']);
  assert.deepEqual(third.records.map(item => item.full_name), ['site-5.example.test', 'site-1.example.test']);
});

test('scanObserverOwnershipTarget lets staff trigger Observer for a chosen active subdomain', async () => {
  const calls = [];
  const result = await scanObserverOwnershipTarget('owned-1', {
    settings: observerSettings,
    skipPersistence: true,
    storeImpl: {
      get: async (entity, id) => {
        assert.equal(entity, 'SubdomainOwnership');
        assert.equal(id, 'owned-1');
        return { id, full_name: 'Manual.Example.Test', status: 'active' };
      },
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ queued: true }) };
    },
  });

  assert.deepEqual(result, { queued: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://observer:8080/api/scan');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    hostname: 'manual.example.test',
    url: 'https://manual.example.test',
  });
});

test('scanObserverOwnershipTarget refuses missing or suspended ownership records', async () => {
  await assert.rejects(
    () => scanObserverOwnershipTarget('missing', {
      settings: observerSettings,
      storeImpl: { get: async () => null },
      fetchImpl: async () => { throw new Error('fetch should not run'); },
    }),
    /Subdomain not found/,
  );

  await assert.rejects(
    () => scanObserverOwnershipTarget('suspended', {
      settings: observerSettings,
      storeImpl: { get: async () => ({ id: 'suspended', full_name: 'suspended.example.test', status: 'suspended' }) },
      fetchImpl: async () => { throw new Error('fetch should not run'); },
    }),
    /Only active subdomains can be scanned/,
  );
});


test('fetchObserverFindings normalises live Observer findings from the internal API', async () => {
  const findings = await fetchObserverFindings({
    settings: { enabled: true, observer_internal_url: 'http://observer:8080', observer_url: 'https://observer.example' },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'http://observer:8080/api/findings');
      assert.equal(options.headers.accept, 'application/json');
      return {
        ok: true,
        json: async () => ({
          findings: [{
            id: 7,
            hostname: 'Flagged.Example.Test.',
            severity: 'high',
            score: 35,
            status: 'open',
            finding_type: 'commercial_use',
            screenshot_page_url: '/screenshots/abc',
            last_seen_at: '2026-10-02 18:06:14',
          }],
        }),
      };
    },
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].hostname, 'flagged.example.test');
  assert.equal(findings[0].source, 'observer');
  assert.equal(findings[0].screenshot_url, 'https://observer.example/screenshots/abc');
  assert.equal(findings[0].last_seen_at, '2026-10-02 18:06:14');
});

test('observerStatusesByHostname reports worst live severity per subdomain', () => {
  const statuses = observerStatusesByHostname([
    { hostname: 'demo.example.test', severity: 'low', score: 10, last_seen_at: '2026-10-01T00:00:00Z' },
    { hostname: 'demo.example.test', severity: 'critical', score: 80, last_seen_at: '2026-10-02T00:00:00Z' },
    { hostname: 'other.example.test', severity: 'medium', score: 20, last_seen_at: '2026-10-01T00:00:00Z' },
  ]);

  assert.equal(statuses['demo.example.test'].severity, 'critical');
  assert.equal(statuses['demo.example.test'].finding_count, 2);
  assert.equal(statuses['demo.example.test'].score, 80);
  assert.equal(statuses['other.example.test'].severity, 'medium');
});

test('loadObserverFindings merges stored findings with live Observer findings', async () => {
  const result = await loadObserverFindings({
    settings: { enabled: true, observer_internal_url: 'http://observer:8080' },
    storeImpl: {
      list: async (entity, sort, limit) => {
        if (entity === 'ObserverScanState') return [];
        assert.equal(entity, 'ObserverFinding');
        assert.equal(sort, '-created_date');
        assert.equal(limit, 10000);
        return [{ hostname: 'stored.example.test', severity: 'medium', observed_at: '2026-10-01T00:00:00Z' }];
      },
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ findings: [{ hostname: 'live.example.test', severity: 'high', last_seen_at: '2026-10-02 00:00:00' }] }),
    }),
  });

  assert.deepEqual(result.findings.map(finding => finding.hostname), ['live.example.test', 'stored.example.test']);
  assert.equal(result.observer_error, '');
});

test('loadObserverFindings falls back to stored findings when live Observer is unavailable', async () => {
  const result = await loadObserverFindings({
    settings: { enabled: true, observer_internal_url: 'http://observer:8080' },
    storeImpl: { list: async (entity) => entity === 'ObserverScanState' ? [] : [{ hostname: 'stored.example.test', severity: 'medium' }] },
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].hostname, 'stored.example.test');
  assert.match(result.observer_error, /HTTP 503/);
});

test('mergeObserverFindings prefers live Observer data over a duplicate stored finding', () => {
  const merged = mergeObserverFindings(
    [{ hostname: 'same.example.test', url: 'https://same.example.test', finding_type: 'abuse', policy_section: '6', evidence: 'same', source: 'rootminster', observed_at: '2026-10-01T00:00:00Z' }],
    [{ hostname: 'same.example.test', url: 'https://same.example.test', finding_type: 'abuse', policy_section: '6', evidence: 'same', source: 'observer', last_seen_at: '2026-10-02T00:00:00Z' }],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'observer');
});
