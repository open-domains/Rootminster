import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('weekly Discord stats use complete database counts and durable deduplication', async () => {
  const [handler, schema] = await Promise.all([
    readFile(new URL('./functions/weeklyStatsDiscord.js', import.meta.url), 'utf8'),
    readFile(new URL('./schema.sql', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(handler, /entities\.(?:SubdomainRequest|DnsRecord|User)\.list\(/);
  assert.match(handler, /count\(\*\).*entity_type = 'DnsRecord'/s);
  assert.match(handler, /SELECT count\(\*\) AS new_users FROM users WHERE created_at >= \$1/);
  assert.match(handler, /ON CONFLICT \(notification_key\) DO UPDATE/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS scheduled_notifications/);
});
