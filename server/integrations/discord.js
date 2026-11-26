import { createDiscordRequests, discordMessage, discordModal } from '../lib/discord-requests.js';
import { platformName } from '../lib/platform-name.js';
import { createDiscordApi, createDiscordTickets, transcriptText, updatesInPlace } from '../lib/discord-tickets.js';
import { createDiscordDeploys, createRunnerClient } from '../lib/discord-deploy.js';
import crypto from 'node:crypto';
import { authenticateRequest } from '../routes/auth.js';
import { config } from '../core/config.js';
import { getModuleConfig } from '../core/module-settings.js';
import { pool, transaction } from '../core/database.js';
import { invokeInternal } from '../core/function-runner.js';
import { randomToken, sha256 } from '../core/security.js';
import { store } from '../core/store.js';

const DISCORD_API = 'https://discord.com/api/v10';
const EPHEMERAL = 64;
const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
const requestUi = createDiscordRequests();
async function botApi() {
  const bot = await botConfigured();
  if (!bot) throw Object.assign(new Error('Discord bot is disabled.'), { userMessage: true });
  return createDiscordApi(bot.bot_token);
}
const discordApi = { call: async (...args) => (await botApi()).call(...args), upload: async (...args) => (await botApi()).upload(...args) };
export const tickets = createDiscordTickets({
  db: { query: (text, values) => pool.query(text, values), transaction },
  database: store,
  settings: () => getModuleConfig('discord_tickets'),
  api: discordApi,
  // A bot user's ID is its application's ID.
  botUserId: async () => (await botConfigured())?.application_id,
  platformName,
});

export const deploys = createDiscordDeploys({
  db: { query: (text, values) => pool.query(text, values) },
  settings: () => getModuleConfig('discord_deploy'),
  runner: createRunnerClient(),
  api: discordApi,
  audit: (entry, actor) => store.create('AuditLog', entry, actor),
  platformName,
  applicationId: async () => (await botConfigured())?.application_id,
});

const commandList = (site) => [
  { name: 'panel', description: 'Open your request controls and staff review queue' },
  { name: 'link', description: `Link your Discord user to your ${site} account`.slice(0, 100) },
  { name: 'ticket', description: 'Open a private support ticket with the staff team', dm_permission: false },
  { name: 'tickets', description: 'List your tickets, or open tickets for staff', dm_permission: false },
  { name: 'ticket-panel', description: 'Staff: post an "Open a ticket" button in this channel', dm_permission: false, default_member_permissions: String(1 << 5) },
  { name: 'deploy', description: `Staff: redeploy the latest version of ${site}`.slice(0, 100), dm_permission: false },
  {
    name: 'request', description: 'Submit a subdomain request using your linked account', options: [
      { name: 'name', description: 'Subdomain name', type: 3, required: true },
      { name: 'domain', description: 'Root domain, such as open-domains.net', type: 3, required: true },
      { name: 'type', description: 'DNS record type', type: 3, required: true, choices: RECORD_TYPES.map((name) => ({ name, value: name })) },
      { name: 'value', description: 'DNS record value', type: 3, required: true },
      { name: 'reason', description: 'What the subdomain will be used for', type: 3, required: true },
      { name: 'preview', description: 'A URL showing the project', type: 3, required: true },
      { name: 'ttl', description: 'DNS TTL in seconds', type: 4, required: false },
      { name: 'proxied', description: 'Enable Cloudflare proxying', type: 5, required: false },
    ],
  },
  {
    name: 'requests', description: 'List your requests or the staff review queue', options: [
      { name: 'scope', description: 'Which requests to show', type: 3, required: false, choices: [{ name: 'My requests', value: 'mine' }, { name: 'Pending review', value: 'pending' }] },
    ],
  },
  { name: 'request-view', description: 'View a request you are allowed to access', options: [{ name: 'id', description: 'Request ID', type: 3, required: true }] },
  {
    name: 'request-manage', description: 'Staff: approve, reject, or ask about a request', options: [
      { name: 'id', description: 'Request ID', type: 3, required: true },
      { name: 'action', description: 'Review action', type: 3, required: true, choices: [{ name: 'Approve (with confirmation)', value: 'approve' }, { name: 'Reject', value: 'reject' }, { name: 'Ask for information', value: 'question' }, { name: 'Internal note', value: 'note' }] },
      { name: 'message', description: 'Rejection reason, question, or review note', type: 3, required: false },
    ],
  },
];

async function botConfigured() {
  const bot = await getModuleConfig('discord');
  return bot.enabled && bot.application_id && bot.public_key && bot.bot_token ? bot : null;
}

