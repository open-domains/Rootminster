import assert from 'node:assert/strict';
import test from 'node:test';

import { analyticsDependencyFailure } from './functions/analyticsManager.js';
import { makeUmamiClient } from './functions/analyticsManager.js';

test('makeUmamiClient constructs the current Umami API client', () => {
  const client = makeUmamiClient({
    api_endpoint: 'https://analytics.example.com/api/',
    api_secret: 'umami_test_token',
  });

  assert.equal(typeof client.createWebsite, 'function');
  assert.equal(typeof client.getWebsiteStats, 'function');
  assert.equal(typeof client.getWebsitePageviews, 'function');
  assert.equal(typeof client.getWebsiteMetrics, 'function');
});

test('analytics dependency auth failures are client-visible non-500 errors', () => {
  const cause = Object.assign(new Error('Unauthorized'), { status: 401 });

  const error = analyticsDependencyFailure('Could not load analytics summary', cause);

  assert.equal(error.status, 424);
  assert.equal(error.message, 'Could not load analytics summary: Analytics provider rejected the configured API credentials');
});
