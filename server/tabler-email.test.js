import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTablerEmail, emailPlainText } from './lib/tabler-email.js';

test('wraps both fragments and full documents in one email shell', () => {
  for (const body of ['<p>Ready</p>', '<!doctype html><html><head><style>body{color:red}</style></head><body><p>Ready</p></body></html>']) {
    const output = renderTablerEmail('Status <updated>', body);
    assert.equal((output.match(/<html\b/g) || []).length, 1);
    assert.match(output, /Open Domains/);
    assert.match(output, /<p>Ready<\/p>/);
    assert.match(output, /Status &lt;updated&gt;/);
    assert.doesNotMatch(output, /body\{color:red\}/);
  }
});

test('plain text includes content without markup styles', () => {
  assert.equal(emailPlainText('<style>p{color:red}</style><p>Hello &amp; welcome</p><p>Next</p>'), 'Hello & welcome\n Next');
});
