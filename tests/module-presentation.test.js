import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleCategory, moduleStatus } from '../src/lib/module-presentation.js';

test('disabled modules do not report incomplete configuration as an active problem', () => {
  assert.equal(moduleStatus({ enabled: false, fields: [{ required: true, value: '' }] }).key, 'disabled');
});
test('stored masked secrets count as configured without returning credentials', () => {
  assert.equal(moduleStatus({ enabled: true, fields: [{ type: 'secret', required: true, value: '', configured: true }] }).key, 'configured');
});
test('missing required fields need attention; optional blanks and zero do not', () => {
  const missing = { label: 'Token', type: 'secret', required: true, configured: false };
  assert.deepEqual(moduleStatus({ enabled: true, fields: [missing, { required: false, value: '' }] }).missing, [missing]);
  assert.equal(moduleStatus({ enabled: true, fields: [{ required: true, value: 0 }, { required: false, value: '' }] }).key, 'configured');
  assert.equal(moduleStatus({ enabled: true, fields: [{ required: true, value: '  ' }] }).key, 'attention');
});
test('new module types remain visible in an Other category', () => {
  assert.equal(moduleCategory({ id: 'future_module' }), 'Other');
  assert.equal(moduleCategory({ id: 'cloudflare' }), 'DNS');
});
