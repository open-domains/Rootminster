import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordTickets, parseTicketCategories, ticketOverwrites, transcriptText, updatesInPlace } from '../../server/lib/discord-tickets.js';
import { DEFAULT_TICKET_CATEGORIES } from '../../server/core/module-settings.js';

const GUILD = '100000000000000001';
const BOT = '100000000000000002';
const STAFF_ROLE = '100000000000000003';
const OPEN_CATEGORY = '100000000000000004';
const CLOSED_CATEGORY = '100000000000000005';
const LOG_CHANNEL = '100000000000000006';
const USER_DISCORD = '200000000000000001';
const STAFF_DISCORD = '200000000000000002';
const owner = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'owner@example.com', role: 'user', created_date: '2026-01-01T00:00:00Z' };
const stranger = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'other@example.com', role: 'user' };
const staffUser = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'staff@example.com', role: 'staff' };
const ownerIdentity = { id: USER_DISCORD, username: 'Owner Person' };
const staffIdentity = { id: STAFF_DISCORD, username: 'Staffer' };

// An in-memory stand-in for the discord_tickets queries the module issues.
function fakeDb() {
  const tickets = [];
  let number = 0;
  const query = async (text, values = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
    if (sql.startsWith('SELECT count(*)')) {
      const count = tickets.filter((ticket) => ticket.user_id === values[0] && ['opening', 'open'].includes(ticket.status)).length;
      return { rows: [{ count }], rowCount: 1 };
    }
    if (sql.startsWith('INSERT INTO discord_tickets')) {
      const [user_id, discord_user_id, discord_username, guild_id, category, category_label, subdomain, answers] = values;
      number += 1;
      const ticket = { id: `dddddddd-dddd-4ddd-8ddd-${String(number).padStart(12, '0')}`, number, user_id, discord_user_id, discord_username, guild_id, category, category_label, subdomain, answers: JSON.parse(answers), status: 'opening', channel_id: null, created_at: new Date().toISOString() };
      tickets.push(ticket);
      return { rows: [{ ...ticket }], rowCount: 1 };
    }
    const byId = () => tickets.find((ticket) => ticket.id === values[0]);
    if (sql.startsWith('SELECT * FROM discord_tickets WHERE id')) { const ticket = byId(); return { rows: ticket ? [{ ...ticket }] : [], rowCount: ticket ? 1 : 0 }; }
    if (sql.startsWith('DELETE FROM discord_tickets')) { const index = tickets.findIndex((ticket) => ticket.id === values[0] && ticket.status === 'opening'); if (index >= 0) tickets.splice(index, 1); return { rows: [], rowCount: index >= 0 ? 1 : 0 }; }
    if (sql.includes("SET status = 'open', channel_id")) { Object.assign(byId(), { status: 'open', channel_id: values[1] }); return { rows: [], rowCount: 1 }; }
    if (sql.includes('SET claimed_by_id')) { Object.assign(byId(), { claimed_by_id: values[1] }); return { rows: [], rowCount: 1 }; }
    if (sql.includes("SET status = 'closed'")) {
      const ticket = byId();
      if (!ticket || ticket.status !== 'open') return { rows: [], rowCount: 0 };
      Object.assign(ticket, { status: 'closed', closed_by_id: values[1], close_reason: values[2], closed_at: new Date().toISOString(), transcript: JSON.parse(values[3]) });
      return { rows: [{ ...ticket }], rowCount: 1 };
    }
    if (sql.includes("SET status = 'open', closed_by_id = NULL")) { Object.assign(byId(), { status: 'open', closed_at: null, close_reason: null }); return { rows: [], rowCount: 1 }; }
    if (sql.startsWith("SELECT id, channel_id FROM discord_tickets WHERE status = 'closed'")) {
      const cutoff = Date.now() - values[0] * 86_400_000;
      const rows = tickets.filter((ticket) => ticket.status === 'closed' && ticket.channel_id && !ticket.channel_deleted_at && Date.parse(ticket.closed_at) < cutoff);
      return { rows, rowCount: rows.length };
    }
    if (sql.includes('SET channel_deleted_at')) { byId().channel_deleted_at = new Date().toISOString(); return { rows: [], rowCount: 1 }; }
    if (sql.startsWith('SELECT * FROM discord_tickets WHERE')) return { rows: [...tickets], rowCount: tickets.length };
    throw new Error(`Unexpected query: ${sql}`);
  };
  return { tickets, query, transaction: (callback) => callback({ query }) };
}

