import assert from 'node:assert/strict';
import test from 'node:test';
import { contactEmailBody, validateContactInput } from '../../server/routes/contact-routes.js';

test('validateContactInput trims fields and requires subject, message and a valid email', () => {
  assert.deepEqual(validateContactInput({ name: ' Ada ', email: ' ada@example.com ', subject: ' Hi ', message: ' Hello ' }), {
    name: 'Ada', email: 'ada@example.com', subject: 'Hi', message: 'Hello',
  });
  assert.throws(() => validateContactInput({ email: 'ada@example.com', message: 'x' }), { status: 400 });
  assert.throws(() => validateContactInput({ email: 'not-an-email', subject: 'x', message: 'x' }), { status: 400 });
});

test('validateContactInput caps field lengths', () => {
  const result = validateContactInput({ email: 'a@b.co', subject: 's'.repeat(500), message: 'm'.repeat(20_000) });
  assert.equal(result.subject.length, 200);
  assert.equal(result.message.length, 10_000);
});

test('contactEmailBody escapes everything the visitor typed', () => {
  const body = contactEmailBody({ name: '<b>x</b>', email: 'a@b.co', subject: '<script>', message: 'line1\n<img src=x>' });
  assert.doesNotMatch(body, /<script>|<img|<b>x/);
  assert.match(body, /line1<br>&lt;img src=x&gt;/);
});
