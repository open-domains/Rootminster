import { createDiscordRequests, discordMessage, discordModal } from './lib/discord-requests.js';
import crypto from 'node:crypto';
import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { getModuleConfig } from './module-settings.js';
import { pool, transaction } from './database.js';
import { invokeInternal } from './function-runner.js';
import { randomToken, sha256 } from './security.js';
import { store } from './store.js';

const DISCORD_API = 'https://discord.com/api/v10';
const EPHEMERAL = 64;
const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
const requestUi = createDiscordRequests();

const commands = [
  { name: 'panel', description: 'Open your request controls and staff review queue' },
  { name: 'link', description: 'Link your Discord user to your Rootminster account' },
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
  return discordMessage('Connect your Discord account to Rootminster. This private link expires in 15 minutes and can only be used once.', [
    { type: 1, components: [{ type: 2, style: 5, label: 'Link Rootminster account', url: `${config.appUrl}/discord-link?token=${encodeURIComponent(token)}` }] },
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
  const actor = await requireLinked(interaction);
  if ([3, 5].includes(interaction.type)) return requestUi.component(interaction, actor);
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
  if (!response.ok) throw new Error(`Discord interaction update failed (${response.status})`);
}

async function registerCommands(logger) {
  const bot = await botConfigured();
  if (!bot) return;
  const target = bot.guild_id
    ? `${DISCORD_API}/applications/${bot.application_id}/guilds/${bot.guild_id}/commands`
    : `${DISCORD_API}/applications/${bot.application_id}/commands`;
  try {
    const response = await fetch(target, {
      method: 'PUT', headers: { Authorization: `Bot ${bot.bot_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands),
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
      await client.query('DELETE FROM discord_accounts WHERE user_id = $1 OR discord_user_id = $2', [user.id, identity.discord_user_id]);
      await client.query('INSERT INTO discord_accounts(discord_user_id, user_id, discord_username) VALUES ($1, $2, $3)', [identity.discord_user_id, user.id, identity.discord_username]);
      return identity;
    });
    if (!linked) return reply.code(400).send({ error: 'This Discord link is invalid or has expired' });
    return { success: true, username: linked.discord_username };
  });

  app.delete('/api/discord/link', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    await pool.query('DELETE FROM discord_accounts WHERE user_id = $1', [user.id]);
    return { success: true };
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
    const modal = discordModal(interaction);
    if (modal) return modal;
    reply.send({ type: 5, data: { flags: EPHEMERAL } });
    void commandResponse(interaction)
      .then((content) => editInteraction(interaction, content, bot))
      .catch((error) => {
        request.log.error(error, 'Discord command failed');
        return editInteraction(interaction, error.userMessage || (error.status >= 400 && error.status < 500) ? error.message : 'The action could not finish. Refresh the request before retrying, or use the web dashboard.', bot);
      })
      .catch((error) => request.log.error(error, 'Discord response update failed'));
    return reply;
  });

  void registerCommands(app.log);
}
