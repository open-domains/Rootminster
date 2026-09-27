import assert from 'node:assert/strict';
import test from 'node:test';

import { displayText, initialText } from '../src/lib/display-text.js';

test('displayText returns React-safe text for structured error objects', () => {
  assert.equal(displayText({ code: 'invalid_email', message: 'Email unavailable' }, 'Unknown'), 'Email unavailable');
});

test('displayText returns fallback for unsupported structured values', () => {
  assert.equal(displayText({ code: 'invalid_email' }, 'Unknown'), 'Unknown');
});

test('initialText derives initials from React-safe display text', () => {
  assert.equal(initialText({ code: 'invalid_email', message: 'Email unavailable' }, 'person@example.com'), 'E');
});
