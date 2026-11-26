import { config } from '../core/config.js';
import { DEFAULT_TICKET_CATEGORIES } from '../core/module-settings.js';
import { OPEN_REQUEST_STATUSES, requestHostname } from '../../shared/subdomain-requests.js';
import { normalizeName } from './subdomain-ownership.js';

const DISCORD_API = 'https://discord.com/api/v10';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SNOWFLAKE = /^\d{15,22}$/;
const HOSTNAME = /^(?=.{1,80}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const NO_SUBDOMAIN = 'none';
const TRANSCRIPT_PAGES = 10;
// Discord permission bits used in channel overwrites.
const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const EMBED = 1n << 14n;
const ATTACH = 1n << 15n;
const HISTORY = 1n << 16n;
const MANAGE_CHANNELS = 1n << 4n;
const MANAGE_ROLES = 1n << 28n;
const THREADS = (1n << 35n) | (1n << 36n) | (1n << 38n);
const MEMBER = VIEW | SEND | EMBED | ATTACH | HISTORY;
const READ_ONLY = VIEW | HISTORY;
const overwrite = (id, type, allow, deny = 0n) => ({ id, type, allow: String(allow), deny: String(deny) });

// Open: hidden from everyone, visible to the opener, staff and the bot.
// Closed: the opener loses access and staff can read but not post.
export function ticketOverwrites({ guildId, botUserId, staffRoleId, userId, closed = false }) {
  const list = [
    overwrite(guildId, 0, 0n, VIEW),
    overwrite(botUserId, 1, MEMBER | MANAGE_CHANNELS | MANAGE_ROLES),
  ];
  if (SNOWFLAKE.test(staffRoleId || '')) list.push(closed ? overwrite(staffRoleId, 0, READ_ONLY, SEND | THREADS) : overwrite(staffRoleId, 0, MEMBER));
  list.push(closed ? overwrite(userId, 1, 0n, VIEW) : overwrite(userId, 1, MEMBER, THREADS));
  return list;
}


const staff = (actor) => ['staff', 'admin'].includes(actor?.role);
const fail = (message) => { throw Object.assign(new Error(message), { userMessage: true }); };
const clip = (value, max = 1000) => {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text || '—';
};
const safe = (value, max) => clip(String(value ?? '').replace(/([\\`*_~|>])/g, '\\$1'), max);
const button = (label, custom_id, style = 2, disabled = false) => ({ type: 2, style, label, custom_id, disabled });
const row = (...components) => ({ type: 1, components });
const message = (content, components = [], embeds = [], allowed_mentions = { parse: [] }) => ({ content: clip(content, 1950), components, embeds, allowed_mentions });

// Admins edit categories as "Name: question | question" lines. Bad lines are
// skipped; an empty result falls back to the shipped defaults.
export function parseTicketCategories(text) {
  const categories = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const split = line.indexOf(':');
    if (split < 1) continue;
    const label = line.slice(0, split).trim().slice(0, 80);
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    if (!id || categories.some((category) => category.id === id)) continue;
    const questions = line.slice(split + 1).split('|').map((question) => question.trim().slice(0, 45)).filter(Boolean).slice(0, 5);
    categories.push({ id, label, questions: questions.length ? questions : ['How can we help?'] });
    if (categories.length === 10) break;
  }
  return categories.length || text === DEFAULT_TICKET_CATEGORIES ? categories : parseTicketCategories(DEFAULT_TICKET_CATEGORIES);
}

export function createDiscordApi(token, { fetchImpl = fetch } = {}) {
  async function call(method, path, body) {
    const response = await fetchImpl(`${DISCORD_API}${path}`, {
      method, headers: { Authorization: `Bot ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw Object.assign(new Error(`Discord API ${method} failed (${response.status})`), { status: response.status, discordCode: details.code });
    }
    return response.status === 204 ? null : response.json();
  }
  async function upload(path, payload, filename, text) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ ...payload, attachments: [{ id: 0, filename }] }));
    form.append('files[0]', new Blob([text], { type: 'text/plain' }), filename);
    const response = await fetchImpl(`${DISCORD_API}${path}`, { method: 'POST', headers: { Authorization: `Bot ${token}` }, body: form });
    if (!response.ok) throw Object.assign(new Error(`Discord upload failed (${response.status})`), { status: response.status });
    return response.json();
  }
  return { call, upload };
}

