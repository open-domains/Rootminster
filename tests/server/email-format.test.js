import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEmailParts, emailDocument, htmlToText, isHtmlDocument } from '../../server/lib/email-format.js';

test('htmlToText keeps links, paragraphs and line breaks', () => {
  const html = '<p>Hi <b>Sam</b>,</p><p><a href="https://x.test/login" style="color:red">Sign in</a></p><p>Copy:<br><a href="https://x.test/a?b=1&amp;c=2">https://x.test/a?b=1&amp;c=2</a></p><ul><li>One</li><li>Two</li></ul>';
  assert.equal(htmlToText(html), 'Hi Sam,\n\nSign in: https://x.test/login\n\nCopy:\nhttps://x.test/a?b=1&c=2\n\n- One\n- Two');
});

test('htmlToText drops the head and hidden preheader', () => {
  const text = htmlToText(emailDocument({ bodyHtml: '<p>Body</p>', subject: 'Subject', preheader: 'Hidden summary' }));
  assert.ok(!text.includes('Hidden summary'));
  assert.ok(!text.includes('Subject'));
  assert.match(text, /Body/);
});

test('emailDocument is a complete, branded and escaped document', () => {
  const html = emailDocument({ bodyHtml: '<p>Hello</p>', subject: 'A <b> subject', platformName: 'Open <Domains>', appUrl: 'https://open-domains.test', preheader: 'Pre' });
  assert.ok(isHtmlDocument(html));
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<title>A &lt;b&gt; subject<\/title>/);
  assert.match(html, /Open &lt;Domains&gt;/);
  assert.match(html, /<p>Hello<\/p>/);
  assert.match(html, /open-domains\.test<\/a>/);
});

test('buildEmailParts wraps fragments, keeps full documents and prefers given text', () => {
  const parts = buildEmailParts({ subject: 'S', body: '<p>Hi</p>', platformName: 'Open Domains', appUrl: 'https://o.test' });
  assert.ok(isHtmlDocument(parts.html));
  assert.equal(parts.text, 'Hi\n\n--\nOpen Domains\nhttps://o.test');
  const doc = '<!DOCTYPE html><html><body><p>Hi</p></body></html>';
  assert.equal(buildEmailParts({ subject: 'S', body: doc, platformName: 'X' }).html, doc);
  assert.equal(buildEmailParts({ subject: 'S', body: '<p>Hi</p>', text: 'Own text', platformName: 'X' }).text, 'Own text');
});
