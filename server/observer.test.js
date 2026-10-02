import test from 'node:test';
import assert from 'node:assert/strict';
import { signingHeaders } from './observer.js';

test('observer signing headers match the python client format', () => {
  const headers = signingHeaders('secret', '{}', '123');
  assert.equal(headers['x-observer-id'], 'opendomains-observer');
  assert.equal(headers['x-observer-timestamp'], '123');
  assert.equal(headers['x-observer-signature'], 'sha256=4468c5e304ca107335ae2982d764fdf304214175c7dc3ad06921848d275abb92');
});
