import assert from 'node:assert/strict';
import test from 'node:test';

import { readStoredPreference, writeStoredPreference } from '../src/lib/stored-preference.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    data,
  };
};

const STATUSES = ['all', 'pending', 'approved', 'rejected', 'needs_info'];

test('returns a remembered value that is still allowed', () => {
  const storage = memoryStorage({ filter: 'needs_info' });
  assert.equal(readStoredPreference(storage, 'filter', STATUSES, 'all'), 'needs_info');
});

test('falls back when nothing is stored or the stored value is unknown', () => {
  assert.equal(readStoredPreference(memoryStorage(), 'filter', STATUSES, 'all'), 'all');
  assert.equal(readStoredPreference(memoryStorage({ filter: 'archived' }), 'filter', STATUSES, 'all'), 'all');
});

test('falls back when storage is unavailable or throws', () => {
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(readStoredPreference(null, 'filter', STATUSES, 'pending'), 'pending');
  assert.equal(readStoredPreference(blocked, 'filter', STATUSES, 'pending'), 'pending');
  assert.doesNotThrow(() => writeStoredPreference(blocked, 'filter', 'approved'));
});

test('writes the chosen value so the next read returns it', () => {
  const storage = memoryStorage();
  writeStoredPreference(storage, 'filter', 'rejected');
  assert.equal(readStoredPreference(storage, 'filter', STATUSES, 'all'), 'rejected');
});
