import assert from 'node:assert/strict';
import test from 'node:test';
import { createDnsBackup, parseDnsBackup } from '../src/lib/dns-transfer.js';

test('DNS backup exports only portable scoped record data', () => {
  const result = createDnsBackup('demo.example.com', [{
    id: 'secret-id', owner_id: 'user-id', cloudflare_record_id: 'cf-id',
    name: 'www.demo.example.com', record_type: 'CNAME', content: 'example.net', ttl: 300, proxied: true,
  }], '2026-09-08T00:00:00.000Z');
  assert.deepEqual(result.records, [{ name: 'www', type: 'CNAME', content: 'example.net', ttl: 300, proxied: true }]);
  assert.equal(JSON.stringify(result).includes('secret-id'), false);
});

test('DNS backup import is bound to the domain being managed', () => {
  const backup = createDnsBackup('demo.example.com', []);
  assert.throws(() => parseDnsBackup(JSON.stringify(backup), 'other.example.com'), /belongs to demo\.example\.com/);
});

test('DNS backup import rejects oversized batches and invalid TTLs', () => {
  const backup = createDnsBackup('demo.example.com', []);
  backup.records = Array.from({ length: 101 }, () => ({ name: '@', type: 'A', content: '192.0.2.1', ttl: 300 }));
  assert.throws(() => parseDnsBackup(JSON.stringify(backup), 'demo.example.com'), /no more than 100/);
  backup.records = [{ name: '@', type: 'A', content: '192.0.2.1', ttl: 2 }];
  assert.throws(() => parseDnsBackup(JSON.stringify(backup), 'demo.example.com'), /invalid TTL/);
});

test('DNS backup preserves MX priority in portable content', () => {
  const backup = createDnsBackup('demo.example.com', [{
    name: 'demo.example.com', record_type: 'MX', content: 'mail.example.com', priority: 20, ttl: 3600,
  }]);
  assert.equal(backup.records[0].content, '20 mail.example.com');
  assert.equal(parseDnsBackup(JSON.stringify(backup), 'demo.example.com').records[0].content, '20 mail.example.com');
});
