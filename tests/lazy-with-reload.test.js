import assert from 'node:assert/strict';
import test from 'node:test';

import { isChunkLoadError } from '../src/lib/lazyWithReload.js';

test('treats JavaScript MIME fallback errors as chunk load errors', () => {
  assert.equal(isChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type for module script 'https://open-domains.com/assets/Analytics-BxkjutIS.js'.")), true);
});

test('does not treat unrelated errors as chunk load errors', () => {
  assert.equal(isChunkLoadError(new Error('Invalid analytics response')), false);
});
