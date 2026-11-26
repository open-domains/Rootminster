import assert from 'node:assert/strict';
import test from 'node:test';
import { blockedFeedTarget, checkThreats, feedLineHost, matchKey, parseFeed, recordTargetHost, safeBrowsingLookup } from '../../../server/lib/threat-intel.js';
import { checkRequestThreats, groupMatches, newMatchesForSite } from '../../../server/lib/threat-intel-scan.js';

function fakeDb(listed = {}) {
  return {
    async query(sql, values) {
      if (sql.startsWith('SELECT host, source')) {
        return { rows: values[0].flatMap((host) => (listed[host] || []).map((source) => ({ host, source }))) };
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

test('feed lines in hosts, URL and bare formats reduce to hosts', () => {
  assert.equal(feedLineHost('127.0.0.1\tEvil.Example.com'), 'evil.example.com');
  assert.equal(feedLineHost('https://phish.example.net/login.php?a=1'), 'phish.example.net');
  assert.equal(feedLineHost('203.0.113.9'), '203.0.113.9');
  for (const junk of ['# comment', '', 'localhost', '127.0.0.1 localhost', 'not a host']) assert.equal(feedLineHost(junk), null, junk);
});

test('shared hosting suffixes and ignored hosts are never imported', () => {
  const hosts = parseFeed('127.0.0.1 github.io\n127.0.0.1 bad.github.io\nhttps://pages.dev/x\nok.example.com\nfine.example.com', { ignored: ['fine.example.com'] });
  assert.deepEqual([...hosts].sort(), ['bad.github.io', 'ok.example.com']);
});

test('record targets are extracted by type', () => {
  assert.equal(recordTargetHost('CNAME', 'Target.Example.com.'), 'target.example.com');
  assert.equal(recordTargetHost('MX', '10 mail.example.com'), 'mail.example.com');
  assert.equal(recordTargetHost('SRV', '10 5 25565 mc.example.com'), 'mc.example.com');
  assert.equal(recordTargetHost('A', '203.0.113.9'), '203.0.113.9');
  assert.equal(recordTargetHost('TXT', 'v=spf1'), null);
});

test('only hostname targets on a feed are blocked, and only when enabled', async () => {
  const db = fakeDb({ 'evil.example.com': ['urlhaus'], '203.0.113.9': ['urlhaus'] });
  const settings = { enabled: true, block_feed_targets: true, ignored_hosts: '' };
  assert.deepEqual(await blockedFeedTarget({ db, settings, type: 'CNAME', content: 'evil.example.com' }), { target: 'evil.example.com', sources: ['urlhaus'] });
  assert.equal(await blockedFeedTarget({ db, settings, type: 'A', content: '203.0.113.9' }), null);
  assert.equal(await blockedFeedTarget({ db, settings: { ...settings, block_feed_targets: false }, type: 'CNAME', content: 'evil.example.com' }), null);
  assert.equal(await blockedFeedTarget({ db, settings: { ...settings, ignored_hosts: 'evil.example.com' }, type: 'CNAME', content: 'evil.example.com' }), null);
});

test('Safe Browsing lookups are batched and parsed', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(JSON.parse(options.body).threatInfo.threatEntries.length);
    return { ok: true, json: async () => ({ matches: [{ threatType: 'SOCIAL_ENGINEERING', threat: { url: 'http://bad.example.com/' } }] }) };
  };
  const urls = Array.from({ length: 600 }, (_, i) => `http://h${i}.example.com/`);
  const found = await safeBrowsingLookup([...urls, 'http://bad.example.com/'], 'key', { fetchImpl });
  assert.deepEqual(calls, [500, 101]);
  assert.deepEqual(found.get('http://bad.example.com/'), ['SOCIAL_ENGINEERING']);
  assert.equal((await safeBrowsingLookup(urls, '', { fetchImpl })).size, 0);
});

test('checkThreats reports site and target matches against the owning site', async () => {
  const db = fakeDb({ 'site.example.org': ['openphish'], 'evil.example.com': ['urlhaus'] });
  const matches = await checkThreats({ db, settings: { ignored_hosts: '' }, sites: ['site.example.org'], targets: [{ host: 'other.example.org', target: 'evil.example.com' }, { host: 'x.example.org', target: 'github.io' }] });
  assert.deepEqual(matches.map((match) => [match.host, match.kind, match.source]), [['site.example.org', 'site', 'openphish'], ['other.example.org', 'target', 'urlhaus']]);
});

test('known matches are not reported twice', () => {
  const now = new Date('2026-11-24T00:00:00Z');
  const match = { host: 'a.example.org', indicator: 'evil.example.com', kind: 'target', source: 'urlhaus' };
  const other = { ...match, indicator: 'worse.example.com' };
  const grouped = groupMatches([match, match, other]);
  assert.equal(grouped.get('a.example.org').length, 2);
  assert.deepEqual(newMatchesForSite([match, other], [{ status: 'open', threat_intel_keys: [matchKey(match)] }], now), [other]);
  assert.deepEqual(newMatchesForSite([match], [{ status: 'dismissed', status_changed_at: '2026-11-20T00:00:00Z', threat_intel_keys: [matchKey(match)] }], now), []);
  assert.deepEqual(newMatchesForSite([match], [{ status: 'dismissed', status_changed_at: '2026-09-01T00:00:00Z', threat_intel_keys: [matchKey(match)] }], now), [match]);
});

test('request checks never throw and are skipped when the module is off', async () => {
  const request = { subdomain: 'demo', root_domain: 'example.org', record_type: 'CNAME', record_value: 'evil.example.com' };
  assert.deepEqual(await checkRequestThreats({ db: fakeDb(), settings: { enabled: false }, request }), { matches: [], error: null });
  const broken = { query: async () => { throw new Error('db down'); } };
  assert.deepEqual(await checkRequestThreats({ db: broken, settings: { enabled: true }, request }), { matches: [], error: 'db down' });
  const hit = await checkRequestThreats({ db: fakeDb({ 'evil.example.com': ['urlhaus'] }), settings: { enabled: true, ignored_hosts: '' }, request });
  assert.equal(hit.matches[0].indicator, 'evil.example.com');
});
