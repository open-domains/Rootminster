import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml } from '../../../server/lib/html.js';

test('escapeHtml escapes markup and quote characters', () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('escapeHtml renders empty values as an empty string', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(''), '');
});
