import assert from 'node:assert/strict';
import test from 'node:test';
import { describeHostingerMailError, displayNameFor, normaliseRecipients, resolveHostingerMailbox, sendHostingerMail } from '../../server/integrations/hostinger-mail.js';

const settings = { enabled: true, api_token: 'secret-token', mailbox_resource_id: 'mbx_1', display_name: '' };

function fakeClient({ send, me } = {}) {
  const calls = [];
  return {
    calls,
    send: { sendEmail: async (id, request) => { calls.push({ id, request }); if (send) return send(); return { status: 204 }; } },
    account: { getCurrentAccount: async () => (me ? me() : { data: { data: { orderResourceId: 'o1', mailboxes: [{ resourceId: 'mbx_1', address: 'no-reply@example.com' }] } } }) },
  };
}

function axiosError(status, data) {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data }, config: { headers: { Authorization: 'Bearer secret-token' } } });
}

test('normaliseRecipients accepts strings, lists, named addresses and arrays', () => {
  assert.deepEqual(normaliseRecipients('A@Example.com'), ['a@example.com']);
  assert.deepEqual(normaliseRecipients('a@example.com, Bob <b@example.com>; a@example.com'), ['a@example.com', 'b@example.com']);
  assert.deepEqual(normaliseRecipients(['a@example.com', '', 'c@example.org']), ['a@example.com', 'c@example.org']);
  assert.throws(() => normaliseRecipients('not-an-address'), /Invalid recipient/);
});

test('sendHostingerMail posts to the configured mailbox with html, text and display name', async () => {
  const client = fakeClient();
  const result = await sendHostingerMail(settings, { to: 'user@example.com', subject: 'Hello', body: '<p>Hi <b>there</b></p>', displayName: 'Open Domains' }, { mailClient: client });
  assert.deepEqual(result, { accepted: ['user@example.com'], provider: 'hostinger_mail' });
  assert.equal(client.calls[0].id, 'mbx_1');
  assert.deepEqual(client.calls[0].request, { to: ['user@example.com'], subject: 'Hello', html: '<p>Hi <b>there</b></p>', text: 'Hi there', displayName: 'Open Domains' });
});

test('sendHostingerMail refuses empty recipients and hides the token in errors', async () => {
  await assert.rejects(sendHostingerMail(settings, { to: '', subject: 'x', body: 'y' }, { mailClient: fakeClient() }), /no recipients/);
  const client = fakeClient({ send: () => { throw axiosError(422, { message: 'Invalid payload', params: { to: ['must be an email'] } }); } });
  await assert.rejects(sendHostingerMail(settings, { to: 'a@example.com', subject: 'x', body: 'y' }, { mailClient: client }), (error) => {
    assert.match(error.message, /422 \(the message failed validation\): Invalid payload \[to: must be an email\]/);
    assert.doesNotMatch(error.message, /secret-token/);
    assert.equal(error.status, 400);
    return true;
  });
});

test('describeHostingerMailError explains auth failures and timeouts', () => {
  assert.match(describeHostingerMailError(axiosError(401, {})), /401 \(the API token is missing or invalid\)/);
  assert.match(describeHostingerMailError(axiosError(403, {})), /cannot manage this mailbox/);
  assert.equal(describeHostingerMailError(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })), 'Hostinger Mail API did not respond in time');
});

test('displayNameFor prefers the module setting, then the SMTP From name', () => {
  assert.equal(displayNameFor({ display_name: 'Rootminster' }, 'Open Domains <no-reply@example.com>'), 'Rootminster');
  assert.equal(displayNameFor({ display_name: '' }, 'Open Domains <no-reply@example.com>'), 'Open Domains');
  assert.equal(displayNameFor({ display_name: '' }, '"Open Domains" <no-reply@example.com>'), 'Open Domains');
  assert.equal(displayNameFor({ display_name: '' }, 'no-reply@example.com'), undefined);
});

test('resolveHostingerMailbox validates or auto-selects the mailbox', async () => {
  assert.equal((await resolveHostingerMailbox(settings, { mailClient: fakeClient() })).address, 'no-reply@example.com');
  assert.equal((await resolveHostingerMailbox({ ...settings, mailbox_resource_id: '' }, { mailClient: fakeClient() })).resourceId, 'mbx_1');
  await assert.rejects(resolveHostingerMailbox({ ...settings, mailbox_resource_id: 'other' }, { mailClient: fakeClient() }), /cannot manage mailbox other/);
  const several = fakeClient({ me: () => ({ data: { data: { mailboxes: [{ resourceId: 'a', address: 'a@x.com' }, { resourceId: 'b', address: 'b@x.com' }] } } }) });
  await assert.rejects(resolveHostingerMailbox({ ...settings, mailbox_resource_id: '' }, { mailClient: several }), /several mailboxes.*a@x\.com \(a\)/);
  const unauthorised = fakeClient({ me: () => { throw axiosError(401, {}); } });
  await assert.rejects(resolveHostingerMailbox(settings, { mailClient: unauthorised }), /401/);
});
