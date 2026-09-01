import assert from 'node:assert/strict';
import test from 'node:test';
import { disposableEmailResult, parseDisposableDomains } from './lib/disposable-email.js';

test('detects built-in and administrator-configured disposable domains', () => {
  assert.equal(disposableEmailResult('person@mailinator.com', { enabled: true }).disposable, true);
  assert.equal(disposableEmailResult('person@example.com', { enabled: true, additional_domains: 'throw.test, blocked.example' }).disposable, false);
  assert.equal(disposableEmailResult('person@blocked.example', { enabled: true, additional_domains: 'throw.test, blocked.example' }).disposable, true);
});

test('does not enforce disposable detection while the module is disabled', () => {
  assert.equal(disposableEmailResult('person@mailinator.com', { enabled: false }).disposable, false);
  assert.deepEqual([...parseDisposableDomains('@one.example; two.example')], ['one.example', 'two.example']);
});
