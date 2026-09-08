import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTermsInput } from './terms-routes.js';

const valid = {
  version: '2026-09.1',
  title: 'Terms of Service',
  summary: 'A short summary',
  content: 'These are sufficiently detailed Terms of Service for this validation test.',
};

test('validateTermsInput normalizes a valid draft', () => {
  assert.deepEqual(validateTermsInput({ ...valid, version: ' 2026-09.1 ' }).value, valid);
});

test('validateTermsInput rejects unsafe version identifiers', () => {
  assert.match(validateTermsInput({ ...valid, version: '../current' }).error, /Version/);
  assert.match(validateTermsInput({ ...valid, version: 'a'.repeat(65) }).error, /Version/);
});

test('validateTermsInput requires meaningful bounded content', () => {
  assert.match(validateTermsInput({ ...valid, content: 'short' }).error, /between 50/);
  assert.match(validateTermsInput({ ...valid, summary: 'a'.repeat(2001) }).error, /2,000/);
});
