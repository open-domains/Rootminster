import assert from 'node:assert/strict';
import test from 'node:test';
import { hiddenReason, normaliseTags, openReportHostSet, publicListing, validateListing } from '../../../server/lib/showcase.js';
import { refreshShowcaseHealth } from '../../../server/lib/showcase-health.js';

test('listings are short text with no links', () => {
  assert.deepEqual(validateListing({ title: ' My  App ', description: 'A tiny tool for notes', tags: 'Notes, notes, JS, a, b, c, d', show_owner: 'yes' }).listing, {
    title: 'My App', description: 'A tiny tool for notes', tags: ['notes', 'js', 'a', 'b', 'c'], show_owner: false,
  });
  assert.match(validateListing({ title: 'x', description: 'long enough text' }).error, /title/);
  assert.match(validateListing({ title: 'App', description: 'short' }).error, /description/);
  assert.match(validateListing({ title: 'App', description: 'visit https://spam.example now' }).error, /links/);
  assert.deepEqual(normaliseTags(['<b>Rust</b>', 'C++', 'node.js']), ['brustb', 'c++', 'node.js']);
});

test('approved listings hide when suspended, reported or unhealthy', () => {
  const entry = { status: 'approved', hostname: 'a.example.org' };
  const ownership = { status: 'active' };
  assert.equal(hiddenReason(entry, { ownership }), null);
  assert.equal(hiddenReason({ ...entry, status: 'pending' }, { ownership }), 'not_approved');
  assert.equal(hiddenReason(entry, { ownership: { status: 'suspended' } }), 'suspended');
  assert.equal(hiddenReason(entry, { ownership: null }), 'suspended');
  assert.equal(hiddenReason(entry, { ownership, openReportHosts: openReportHostSet([{ normalized_host: 'a.example.org', status: 'investigating' }]) }), 'abuse_report');
  assert.equal(hiddenReason(entry, { ownership, openReportHosts: openReportHostSet([{ normalized_host: 'a.example.org', status: 'dismissed' }]) }), null);
  assert.equal(hiddenReason({ ...entry, health_status: 'warning' }, { ownership }), 'health_check');
});

test('the public view never includes owner contact details', () => {
  const entry = { hostname: 'a.example.org', title: 'A', description: 'Desc', tags: ['x'], owner_email: 'o@example.com', owner_id: 'u1', show_owner: false };
  const view = publicListing(entry, { full_name: 'Owner Name', email: 'o@example.com' });
  assert.equal(view.owner, null);
  assert.equal(JSON.stringify(view).includes('o@example.com'), false);
  assert.equal(publicListing({ ...entry, show_owner: true }, { full_name: 'Owner Name' }).owner, 'Owner Name');
});

test('health refresh only hides listings on a definite warning', async () => {
  const updates = {};
  const store = {
    filter: async (entity) => entity === 'ShowcaseEntry'
      ? [{ id: 'e1', hostname: 'a.example.org', owner_id: 'u1' }, { id: 'e2', hostname: 'b.example.org', owner_id: 'u1' }, { id: 'e3', hostname: 'c.example.org', owner_id: 'u1' }]
      : [],
    update: async (_entity, id, data) => { updates[id] = data.health_status; },
  };
  const check = async (hostname) => {
    if (hostname === 'c.example.org') throw new Error('resolver down');
    return { status: hostname === 'a.example.org' ? 'warning' : 'pass' };
  };
  const summary = await refreshShowcaseHealth({ store, check });
  assert.deepEqual(updates, { e1: 'warning', e2: 'ok', e3: 'ok' });
  assert.equal(summary.hidden, 1);
});