function setup({ settings: overrides = {}, records, failChannel = false, history } = {}) {
  const db = fakeDb();
  const calls = [];
  const settings = { enabled: true, open_category_id: OPEN_CATEGORY, closed_category_id: CLOSED_CATEGORY, staff_role_id: STAFF_ROLE, transcript_channel_id: LOG_CHANNEL, max_open_tickets: 2, delete_closed_after_days: 7, categories: DEFAULT_TICKET_CATEGORIES, ...overrides };
  const dnsRecords = records || [
    { id: 'r1', name: 'site.example.com', record_type: 'A', content: '192.0.2.1', owner_id: owner.id },
    { id: 'r2', name: 'www.site.example.com', record_type: 'CNAME', content: 'site.example.com', owner_email: owner.email },
    { id: 'r3', name: 'theirs.example.com', record_type: 'A', content: '192.0.2.9', owner_id: stranger.id },
  ];
  const database = {
    filter: async (entity, filter) => dnsRecords.filter((record) => Object.entries(filter).every(([key, value]) => record[key] === value)),
    searchRequests: async ({ owner: who }) => (who.id === owner.id ? [{ id: 'q1', subdomain: 'pending', root_domain: 'example.com', status: 'pending', requester_id: owner.id }] : []),
  };
  let channels = 0;
  const api = {
    call: async (method, path, body) => {
      calls.push({ method, path, body });
      if (method === 'POST' && path === `/guilds/${GUILD}/channels`) {
        if (failChannel) throw Object.assign(new Error('Discord API POST failed (403)'), { status: 403 });
        channels += 1;
        return { id: `30000000000000000${channels}` };
      }
      if (method === 'GET') return history || [
        { id: '2', author: { id: USER_DISCORD, username: 'owner' }, timestamp: '2026-11-26T10:01:00Z', content: 'It still fails', attachments: [{ filename: 'shot.png', url: 'https://cdn.example/shot.png' }] },
        { id: '1', author: { id: BOT, username: 'bot', bot: true }, timestamp: '2026-11-26T10:00:00Z', content: '', embeds: [{ title: 'Ticket #1' }] },
      ];
      return {};
    },
    upload: async (path, payload, filename, text) => { calls.push({ method: 'UPLOAD', path, payload, filename, text }); return {}; },
  };
  const tickets = createDiscordTickets({ db, database, settings: async () => settings, api, botUserId: async () => BOT });
  return { tickets, db, calls };
}

const submitEvent = (category, subdomain, answers = ['Set up GitHub Pages']) => ({
  type: 5, guild_id: GUILD,
  data: { custom_id: `tk:submit:${category}:${subdomain}`, components: answers.map((value, index) => ({ type: 18, component: { type: 4, custom_id: `q${index}`, value } })) },
});
const closeEvent = (id, reason = 'Solved') => ({ type: 5, guild_id: GUILD, data: { custom_id: `tk:closed:${id}`, components: [{ type: 18, component: { type: 4, custom_id: 'reason', value: reason } }] } });
const buttons = (message) => message.components.flatMap((row) => row.components);
const overwriteFor = (list, id) => list.find((item) => item.id === id);
const has = (bits, bit) => (BigInt(bits) & (1n << BigInt(bit))) !== 0n;

test('categories parse from admin text and fall back to the defaults', () => {
  const parsed = parseTicketCategories('DNS help: One? | Two?\nbroken line\nDNS help: duplicate\nBilling:');
  assert.deepEqual(parsed.map((category) => category.id), ['dns-help', 'billing']);
  assert.deepEqual(parsed[0].questions, ['One?', 'Two?']);
  assert.deepEqual(parsed[1].questions, ['How can we help?']);
  assert.equal(parseTicketCategories('').length, 5);
  assert.ok(parseTicketCategories(`Long: ${'x'.repeat(80)}`)[0].questions[0].length <= 45);
});

test('the subdomain menu lists only names from the linked account', async () => {
  const { tickets } = setup();
  const menu = await tickets.component({ type: 3, data: { custom_id: 'tk:cat', values: ['dns-help'] } }, owner, ownerIdentity);
  const options = menu.components[0].components[0].options.map((option) => option.value);
  assert.deepEqual(options, ['pending.example.com', 'site.example.com', 'www.site.example.com', 'none']);
  assert.ok(!options.includes('theirs.example.com'));
});

test('the intake form asks the category questions and keeps the choice in its ID', async () => {
  const { tickets } = setup();
  const modal = await tickets.modal({ type: 3, data: { custom_id: 'tk:sub:dns-help', values: ['site.example.com'] } });
  assert.equal(modal.type, 9);
  assert.equal(modal.data.custom_id, 'tk:submit:dns-help:site.example.com');
  assert.equal(modal.data.components.length, 3);
  assert.equal(await tickets.modal({ type: 3, data: { custom_id: 'tk:sub:dns-help', values: ['bad host!'] } }), null);
  assert.equal(await tickets.modal({ type: 3, data: { custom_id: 'tk:sub:missing', values: ['none'] } }), null);
});

