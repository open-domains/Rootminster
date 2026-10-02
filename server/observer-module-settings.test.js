import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_DEFINITIONS } from './module-settings.js';


test('observer module exposes separate staff and internal URLs', () => {
  const observer = MODULE_DEFINITIONS.observer;
  assert(observer.fields.some(field => field.key === 'observer_url'));
  assert(observer.fields.some(field => field.key === 'observer_internal_url'));

  const env = observer.env();
  assert.equal(env.observer_internal_url, process.env.OBSERVER_INTERNAL_URL || env.observer_url);
});
