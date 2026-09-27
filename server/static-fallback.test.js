import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldServeSpaFallback } from './static-fallback.js';

test('serves the SPA fallback for application routes', () => {
  assert.equal(shouldServeSpaFallback('/analytics'), true);
  assert.equal(shouldServeSpaFallback('/settings?section=privacy'), true);
});

test('does not serve index.html for missing built assets', () => {
  assert.equal(shouldServeSpaFallback('/assets/Analytics-BxkjutIS.js'), false);
  assert.equal(shouldServeSpaFallback('/assets/index-BRWNzUOi.css'), false);
});

test('does not serve the SPA fallback for API and function paths', () => {
  assert.equal(shouldServeSpaFallback('/api/auth/me'), false);
  assert.equal(shouldServeSpaFallback('/functions/analyticsManager'), false);
});
