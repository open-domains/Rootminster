import test from 'node:test';
import assert from 'node:assert/strict';
import * as templates from '../../shared/email-templates.js';
import { acknowledgementEmail, closedEmail } from '../../server/lib/abuse-reports.js';
import { inactivityEmail } from '../../server/lib/inactive-accounts.js';
import { buildEmailParts } from '../../server/lib/email-format.js';

const APP = 'https://open-domains.test';
const EVIL = '<script>alert(1)</script><a href="https://spam.example">win</a>';

// One sample of every email, filled with hostile values wherever a person
// (user, visitor or staff) can type text.
export function sampleEmails() {
  return {
    verification: templates.verificationEmail({ platform: 'Open Domains', verificationUrl: `${APP}/verify-email?token=abc` }),
    passwordReset: templates.passwordResetEmail({ platform: 'Open Domains', resetUrl: `${APP}/reset-password?token=abc` }),
    deletionApproved: templates.accountDeletionOutcomeEmail({ platform: 'Open Domains', approved: true }),
    deletionDenied: templates.accountDeletionOutcomeEmail({ platform: 'Open Domains', approved: false, reason: EVIL }),
    migrationCode: templates.migrationCodeEmail({ platform: 'Open Domains', oldEmail: EVIL, code: '123456' }),
    domainsMigrated: templates.domainsMigratedEmail({ platform: 'Open Domains', appUrl: APP, domains: [{ full_name: EVIL, type: 'A' }, { full_name: 'b.example.com', type: 'CNAME' }] }),
    legacyDonor: templates.legacyDonorEmail({ platform: 'Open Domains', appUrl: APP, fromMigration: true }),
    requestApproved: templates.requestApprovedEmail({ platform: 'Open Domains', appUrl: APP, hostname: 'blog.example.com', recordType: 'CNAME', recordValue: EVIL }),
    requestRejected: templates.requestRejectedEmail({ platform: 'Open Domains', appUrl: APP, hostname: 'blog.example.com', reason: EVIL, reviewerName: EVIL }),
    requestQuestion: templates.requestQuestionEmail({ platform: 'Open Domains', appUrl: APP, hostname: 'blog.example.com', question: `${EVIL}\nsecond line` }),
    requestPaused: templates.requestPausedEmail({ appUrl: APP, hostname: 'blog.example.com' }),
    heldDnsApproved: templates.heldDnsChangeEmail({ appUrl: APP, hostname: 'blog.example.com', recordType: 'A', content: '192.0.2.1', approved: true }),
    heldDnsRejected: templates.heldDnsChangeEmail({ appUrl: APP, hostname: 'blog.example.com', recordType: 'TXT', content: EVIL, approved: false, note: EVIL }),
    showcaseApproved: templates.showcaseReviewEmail({ appUrl: APP, hostname: 'blog.example.com', approved: true }),
    showcaseRejected: templates.showcaseReviewEmail({ appUrl: APP, hostname: 'blog.example.com', approved: false, note: EVIL }),
    abuseStaffAlert: templates.abuseReportStaffEmail({ platform: 'Open Domains', appUrl: APP, subdomain: 'bad.example.com', abuseType: 'phishing', reporter: EVIL, description: EVIL, evidence: EVIL }),
    abuseAcknowledgement: acknowledgementEmail({ host: 'bad.example.com', statusUrl: `${APP}/report-abuse/status/abc` }),
    abuseClosed: closedEmail({ host: 'bad.example.com', status: 'resolved', statusUrl: `${APP}/report-abuse/status/abc` }),
    inactivityNotice: inactivityEmail('notice', { appUrl: APP, closesAt: '2026-12-27T03:45:00Z', lastActivityAt: '2025-11-02T00:00:00Z' }),
    inactivityReminder: inactivityEmail('reminder', { appUrl: APP, closesAt: '2026-12-27T03:45:00Z' }),
    inactivityClosed: inactivityEmail('closed', { appUrl: APP }),
  };
}

const EMOJI = /[\u{1F300}-\u{1FAFF}☀-➿⭐✅]/u;

test('every email has a plain subject and a fragment body', () => {
  for (const [name, email] of Object.entries(sampleEmails())) {
    assert.ok(email.subject && email.subject.length <= 300, `${name} subject`);
    assert.doesNotMatch(email.subject, EMOJI, `${name} subject has emoji`);
    assert.doesNotMatch(email.subject, /!|\[[A-Z ]+\]|\b[A-Z]{4,}\b/, `${name} subject shouts`);
    assert.ok(email.preheader, `${name} preheader`);
    assert.doesNotMatch(email.body, /<!doctype|<html|<body|<style/i, `${name} builds its own document`);
    assert.doesNotMatch(email.body, EMOJI, `${name} body has emoji`);
    assert.doesNotMatch(email.body, /gradient|text-transform:\s*uppercase/i, `${name} body styling`);
  }
});

test('every link points at the site itself', () => {
  for (const [name, email] of Object.entries(sampleEmails())) {
    const hrefs = [...email.body.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
    for (const href of hrefs) assert.ok(href.startsWith(`${APP}/`), `${name} links to ${href}`);
    assert.doesNotMatch(email.body, /open\.domains|opendomains\.uk/, `${name} names another domain`);
  }
});

test('typed text is escaped everywhere it appears', () => {
  for (const [name, email] of Object.entries(sampleEmails())) {
    assert.ok(!email.body.includes('<script>'), `${name} has a raw script tag`);
    assert.ok(!email.body.includes('href="https://spam.example"'), `${name} has a raw link`);
  }
});

test('the verification email carries no text a stranger could choose', () => {
  const email = templates.verificationEmail({ platform: 'Open Domains', verificationUrl: `${APP}/verify-email?token=abc` });
  assert.match(email.body, /^<p[^>]*>Hi,<\/p>/);
  assert.match(email.subject, /^Confirm your email address/);
});

test('buttons write their address out and the text part keeps the link', () => {
  const email = templates.passwordResetEmail({ platform: 'Open Domains', resetUrl: `${APP}/reset-password?token=a&b` });
  assert.match(email.body, /href="https:\/\/open-domains\.test\/reset-password\?token=a&amp;b"/);
  assert.match(email.body, />https:\/\/open-domains\.test\/reset-password\?token=a&amp;b<\/a>/);
  const parts = buildEmailParts({ subject: email.subject, body: email.body, platformName: 'Open Domains', appUrl: APP });
  assert.match(parts.html, /^<!DOCTYPE html>/);
  assert.match(parts.text, /https:\/\/open-domains\.test\/reset-password\?token=a&b/);
});

test('siteUrl joins without doubled slashes', () => {
  assert.equal(templates.siteUrl('https://a.test/', '/login'), 'https://a.test/login');
  assert.equal(templates.siteUrl('', '/login'), '/login');
});