export function transcriptText(ticket) {
  const header = [
    `Ticket #${ticket.number} · ${ticket.category_label}`,
    `Opened by ${ticket.discord_username || ticket.discord_user_id} on ${new Date(ticket.created_at).toISOString()}`,
    `Subdomain: ${ticket.subdomain || 'none'}`,
    ...(ticket.answers || []).map((answer) => `${answer.question}\n  ${String(answer.answer).replace(/\n/g, '\n  ')}`),
    ticket.closed_at ? `Closed ${new Date(ticket.closed_at).toISOString()}${ticket.close_reason ? `: ${ticket.close_reason}` : ''}` : '',
  ].filter(Boolean);
  const lines = (ticket.transcript?.messages || []).map((entry) => {
    const parts = [entry.content, ...(entry.embeds || []).map((embed) => [embed.title, embed.description].filter(Boolean).join(': ')), ...(entry.attachments || []).map((file) => `[attachment] ${file.name} ${file.url}`)].filter(Boolean);
    return `[${entry.at}] ${entry.author}${entry.bot ? ' (bot)' : ''}: ${parts.join('\n    ') || '(no text)'}`;
  });
  return `${header.join('\n')}\n\n${'-'.repeat(40)}\n${lines.join('\n') || 'No messages were recorded.'}\n`;
}

function modalValues(components, values = {}) {
  for (const component of components || []) {
    if (component.custom_id && typeof component.value === 'string') values[component.custom_id] = component.value;
    modalValues(component.components || (component.component ? [component.component] : []), values);
  }
  return values;
}

