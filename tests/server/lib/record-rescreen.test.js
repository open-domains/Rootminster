import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRecordChange, heldChangeMessage, screenRecordChange, shouldRescreen } from '../../../server/lib/record-rescreen.js';

const user = { id: 'u1', email: 'u@example.com', role: 'user', created_date: '2025-01-01T00:00:00Z' };

test('only user changes to where a record points are re-screened', () => {
  const old = { id: 'r1', record_type: 'CNAME', content: 'a.example.com' };
  assert.equal(shouldRescreen({ user, action: 'update', old, candidate: { ...old, content: 'b.example.com' } }), true);
  assert.equal(shouldRescreen({ user, action: 'update', old, candidate: { ...old, content: 'A.example.com', ttl: 60 } }), false);
  assert.equal(shouldRescreen({ user, action: 'create', candidate: { record_type: 'A', content: '203.0.113.1' } }), true);
  assert.equal(shouldRescreen({ user, action: 'create', candidate: { record_type: 'TXT', content: 'x' } }), false);
  assert.equal(shouldRescreen({ user: { ...user, role: 'staff' }, action: 'create', candidate: { record_type: 'A', content: '203.0.113.1' } }), false);
  assert.equal(shouldRescreen({ user: { ...user, trusted_source: 'dynamic-dns' }, action: 'update', old: { record_type: 'A', content: '203.0.113.1' }, candidate: { record_type: 'A', content: '203.0.113.2' } }), false);
  assert.equal(shouldRescreen({ user: { ...user, trusted_source: 'api' }, action: 'update', old, candidate: { ...old, content: 'b.example.com' } }), true);
});

test('a threat match holds the change; account age alone never does', () => {
  const candidate = { record_type: 'MX', content: '10 mail.example.com' };
  const fresh = { ...user, created_date: new Date().toISOString() };
  assert.equal(assessRecordChange({ candidate, user: fresh }).hold, false);
  const held = assessRecordChange({ candidate, user, threatMatches: [{ detail: 'URLhaus lists mail.example.com' }] });
  assert.equal(held.hold, true);
  assert.match(heldChangeMessage(held), /sent to staff for review \(target is on a threat list\)/);
});

test('screening looks the target up in the feeds and tolerates lookup failures', async () => {
  const candidate = { name: 'www.demo.example.org', record_type: 'CNAME', content: 'evil.example.com' };
  const db = { query: async (_sql, values) => ({ rows: values[0].includes('evil.example.com') ? [{ host: 'evil.example.com', source: 'urlhaus' }] : [] }) };
  const settings = { enabled: true, ignored_hosts: '' };
  assert.equal((await screenRecordChange({ db, settings, user, candidate, siteHost: 'demo.example.org' })).hold, true);
  assert.equal((await screenRecordChange({ db, settings: { enabled: false }, user, candidate })).hold, false);
  const broken = { query: async () => { throw new Error('down'); } };
  assert.equal((await screenRecordChange({ db: broken, settings, user, candidate })).hold, false);
});