test('opening a ticket creates a private channel in the open category', async () => {
  const { tickets, db, calls } = setup();
  const result = await tickets.component(submitEvent('dns-help', 'site.example.com', ['Pages', '', 'none']), owner, ownerIdentity);
  assert.match(result.content, /Ticket #1 is open: <#300000000000000001>/);
  const create = calls.find((call) => call.path === `/guilds/${GUILD}/channels`);
  assert.equal(create.body.parent_id, OPEN_CATEGORY);
  assert.equal(create.body.name, 'ticket-0001-owner-person');
  const perms = create.body.permission_overwrites;
  assert.ok(has(overwriteFor(perms, GUILD).deny, 10), '@everyone cannot view');
  assert.ok(has(overwriteFor(perms, USER_DISCORD).allow, 10) && has(overwriteFor(perms, USER_DISCORD).allow, 11), 'opener can view and send');
  assert.ok(has(overwriteFor(perms, STAFF_ROLE).allow, 11), 'staff can send');
  assert.ok(has(overwriteFor(perms, BOT).allow, 4), 'bot keeps manage channels');
  const opening = calls.find((call) => call.method === 'POST' && call.path === '/channels/300000000000000001/messages').body;
  assert.deepEqual(opening.allowed_mentions, { parse: [], users: [USER_DISCORD], roles: [STAFF_ROLE] });
  assert.ok(opening.embeds[0].fields.some((field) => field.name === 'DNS records' && /192\.0\.2\.1/.test(field.value)));
  assert.equal(db.tickets[0].status, 'open');
  assert.deepEqual(db.tickets[0].answers.map((answer) => answer.answer), ['Pages', 'none']);
});

test('a ticket cannot name a subdomain on another account', async () => {
  const { tickets, db } = setup();
  await assert.rejects(tickets.component(submitEvent('dns-help', 'theirs.example.com'), owner, ownerIdentity), /not on your account/);
  assert.equal(db.tickets.length, 0);
});

test('the open ticket limit is enforced', async () => {
  const { tickets } = setup();
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  await assert.rejects(tickets.component(submitEvent('other', 'none'), owner, ownerIdentity), /already have 2 open tickets/);
});

test('a failed channel creation leaves no ticket behind', async () => {
  const { tickets, db } = setup({ failChannel: true });
  await assert.rejects(tickets.component(submitEvent('other', 'none'), owner, ownerIdentity), /403/);
  assert.equal(db.tickets.length, 0);
});

test('tickets need both categories configured', async () => {
  const { tickets } = setup({ settings: { closed_category_id: '' } });
  await assert.rejects(tickets.start(), /not set up/);
});

test('only staff can claim and reopen, and only the opener or staff can close', async () => {
  const { tickets, db } = setup();
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  const id = db.tickets[0].id;
  await assert.rejects(tickets.component({ type: 3, data: { custom_id: `tk:claim:${id}` } }, owner, ownerIdentity), /Only staff/);
  await assert.rejects(tickets.component(closeEvent(id), stranger, { id: '200000000000000009', username: 'x' }), /Only staff or the person/);
  await tickets.component({ type: 3, data: { custom_id: `tk:claim:${id}` } }, staffUser, staffIdentity);
  assert.equal(db.tickets[0].claimed_by_id, staffUser.id);
  await tickets.component(closeEvent(id), owner, ownerIdentity);
  await assert.rejects(tickets.component({ type: 3, data: { custom_id: `tk:reopen:${id}` } }, owner, ownerIdentity), /Only staff/);
});

test('closing saves the transcript, moves the channel and makes it read-only', async () => {
  const { tickets, db, calls } = setup();
  await tickets.component(submitEvent('other', 'none', ['Help me']), owner, ownerIdentity);
  const ticket = db.tickets[0];
  const result = await tickets.component(closeEvent(ticket.id, 'Fixed the CNAME'), staffUser, staffIdentity);
  assert.match(result.content, /closed\. The transcript has been saved/);
  assert.equal(ticket.status, 'closed');
  assert.equal(ticket.close_reason, 'Fixed the CNAME');
  assert.deepEqual(ticket.transcript.messages.map((entry) => entry.id), ['1', '2'], 'oldest first');
  const move = calls.find((call) => call.method === 'PATCH' && call.path === `/channels/${ticket.channel_id}`);
  assert.equal(move.body.parent_id, CLOSED_CATEGORY);
  const perms = move.body.permission_overwrites;
  assert.ok(has(overwriteFor(perms, USER_DISCORD).deny, 10), 'opener loses access');
  assert.ok(has(overwriteFor(perms, STAFF_ROLE).allow, 10) && has(overwriteFor(perms, STAFF_ROLE).deny, 11), 'staff read-only');
  const upload = calls.find((call) => call.method === 'UPLOAD');
  assert.equal(upload.path, `/channels/${LOG_CHANNEL}/messages`);
  assert.match(upload.text, /It still fails/);
  assert.match(upload.text, /\[attachment\] shot\.png/);
  await assert.rejects(tickets.component(closeEvent(ticket.id), staffUser, staffIdentity), /already closed/);

  await tickets.component({ type: 3, data: { custom_id: `tk:reopen:${ticket.id}` } }, staffUser, staffIdentity);
  const reopen = calls.filter((call) => call.method === 'PATCH').at(-1);
  assert.equal(reopen.body.parent_id, OPEN_CATEGORY);
  assert.ok(has(overwriteFor(reopen.body.permission_overwrites, USER_DISCORD).allow, 11));
  assert.equal(ticket.status, 'open');
});

test('a transcript Discord refuses is recorded as an error, and the ticket still closes', async () => {
  const { tickets, db } = setup({ history: { message: 'Missing Access' } });
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  const result = await tickets.component(closeEvent(db.tickets[0].id), owner, ownerIdentity);
  assert.match(result.content, /could not be saved/);
  assert.equal(db.tickets[0].status, 'closed');
  assert.match(db.tickets[0].transcript.error, /did not return/);
});

test('closed channels are deleted after the configured days and the transcript is kept', async () => {
  const { tickets, db, calls } = setup();
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  await tickets.component(closeEvent(db.tickets[0].id), owner, ownerIdentity);
  assert.deepEqual(await tickets.pruneClosedChannels(), { deleted: 0 });
  db.tickets[0].closed_at = new Date(Date.now() - 8 * 86_400_000).toISOString();
  assert.deepEqual(await tickets.pruneClosedChannels(), { deleted: 1 });
  assert.ok(calls.some((call) => call.method === 'DELETE' && call.path === `/channels/${db.tickets[0].channel_id}`));
  assert.ok(db.tickets[0].transcript);
  await assert.rejects(tickets.component({ type: 3, data: { custom_id: `tk:reopen:${db.tickets[0].id}` } }, staffUser, staffIdentity), /deleted/);
});

test('the panel is staff-only and the wizard updates in place', async () => {
  const { tickets, calls } = setup();
  await assert.rejects(tickets.postPanel(owner, '400000000000000001'), /Only staff/);
  await tickets.postPanel(staffUser, '400000000000000001');
  const panel = calls.find((call) => call.path === '/channels/400000000000000001/messages').body;
  assert.equal(buttons(panel)[0].custom_id, 'tk:open');
  assert.equal(updatesInPlace({ data: { custom_id: 'tk:cat' } }), true);
  assert.equal(updatesInPlace({ data: { custom_id: 'tk:open' } }), false);
  assert.equal(updatesInPlace({ data: { custom_id: 'rm:view:x' } }), false);
});

test('closed overwrites never grant the opener access', () => {
  const list = ticketOverwrites({ guildId: GUILD, botUserId: BOT, staffRoleId: '', userId: USER_DISCORD, closed: true });
  assert.equal(list.length, 3);
  assert.equal(overwriteFor(list, USER_DISCORD).allow, '0');
});

test('transcript text includes the intake answers', () => {
  const text = transcriptText({ number: 7, category_label: 'Other', discord_username: 'owner', created_at: '2026-11-26T10:00:00Z', subdomain: null, answers: [{ question: 'How can we help?', answer: 'Line one\nLine two' }], transcript: { messages: [] } });
  assert.match(text, /Ticket #7 · Other/);
  assert.match(text, /How can we help\?\n {2}Line one\n {2}Line two/);
  assert.match(text, /No messages were recorded/);
});

test('ticket text uses the branded site name', async () => {
  const db = fakeDb();
  const calls = [];
  const tickets = createDiscordTickets({
    db, database: { filter: async () => [], searchRequests: async () => [] },
    settings: async () => ({ enabled: true, open_category_id: OPEN_CATEGORY, closed_category_id: CLOSED_CATEGORY, categories: DEFAULT_TICKET_CATEGORIES }),
    api: { call: async (method, path, body) => { calls.push(body); return { id: '300000000000000001' }; } },
    botUserId: async () => BOT, platformName: async () => 'Acme Hosting',
  });
  const menu = await tickets.component({ type: 3, data: { custom_id: 'tk:cat', values: ['other'] } }, owner, ownerIdentity);
  assert.match(menu.content, /your Acme Hosting account/);
  await tickets.postPanel(staffUser, '400000000000000001');
  assert.match(calls.at(-1).embeds[0].description, /linked Acme Hosting account/);
  await tickets.component(submitEvent('other', 'none'), owner, ownerIdentity);
  assert.ok(calls.at(-1).embeds[0].fields.some((field) => field.name === 'Acme Hosting account'));
  assert.ok(!JSON.stringify(calls).includes('Rootminster'));
});
