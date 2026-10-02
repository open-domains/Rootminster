import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';


test('job runner schedules Observer full scan every 30 days', async () => {
  const jobs = await readFile(new URL('./jobs.js', import.meta.url), 'utf8');
  assert.match(jobs, /cron\.schedule\('0 4 \*\/30 \* \*', \(\) => run\('observerScanAll'\)/);
});