export function verifyDiscordSignature(rawBody, timestamp, signature, publicKey = '') {
  if (!rawBody || !timestamp || !signature || !publicKey) return false;
  try {
    const signedAt = Number(timestamp);
    if (!Number.isFinite(signedAt) || Math.abs(Date.now() / 1000 - signedAt) > 300) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex')]),
      format: 'der', type: 'spki',
    });
    return crypto.verify(null, Buffer.from(`${timestamp}${rawBody}`), key, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function optionsMap(interaction) {
  return Object.fromEntries((interaction.data?.options || []).map((option) => [option.name, option.value]));
}

function discordIdentity(interaction) {
  const member = interaction.member?.user;
  const direct = interaction.user;
  const user = member || direct || {};
  const id = String(user.id || '');
  if (!/^\d{15,22}$/.test(id)) throw Object.assign(new Error('Discord user information is missing.'), { userMessage: true });
  return { id, username: user.global_name || user.username || 'Discord user' };
}

async function linkedUser(discordUserId) {
  const result = await pool.query(
    `SELECT u.* FROM discord_accounts d JOIN users u ON u.id = d.user_id
     WHERE d.discord_user_id = $1 AND u.status = 'active'`,
    [discordUserId],
  );
  if (!result.rowCount) return null;
  return store.get('User', result.rows[0].id);
}

async function makeLink(interaction) {
  const identity = discordIdentity(interaction);
  const token = randomToken(32);
  await pool.query('DELETE FROM discord_link_tokens WHERE discord_user_id = $1 OR expires_at <= now()', [identity.id]);
  await pool.query(
    `INSERT INTO discord_link_tokens(token_hash, discord_user_id, discord_username, expires_at)
     VALUES ($1, $2, $3, now() + interval '15 minutes')`,
    [sha256(token), identity.id, identity.username],
  );
  const site = await platformName();
  return discordMessage(`Connect your Discord account to ${site}. This private link expires in 15 minutes and can only be used once.`, [
    { type: 1, components: [{ type: 2, style: 5, label: `Link ${site} account`.slice(0, 80), url: `${config.appUrl}/discord-link?token=${encodeURIComponent(token)}` }] },
  ]);
}

async function requireLinked(interaction) {
  const identity = discordIdentity(interaction);
  const user = await linkedUser(identity.id);
  if (!user) throw Object.assign(new Error('Your Discord user is not linked. Run `/link` first.'), { userMessage: true });
  return { ...user, trusted_source: 'discord' };
}

async function submitRequest(interaction, actor) {
  const options = optionsMap(interaction);
  const result = await invokeInternal('submitRequest', {
    subdomain: String(options.name || '').toLowerCase(), root_domain: String(options.domain || '').toLowerCase(),
    reason: options.reason, preview_link: options.preview, trusted_source: 'discord',
    records: [{ record_type: options.type, record_value: options.value, ttl: options.ttl || 3600, proxied: Boolean(options.proxied) }],
  }, actor);
  const request = result.requests?.[0];
  return request?.id ? requestUi.view(actor, request.id, false, 'Request submitted. Your records share one conversation.') : discordMessage('Request submitted. Run /requests to view it.');
}

async function manageRequest(interaction, actor) {
  if (!['staff', 'admin'].includes(actor.role)) throw Object.assign(new Error('Staff access required.'), { userMessage: true });
  const options = optionsMap(interaction);
  if (options.action === 'approve') return requestUi.view(actor, String(options.id || ''), true);
  if (!['reject', 'question', 'note'].includes(options.action)) throw Object.assign(new Error('Unknown review action.'), { userMessage: true });
  return requestUi.act(actor, String(options.id || ''), `send-${options.action}`, options.message);
}

async function commandResponse(interaction) {
  if (interaction.data?.name === 'link') return makeLink(interaction);
  const ticketControl = String(interaction.data?.custom_id || '').startsWith('tk:');
  const identity = discordIdentity(interaction);
  if ((interaction.data?.name === 'ticket' || interaction.data?.custom_id === 'tk:open') && !(await linkedUser(identity.id))) {
    const link = await makeLink(interaction);
    return { ...link, content: `To open a ticket, first link your ${await platformName()} account so we can see your subdomains. ${link.content}` };
  }
  const actor = await requireLinked(interaction);
  if (String(interaction.data?.custom_id || '').startsWith('dp:')) return deploys.component(interaction, actor, identity);
  if ([3, 5].includes(interaction.type)) return ticketControl ? tickets.component(interaction, actor, identity) : requestUi.component(interaction, actor);
  if (interaction.data?.name === 'ticket') return tickets.start();
  if (interaction.data?.name === 'tickets') return tickets.list(actor);
  if (interaction.data?.name === 'ticket-panel') return tickets.postPanel(actor, interaction.channel_id);
  if (interaction.data?.name === 'deploy') return deploys.panel(actor);
  if (interaction.data?.name === 'panel') return requestUi.list(actor, ['staff', 'admin'].includes(actor.role) ? 'pending' : 'mine');
  if (interaction.data?.name === 'request') return submitRequest(interaction, actor);
  if (interaction.data?.name === 'requests') return requestUi.list(actor, optionsMap(interaction).scope || 'mine');
  if (interaction.data?.name === 'request-view') return requestUi.view(actor, String(optionsMap(interaction).id || ''));
  if (interaction.data?.name === 'request-manage') return manageRequest(interaction, actor);
  throw Object.assign(new Error('Unknown command.'), { userMessage: true });
}

async function editInteraction(interaction, content, bot) {
  const payload = typeof content === 'string' ? discordMessage(content) : content;
  const response = await fetch(`${DISCORD_API}/webhooks/${bot.application_id}/${interaction.token}/messages/@original`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    // Do not include the webhook URL: it contains the interaction token.
    throw Object.assign(new Error(`Discord interaction update failed (${response.status})`), {
      status: response.status, discordCode: details.code, discordErrors: details.errors,
    });
  }
}

async function registerCommands(logger) {
  const bot = await botConfigured();
  if (!bot) return;
  const target = bot.guild_id
    ? `${DISCORD_API}/applications/${bot.application_id}/guilds/${bot.guild_id}/commands`
    : `${DISCORD_API}/applications/${bot.application_id}/commands`;
  try {
    const response = await fetch(target, {
      method: 'PUT', headers: { Authorization: `Bot ${bot.bot_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commandList(await platformName())),
    });
    if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${await response.text()}`);
    logger.info('Discord bot commands registered');
  } catch (error) {
    logger.error(error, 'Discord bot command registration failed');
  }
}

export async function registerDiscordRoutes(app) {
  app.get('/api/discord/status', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const link = await pool.query('SELECT discord_user_id, discord_username, linked_at FROM discord_accounts WHERE user_id = $1', [user.id]);
    return { enabled: Boolean(await botConfigured()), linked: Boolean(link.rowCount), account: link.rows[0] || null };
  });

  app.post('/api/discord/link', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    if (!(await botConfigured())) return reply.code(404).send({ error: 'Discord bot is disabled' });
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const tokenHash = sha256(String(request.body?.token || ''));
    const linked = await transaction(async (client) => {
      const token = await client.query('DELETE FROM discord_link_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING *', [tokenHash]);
      if (!token.rowCount) return null;
      const identity = token.rows[0];
      // A Discord account that signs in to another user cannot be moved here.
      const signIn = await client.query("SELECT user_id FROM user_identities WHERE provider = 'discord' AND provider_user_id = $1", [identity.discord_user_id]);
      if (signIn.rowCount && signIn.rows[0].user_id !== user.id) return { conflict: true };
      await client.query('DELETE FROM discord_accounts WHERE user_id = $1 OR discord_user_id = $2', [user.id, identity.discord_user_id]);
      await client.query('INSERT INTO discord_accounts(discord_user_id, user_id, discord_username) VALUES ($1, $2, $3)', [identity.discord_user_id, user.id, identity.discord_username]);
      return identity;
    });
    if (!linked) return reply.code(400).send({ error: 'This Discord link is invalid or has expired' });
    if (linked.conflict) return reply.code(409).send({ error: `This Discord account is already linked to a different ${await platformName()} user` });
    return { success: true, username: linked.discord_username };
  });

  app.delete('/api/discord/link', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    await pool.query('DELETE FROM discord_accounts WHERE user_id = $1', [user.id]);
    return { success: true };
  });

  app.get('/api/discord/tickets', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const all = request.query?.scope === 'all';
    if (all && !['staff', 'admin'].includes(user.role)) return reply.code(403).send({ error: 'Forbidden' });
    const status = ['open', 'closed'].includes(request.query?.status) ? request.query.status : null;
    const values = [];
    const clauses = ["t.status <> 'opening'"];
    if (!all) { values.push(user.id); clauses.push(`t.user_id = $${values.length}`); }
    if (status) { values.push(status); clauses.push(`t.status = $${values.length}`); }
    const result = await pool.query(
      `SELECT t.id, t.number, t.category_label, t.subdomain, t.status, t.guild_id, t.channel_id, t.channel_deleted_at, t.discord_username,
              t.created_at, t.claimed_at, t.closed_at, t.close_reason, u.email AS user_email, c.email AS claimed_by_email
       FROM discord_tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users c ON c.id = t.claimed_by_id
       WHERE ${clauses.join(' AND ')} ORDER BY t.created_at DESC LIMIT 200`, values);
    return { tickets: result.rows.map((row) => (all ? row : { ...row, claimed_by_email: undefined })) };
  });

  app.get('/api/discord/tickets/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (!/^[0-9a-f-]{36}$/i.test(String(request.params.id))) return reply.code(404).send({ error: 'Ticket not found' });
    const result = await pool.query(
      `SELECT t.*, u.email AS user_email, c.email AS claimed_by_email, x.email AS closed_by_email
       FROM discord_tickets t JOIN users u ON u.id = t.user_id
       LEFT JOIN users c ON c.id = t.claimed_by_id LEFT JOIN users x ON x.id = t.closed_by_id
       WHERE t.id = $1 AND t.status <> 'opening'`, [request.params.id]);
    const ticket = result.rows[0];
    const elevated = ['staff', 'admin'].includes(user.role);
    // Owners and staff only; anyone else gets the same answer as a missing ticket.
    if (!ticket || (!elevated && ticket.user_id !== user.id)) return reply.code(404).send({ error: 'Ticket not found' });
    if (request.query?.format === 'txt') return reply.type('text/plain; charset=utf-8').header('Content-Disposition', `attachment; filename="ticket-${ticket.number}.txt"`).send(transcriptText(ticket));
    return { ticket: elevated ? ticket : { ...ticket, claimed_by_email: undefined, closed_by_email: undefined } };
  });

  app.post('/api/discord/interactions', { config: { rawBody: true, rateLimit: false } }, async (request, reply) => {
    const bot = await botConfigured();
    if (!bot) return reply.code(404).send({ error: 'Discord bot is disabled' });
    const timestamp = request.headers['x-signature-timestamp'];
    const signature = request.headers['x-signature-ed25519'];
    if (!verifyDiscordSignature(request.rawBody, timestamp, signature, bot.public_key)) return reply.code(401).send({ error: 'Invalid Discord signature' });
    const interaction = request.body;
    if (interaction?.type === 1) return { type: 1 };
    if (![2, 3, 5].includes(interaction?.type)) return { type: 4, data: { content: 'Unsupported interaction.', flags: EPHEMERAL } };
    await pool.query("DELETE FROM discord_interactions WHERE received_at < now() - interval '1 day'");
    const claimed = await pool.query('INSERT INTO discord_interactions(interaction_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING interaction_id', [String(interaction.id || '')]);
    if (!claimed.rowCount) return { type: 4, data: { content: 'This command has already been processed.', flags: EPHEMERAL } };
    let modal;
    try {
      modal = discordModal(interaction) || await tickets.modal(interaction);
    } catch (error) {
      if (!error.userMessage) request.log.error({ err: error, control: interaction.data?.custom_id }, 'Discord form failed');
      return { type: 4, data: { content: error.userMessage ? error.message : 'The form could not open. Try again shortly.', flags: EPHEMERAL } };
    }
    if (modal) return modal;
    const deployControl = interaction.type === 3 && String(interaction.data?.custom_id || '').startsWith('dp:');
    reply.send(updatesInPlace(interaction) || deployControl ? { type: 6 } : { type: 5, data: { flags: EPHEMERAL } });
    const context = { interactionId: interaction.id, command: interaction.data?.name, control: interaction.data?.custom_id };
    void commandResponse(interaction)
      .catch((error) => {
        request.log.error({ err: error, ...context }, 'Discord command failed');
        return discordMessage(error.userMessage || (error.status >= 400 && error.status < 500) ? error.message : 'The action could not finish. Refresh the request before retrying, or use the web dashboard.');
      })
      .then((content) => editInteraction(interaction, content, bot))
      .catch(async (error) => {
        request.log.error({ err: error, ...context, discordCode: error.discordCode, discordErrors: error.discordErrors }, 'Discord response update failed');
        await editInteraction(interaction, 'Discord could not display the response. Your action may have completed. Check the web dashboard before retrying.', bot)
          .catch((fallbackError) => request.log.error({ err: fallbackError, ...context }, 'Discord fallback response failed'));
      });
    return reply;
  });

  void registerCommands(app.log);
  // The update script restarts this process, so pick up any run still going.
  void deploys.resume().catch((error) => app.log.error(error, 'Resuming Discord deploys failed'));
}