function channelName(ticket) {
  const user = String(ticket.discord_username || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'user';
  return `ticket-${String(ticket.number).padStart(4, '0')}-${user}`;
}

/**
 * Ticket flow: /ticket or the panel button → category menu → subdomain menu
 * (the linked account's own names) → intake form → private channel. Every step
 * after the menus re-checks the linked account, its ownership and its role.
 */
export function createDiscordTickets({ db, database, settings, api, botUserId }) {
  async function ownedSubdomains(actor) {
    const [byId, byEmail, requests] = await Promise.all([
      database.filter('DnsRecord', { owner_id: actor.id }, 'name', 1000),
      actor.email ? database.filter('DnsRecord', { owner_email: actor.email }, 'name', 1000) : [],
      database.searchRequests({ owner: actor, statuses: OPEN_REQUEST_STATUSES, limit: 10 }),
    ]);
    const names = new Map();
    for (const record of [...byId, ...byEmail]) {
      const name = normalizeName(record.name);
      if (!name || record._removed) continue;
      const entry = names.get(name) || { name, kind: 'live', records: new Map() };
      entry.records.set(record.id, record);
      names.set(name, entry);
    }
    for (const request of requests) {
      const name = requestHostname(request);
      if (!names.has(name)) names.set(name, { name, kind: 'request', status: request.status, records: new Map() });
    }
    return [...names.values()].map((entry) => ({ ...entry, records: [...entry.records.values()] })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async function ticketSettings() {
    const value = await settings();
    if (!value?.enabled || !SNOWFLAKE.test(value.open_category_id || '') || !SNOWFLAKE.test(value.closed_category_id || '')) fail('Tickets are not set up on this server yet. Ask a staff member, or use the contact form on the website.');
    return { ...value, categories: parseTicketCategories(value.categories) };
  }

  async function load(id) {
    if (!UUID.test(String(id || ''))) fail('This ticket control is invalid.');
    const result = await db.query('SELECT * FROM discord_tickets WHERE id = $1', [id]);
    if (!result.rowCount) fail('This ticket no longer exists.');
    return result.rows[0];
  }

  async function start() {
    const { categories } = await ticketSettings();
    return message('**Open a support ticket.** Choose what you need help with.', [row({
      type: 3, custom_id: 'tk:cat', placeholder: 'Choose a category',
      options: categories.map((category) => ({ label: category.label, value: category.id, description: clip(category.questions[0], 100) })),
    })]);
  }

  async function chooseCategory(actor, categoryId) {
    const { categories } = await ticketSettings();
    const category = categories.find((item) => item.id === categoryId);
    if (!category) fail('That category is no longer available. Run /ticket again.');
    const subdomains = (await ownedSubdomains(actor)).filter((item) => item.name.length <= 80).slice(0, 24);
    const options = [
      ...subdomains.map((item) => ({ label: item.name.slice(0, 100), value: item.name, description: item.kind === 'live' ? `${item.records.length} DNS record${item.records.length === 1 ? '' : 's'}` : `Request ${item.status.replace('_', ' ')}` })),
      { label: 'Not about a specific subdomain', value: NO_SUBDOMAIN },
    ];
    return message(`**${safe(category.label, 80)}.** Which subdomain is this about? The list comes from your Rootminster account.`, [row({
      type: 3, custom_id: `tk:sub:${category.id}`, placeholder: 'Choose a subdomain', options,
    })]);
  }

  // Modals must be the immediate interaction response, so they are built
  // before the interaction is deferred. A blank form reveals nothing; its
  // submission re-checks the account.
  async function modal(interaction) {
    const [prefix, action, id] = String(interaction.data?.custom_id || '').split(':');
    if (prefix !== 'tk' || interaction.type !== 3) return null;
    if (action === 'close' && UUID.test(id || '')) {
      return { type: 9, data: { custom_id: `tk:closed:${id}`, title: 'Close ticket', components: [
        { type: 18, label: 'Reason (shown in the ticket)', component: { type: 4, custom_id: 'reason', style: 2, required: false, max_length: 500 } },
      ] } };
    }
    if (action !== 'sub') return null;
    const { categories } = await ticketSettings();
    const category = categories.find((item) => item.id === id);
    const subdomain = String(interaction.data?.values?.[0] || '');
    if (!category || (subdomain !== NO_SUBDOMAIN && !HOSTNAME.test(subdomain))) return null;
    return { type: 9, data: { custom_id: `tk:submit:${category.id}:${subdomain}`, title: clip(category.label, 45), components: category.questions.map((question, index) => (
      { type: 18, label: question, component: { type: 4, custom_id: `q${index}`, style: 2, required: index === 0, max_length: 1000 } }
    )) } };
  }

  async function subdomainDetails(actor, hostname) {
    if (hostname === NO_SUBDOMAIN) return null;
    const match = (await ownedSubdomains(actor)).find((item) => item.name === hostname);
    if (!match) fail(`${hostname} is not on your account. Run /ticket again and pick one of your subdomains.`);
    return match;
  }

  async function submit(interaction, actor, identity) {
    const [, , categoryId, hostname] = String(interaction.data?.custom_id || '').split(':');
    const current = await ticketSettings();
    const category = current.categories.find((item) => item.id === categoryId);
    if (!category) fail('That category is no longer available. Run /ticket again.');
    const subdomain = await subdomainDetails(actor, hostname);
    const values = modalValues(interaction.data?.components);
    const answers = category.questions.map((question, index) => ({ question, answer: String(values[`q${index}`] || '').trim().slice(0, 1000) })).filter((answer) => answer.answer);
    if (!answers.length) fail('Answer at least the first question.');

    const ticket = await db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`discord-ticket:${actor.id}`]);
      const open = await client.query("SELECT count(*)::int AS count FROM discord_tickets WHERE user_id = $1 AND status IN ('opening', 'open')", [actor.id]);
      const limit = Math.max(1, Number(current.max_open_tickets) || 3);
      if (open.rows[0].count >= limit) fail(`You already have ${open.rows[0].count} open ticket${open.rows[0].count === 1 ? '' : 's'}. Close one before opening another.`);
      const created = await client.query(
        `INSERT INTO discord_tickets(user_id, discord_user_id, discord_username, guild_id, category, category_label, subdomain, answers)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING *`,
        [actor.id, identity.id, identity.username, interaction.guild_id || null, category.id, category.label, subdomain?.name || null, JSON.stringify(answers)],
      );
      return created.rows[0];
    });

    if (!SNOWFLAKE.test(String(interaction.guild_id || ''))) fail('Open tickets from the server, not from direct messages.');
    let channel;
    try {
      channel = await api.call('POST', `/guilds/${interaction.guild_id}/channels`, {
        name: channelName(ticket), type: 0, parent_id: current.open_category_id,
        topic: clip(`Ticket #${ticket.number} · ${category.label}${subdomain ? ` · ${subdomain.name}` : ''}`, 1024),
        permission_overwrites: ticketOverwrites({ guildId: interaction.guild_id, botUserId: await botUserId(), staffRoleId: current.staff_role_id, userId: identity.id }),
      });
    } catch (error) {
      await db.query("DELETE FROM discord_tickets WHERE id = $1 AND status = 'opening'", [ticket.id]);
      throw Object.assign(error, { userMessage: false });
    }
    await db.query("UPDATE discord_tickets SET status = 'open', channel_id = $2, updated_at = now() WHERE id = $1", [ticket.id, channel.id]);
    const opened = { ...ticket, status: 'open', channel_id: channel.id };
    await api.call('POST', `/channels/${channel.id}/messages`, openingMessage(opened, actor, subdomain, current.staff_role_id));
    return message(`Ticket #${ticket.number} is open: <#${channel.id}>. Staff will reply there.`);
  }

  function openingMessage(ticket, actor, subdomain, staffRoleId) {
    const role = SNOWFLAKE.test(staffRoleId || '') ? staffRoleId : null;
    const fields = [
      { name: 'Subdomain', value: subdomain ? `${safe(subdomain.name, 200)}${subdomain.kind === 'request' ? ` (request ${subdomain.status.replace('_', ' ')})` : ''}` : 'Not about a specific subdomain' },
      ...(subdomain?.records?.length ? [{ name: 'DNS records', value: clip(subdomain.records.slice(0, 8).map((record) => `${record.record_type || record.type}${record.status === 'suspended' ? ' (suspended)' : ''}: ${safe(record.content || record.record_value, 100)}`).join('\n'), 1000) }] : []),
      ...ticket.answers.map((answer) => ({ name: clip(answer.question, 256), value: safe(answer.answer, 1024) })),
      { name: 'Rootminster account', value: `${safe(actor.email, 200)} · joined ${actor.created_date ? new Date(actor.created_date).toISOString().slice(0, 10) : 'unknown'}` },
    ];
    return message(`<@${ticket.discord_user_id}> thanks, a staff member will be with you soon.${role ? ` <@&${role}>` : ''}`, [
      row(button('Claim', `tk:claim:${ticket.id}`, 1), button('Close ticket', `tk:close:${ticket.id}`, 4), { type: 2, style: 5, label: 'View on website', url: `${config.appUrl}/tickets?ticket=${ticket.id}` }),
    ], [{ title: clip(`Ticket #${ticket.number} · ${ticket.category_label}`, 256), color: 0x2563eb, fields, timestamp: new Date(ticket.created_at).toISOString() }], { parse: [], users: [ticket.discord_user_id], roles: role ? [role] : [] });
  }

  async function claim(actor, identity, id) {
    if (!staff(actor)) fail('Only staff can claim tickets.');
    const ticket = await load(id);
    if (ticket.status !== 'open') fail(`Ticket #${ticket.number} is ${ticket.status}.`);
    await db.query('UPDATE discord_tickets SET claimed_by_id = $2, claimed_at = now(), updated_at = now() WHERE id = $1', [ticket.id, actor.id]);
    await api.call('POST', `/channels/${ticket.channel_id}/messages`, message(`<@${identity.id}> has claimed this ticket and will help you.`));
    return message(`You claimed ticket #${ticket.number}.`);
  }

  async function fetchTranscript(channelId) {
    const messages = [];
    let before;
    for (let page = 0; page < TRANSCRIPT_PAGES; page += 1) {
      const batch = await api.call('GET', `/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`);
      messages.push(...batch);
      if (batch.length < 100) break;
      before = batch[batch.length - 1].id;
    }
    return messages.reverse().map((entry) => ({
      id: entry.id, author_id: entry.author?.id, author: entry.author?.global_name || entry.author?.username || 'unknown', bot: Boolean(entry.author?.bot),
      at: entry.timestamp, content: String(entry.content || '').slice(0, 4000),
      embeds: (entry.embeds || []).map((embed) => ({ title: embed.title || '', description: embed.description || '' })).filter((embed) => embed.title || embed.description),
      attachments: (entry.attachments || []).map((file) => ({ name: file.filename, url: file.url })),
    }));
  }

  async function close(interaction, actor, identity, id) {
    const ticket = await load(id);
    if (!staff(actor) && ticket.user_id !== actor.id) fail('Only staff or the person who opened this ticket can close it.');
    if (ticket.status !== 'open') fail(`Ticket #${ticket.number} is already ${ticket.status}.`);
    const reason = String(modalValues(interaction.data?.components).reason || '').trim().slice(0, 500);
    const current = await ticketSettings();
    await api.call('POST', `/channels/${ticket.channel_id}/messages`, message(`Ticket closed by <@${identity.id}>.${reason ? `\nReason: ${safe(reason, 500)}` : ''}`, [row(button('Reopen', `tk:reopen:${ticket.id}`))]));
    let transcript;
    try {
      transcript = { messages: await fetchTranscript(ticket.channel_id), saved_at: new Date().toISOString() };
    } catch (error) {
      transcript = { messages: [], saved_at: new Date().toISOString(), error: `Discord did not return the channel history (${error.status || 'error'}).` };
    }
    const updated = await db.query(
      `UPDATE discord_tickets SET status = 'closed', closed_by_id = $2, close_reason = $3, closed_at = now(), transcript = $4::jsonb, updated_at = now()
       WHERE id = $1 AND status = 'open' RETURNING *`,
      [ticket.id, actor.id, reason || null, JSON.stringify(transcript)],
    );
    if (!updated.rowCount) fail(`Ticket #${ticket.number} was already closed.`);
    await api.call('PATCH', `/channels/${ticket.channel_id}`, {
      parent_id: current.closed_category_id,
      permission_overwrites: ticketOverwrites({ guildId: ticket.guild_id, botUserId: await botUserId(), staffRoleId: current.staff_role_id, userId: ticket.discord_user_id, closed: true }),
    }).catch(() => {});
    if (SNOWFLAKE.test(current.transcript_channel_id || '')) {
      const closed = updated.rows[0];
      await api.upload(`/channels/${current.transcript_channel_id}/messages`, message(`Ticket #${closed.number} (${safe(closed.category_label, 80)}) opened by <@${closed.discord_user_id}> was closed by <@${identity.id}>.${reason ? ` Reason: ${safe(reason, 300)}` : ''}`, [
        row({ type: 2, style: 5, label: 'View on dashboard', url: `${config.appUrl}/admin-tickets?ticket=${closed.id}` }),
      ]), `ticket-${closed.number}.txt`, transcriptText(closed)).catch(() => {});
    }
    return message(`Ticket #${ticket.number} closed.${transcript.error ? ' The transcript could not be saved, so check the bot can read message history and has the Message Content intent.' : ' The transcript has been saved.'}`);
  }

  async function reopen(actor, identity, id) {
    if (!staff(actor)) fail('Only staff can reopen tickets.');
    const ticket = await load(id);
    if (ticket.status !== 'closed') fail(`Ticket #${ticket.number} is ${ticket.status}.`);
    if (ticket.channel_deleted_at) fail(`Ticket #${ticket.number}'s channel has been deleted. Ask the user to open a new ticket.`);
    const current = await ticketSettings();
    await api.call('PATCH', `/channels/${ticket.channel_id}`, {
      parent_id: current.open_category_id,
      permission_overwrites: ticketOverwrites({ guildId: ticket.guild_id, botUserId: await botUserId(), staffRoleId: current.staff_role_id, userId: ticket.discord_user_id }),
    });
    await db.query("UPDATE discord_tickets SET status = 'open', closed_by_id = NULL, close_reason = NULL, closed_at = NULL, updated_at = now() WHERE id = $1", [ticket.id]);
    await api.call('POST', `/channels/${ticket.channel_id}/messages`, message(`<@${identity.id}> reopened this ticket. <@${ticket.discord_user_id}> you can reply here again.`, [row(button('Close ticket', `tk:close:${ticket.id}`, 4))], [], { parse: [], users: [ticket.discord_user_id] }));
    return message(`Ticket #${ticket.number} reopened.`);
  }

  async function postPanel(actor, channelId) {
    if (!staff(actor)) fail('Only staff can post the ticket panel.');
    await ticketSettings();
    if (!SNOWFLAKE.test(String(channelId || ''))) fail('Run this command in a server channel.');
    await api.call('POST', `/channels/${channelId}/messages`, message('', [row(button('Open a ticket', 'tk:open', 1))], [{
      title: 'Need help?', color: 0x2563eb,
      description: 'Open a private support ticket with the staff team. You will pick a category and the subdomain it is about, then answer a few questions.\n\nYou need a linked Rootminster account: run `/link` if you have not linked yet.',
    }]));
    return message('Ticket panel posted in this channel.');
  }

  async function list(actor) {
    const result = staff(actor)
      ? await db.query("SELECT * FROM discord_tickets WHERE status = 'open' ORDER BY created_at LIMIT 15")
      : await db.query('SELECT * FROM discord_tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [actor.id]);
    const lines = result.rows.map((ticket) => `#${ticket.number} · ${safe(ticket.category_label, 60)}${ticket.subdomain ? ` · ${safe(ticket.subdomain, 80)}` : ''} · ${ticket.status}${ticket.channel_id && !ticket.channel_deleted_at ? ` · <#${ticket.channel_id}>` : ''}${staff(actor) && ticket.claimed_by_id ? ' · claimed' : ''}`);
    return message(`**${staff(actor) ? 'Open tickets' : 'Your tickets'}**\n${lines.join('\n') || 'No tickets.'}`, [
      row({ type: 2, style: 5, label: 'Open on dashboard', url: `${config.appUrl}/${staff(actor) ? 'admin-tickets' : 'tickets'}` }),
    ]);
  }

  async function component(interaction, actor, identity) {
    const [prefix, action, id] = String(interaction.data?.custom_id || '').split(':');
    if (prefix !== 'tk') fail('This control is invalid.');
    if (interaction.type === 5 && action === 'submit') return submit(interaction, actor, identity);
    if (interaction.type === 5 && action === 'closed') return close(interaction, actor, identity, id);
    if (interaction.type !== 3) fail('Invalid form.');
    if (action === 'open') return start();
    if (action === 'cat') return chooseCategory(actor, String(interaction.data?.values?.[0] || ''));
    if (action === 'claim') return claim(actor, identity, id);
    if (action === 'reopen') return reopen(actor, identity, id);
    fail('This ticket control has expired. Run /ticket again.');
  }

  // Closed channels count toward Discord's 50-channel category limit. The
  // transcript stays in the database after the channel is deleted.
  async function pruneClosedChannels() {
    const current = await settings();
    const days = Number(current?.delete_closed_after_days) || 0;
    if (!current?.enabled || days <= 0) return { deleted: 0 };
    const due = await db.query(
      `SELECT id, channel_id FROM discord_tickets WHERE status = 'closed' AND channel_id IS NOT NULL AND channel_deleted_at IS NULL
       AND closed_at < now() - make_interval(days => $1) ORDER BY closed_at LIMIT 50`, [days]);
    let deleted = 0;
    for (const ticket of due.rows) {
      try {
        await api.call('DELETE', `/channels/${ticket.channel_id}`);
      } catch (error) {
        if (error.status !== 404) continue;
      }
      await db.query('UPDATE discord_tickets SET channel_deleted_at = now(), updated_at = now() WHERE id = $1', [ticket.id]);
      deleted += 1;
    }
    return { deleted };
  }

  return { start, modal, component, postPanel, list, ownedSubdomains, openingMessage, pruneClosedChannels };
}

// Components that edit the ephemeral wizard message in place instead of
// sending a new reply.
export function updatesInPlace(interaction) {
  const [prefix, action] = String(interaction.data?.custom_id || '').split(':');
  return prefix === 'tk' && ['cat', 'submit'].includes(action);
}
