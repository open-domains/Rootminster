import assert from 'node:assert/strict';
import test from 'node:test';

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
