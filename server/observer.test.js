import test from 'node:test';
import assert from 'node:assert/strict';
import { signingHeaders, observerScanUrl, scanObserverTarget, scanAllObserverTargets } from './observer.js';

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

test('scanAllObserverTargets asks Observer to scan every Rootminster target', async () => {
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
});
