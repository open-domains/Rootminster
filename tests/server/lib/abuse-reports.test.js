import assert from 'node:assert/strict';
import test from 'node:test';
import { closedEmail, findReporter, isOpenReport, mergedReportUpdate, newReporterSecret, parseStatusToken, publicReportStatus, reportedHostname, reporterEntry, reportersToNotify, statusToken } from '../../../server/lib/abuse-reports.js';

test('reported URLs and hostnames reduce to the same host', () => {
  for (const value of ['Phish.Example.com', 'https://phish.example.com/login?x=1', 'phish.example.com.', 'http://phish.example.com:8080/a', ' phish.example.com/path ']) {
    assert.equal(reportedHostname(value), 'phish.example.com', value);
  }
  assert.equal(reportedHostname(''), '');
});

test('later reports merge into the open report and keep the first text', () => {
  const existing = { id: 'r1', description: 'first', report_count: 1, reporters: [{ email: 'a@example.com', token_hash: 'h1' }], merged_reports: [] };
  const update = mergedReportUpdate(existing, { abuse_type: 'Phishing', description: 'second', reporter_email: 'b@example.com' }, { email: 'b@example.com', token_hash: 'h2' }, new Date('2026-11-24T10:00:00Z'));
  assert.equal(update.report_count, 2);
  assert.equal(update.reporters.length, 2);
  assert.equal(update.merged_reports[0].description, 'second');
  assert.equal('description' in update, false);
  assert.equal(isOpenReport({ status: 'investigating' }), true);
  assert.equal(isOpenReport({ status: 'resolved' }), false);
});

test('status tokens only open the report they were issued for', () => {
  const id = '5b0f7f1e-3c1a-4d2b-9f3e-1a2b3c4d5e6f';
  const { secret, hash } = newReporterSecret();
  const report = { id, reporters: [reporterEntry({ email: '', tokenHash: hash })] };
  const parsed = parseStatusToken(statusToken(id, secret));
  assert.equal(parsed.reportId, id);
  assert.ok(findReporter(report, parsed.secret));
  assert.equal(findReporter(report, `${secret}x`), null);
  assert.equal(parseStatusToken('not-a-token'), null);
  assert.equal(parseStatusToken(`${id}.short`), null);
});

test('reporters see the status only', () => {
  const view = publicReportStatus({ subdomain: 'https://x.example.com', normalized_host: 'x.example.com', abuse_type: 'Spam', status: 'dismissed', admin_notes: 'secret', reporters: [{ email: 'a@example.com' }] });
  assert.deepEqual(Object.keys(view).sort(), ['abuse_type', 'closed', 'status', 'status_label', 'subdomain', 'submitted_at', 'updated_at']);
  assert.equal(view.closed, true);
  assert.equal(JSON.stringify(view).includes('secret'), false);
});

test('closing a report notifies each reporter with an email once', () => {
  const report = { reporters: [{ email: 'a@example.com', notified_status: null }, { email: '', notified_status: null }, { email: 'b@example.com', notified_status: 'resolved' }] };
  assert.deepEqual(reportersToNotify(report, 'resolved').map((item) => item.email), ['a@example.com']);
  assert.deepEqual(reportersToNotify(report, 'investigating'), []);
  assert.match(closedEmail({ host: '<b>x</b>', status: 'resolved' }).body, /&lt;b&gt;x&lt;\/b&gt;/);
});
