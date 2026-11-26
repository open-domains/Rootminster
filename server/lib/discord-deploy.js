import crypto from 'node:crypto';

// Redeploys production from Discord through the host-side deploy runner
// (scripts/deploy-runner). The app cannot restart itself, so it asks the
// runner to start the server's update script, then follows the run by ID.
// The update script recreates this container, so a run that is still active
// when the process starts is picked up again by resume().

export const ACTIVE_DEPLOY_STATUSES = ['starting', 'running'];
const POLL_MS = 10_000;
// After this long without a result the run is marked unknown, so a lost
// runner cannot block redeploys for ever.
const GIVE_UP_MS = 45 * 60_000;
// Discord interaction tokens last 15 minutes; leave some margin.
const TOKEN_MS = 14 * 60_000;

const fail = (message) => { throw Object.assign(new Error(message), { userMessage: true }); };
const button = (label, custom_id, style = 2) => ({ type: 2, style, label, custom_id });
const row = (...components) => ({ type: 1, components });
const message = (content, components = []) => ({ content: String(content).slice(0, 1950), components, allowed_mentions: { parse: [] } });
const safe = (value) => String(value ?? '').replace(/([\\`*_~|>@])/g, '\\$1');
const when = (value) => (value ? `<t:${Math.floor(new Date(value).getTime() / 1000)}:R>` : 'unknown');

export function deployRoles(setting) {
  return setting === 'staff' ? ['staff', 'admin'] : ['admin'];
}

// The runner refuses a nonce it has seen in the last two minutes, and any
// timestamp more than a minute away from its clock.
export function signRunnerRequest(secret, method, path, body = '', timestamp = Math.floor(Date.now() / 1000), nonce = crypto.randomBytes(16).toString('hex')) {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${nonce}.${method}.${path}.${body}`).digest('hex');
  return { 'X-Rootminster-Timestamp': String(timestamp), 'X-Rootminster-Nonce': nonce, 'X-Rootminster-Signature': signature };
}

export function createRunnerClient({ fetchImpl = fetch } = {}) {
  return async function call(settings, method, path, payload) {
    const base = String(settings.runner_url || '').replace(/\/+$/, '');
    if (!base || !settings.shared_secret) fail('The deploy runner is not configured.');
    const body = payload === undefined ? '' : JSON.stringify(payload);
    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers: { ...signRunnerRequest(settings.shared_secret, method, path, body), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body } : {}),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw Object.assign(new Error('The deploy runner could not be reached.'), { unreachable: true });
    }
    const result = await response.json().catch(() => ({}));
    return { status: response.status, body: result };
  };
}

export function createDiscordDeploys({
  db, settings, runner, api, audit, platformName = async () => 'Rootminster', applicationId = async () => '',
  pollMs = POLL_MS, now = () => Date.now(), log = console,
}) {
  const watching = new Set();

  async function allowed(actor) {
    const current = await settings();
    if (!current?.enabled) fail('Discord redeploys are turned off. An admin can enable the Discord deploy module.');
    if (!deployRoles(current.allowed_roles).includes(actor?.role)) {
      fail(current.allowed_roles === 'staff' ? 'Staff access required.' : 'Only admins can redeploy.');
    }
    return current;
  }

  async function activeRun() {
    const result = await db.query(
      `SELECT * FROM deploy_runs WHERE status = ANY($1::text[]) ORDER BY created_at DESC LIMIT 1`, [ACTIVE_DEPLOY_STATUSES]);
    return result.rows[0] || null;
  }

  async function lastRun() {
    const result = await db.query('SELECT * FROM deploy_runs ORDER BY created_at DESC LIMIT 1', []);
    return result.rows[0] || null;
  }

  function describe(run) {
    const by = safe(run.discord_username || run.requested_by_email || 'someone');
    if (ACTIVE_DEPLOY_STATUSES.includes(run.status)) return `A redeploy started by ${by} ${when(run.started_at || run.created_at)} is still running.`;
    const label = { succeeded: 'succeeded', failed: 'failed', unknown: 'finished with an unknown result' }[run.status] || run.status;
    return `The last redeploy, started by ${by}, ${label} ${when(run.finished_at || run.created_at)}.`;
  }

  // /deploy: a confirmation panel. Nothing runs until Confirm is pressed.
  async function panel(actor) {
    await allowed(actor);
    const site = await platformName();
    const active = await activeRun();
    if (active) return message(describe(active), [row(button('Refresh', 'dp:refresh'))]);
    const last = await lastRun();
    return message([
      `**Redeploy ${safe(site)}?**`,
      'This runs the update script on the server, which pulls the latest version and restarts the site. The site and the bot are briefly unavailable while it restarts.',
      last ? describe(last) : '',
    ].filter(Boolean).join('\n\n'), [row(button('Confirm redeploy', 'dp:confirm', 4), button('Cancel', 'dp:cancel'))]);
  }

  async function confirm(interaction, actor, identity) {
    const current = await allowed(actor);
    const id = crypto.randomUUID();
    let run;
    try {
      // deploy_runs_one_active allows one starting or running row at a time.
      const inserted = await db.query(
        `INSERT INTO deploy_runs(id, requested_by_id, requested_by_email, discord_user_id, discord_username, interaction_token, channel_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'starting') RETURNING *`,
        [id, actor.id, actor.email, identity.id, identity.username, interaction.token || null, interaction.channel_id || null]);
      run = inserted.rows[0];
    } catch (error) {
      if (error.code !== '23505') throw error;
      const active = await activeRun();
      return message(active ? describe(active) : 'A redeploy is already running.', [row(button('Refresh', 'dp:refresh'))]);
    }
    await audit({
      actor_email: actor.email, actor_role: actor.role, action: 'deploy_requested', entity_type: 'DeployRun', entity_id: id,
      description: `${actor.email} (Discord ${identity.username}) started a redeploy from Discord`,
    }, actor);

    let response;
    try {
      response = await runner(current, 'POST', '/runs', { id, requested_by: `${actor.email} (${identity.username})` });
    } catch (error) {
      await finish(run, { status: 'failed', error: error.message });
      return message(`The redeploy did not start: ${error.message}`);
    }
    if (response.status === 409) {
      await finish(run, { status: 'failed', error: 'The server reported that another deploy is already running.' });
      return message('The server is already running a deploy, possibly one started outside Discord. Try again when it finishes.');
    }
    if (response.status !== 200 && response.status !== 202) {
      const reason = response.status === 401 ? 'the shared secret does not match the runner.' : `the runner answered ${response.status}.`;
      await finish(run, { status: 'failed', error: `Runner rejected the request: ${reason}` });
      return message(`The redeploy did not start: ${reason}`);
    }
    const started = await db.query(
      `UPDATE deploy_runs SET status = 'running', started_at = now() WHERE id = $1 AND status = 'starting' RETURNING *`, [id]);
    run = started.rows[0] || run;
    await notifyChannel(current, `🚀 ${safe(identity.username)} started a redeploy of ${safe(await platformName())}.`);
    if (response.body?.status && !ACTIVE_DEPLOY_STATUSES.includes(response.body.status)) {
      // The script could not even start. Answer here rather than editing the
      // message twice.
      const done = await complete(run, response.body, { notifyRequester: false });
      return message(resultText(done || { ...run, ...response.body }, await platformName()));
    }
    watch(run);
    return message(`**Redeploy started.** The site will restart in a moment. This message updates when the update script finishes.`, [row(button('Refresh', 'dp:refresh'))]);
  }

  async function refresh(actor) {
    await allowed(actor);
    const active = await activeRun();
    const last = active || await lastRun();
    return message(last ? describe(last) : 'No redeploys yet.', active ? [row(button('Refresh', 'dp:refresh'))] : []);
  }

  async function component(interaction, actor, identity) {
    const action = String(interaction.data?.custom_id || '').split(':')[1];
    if (action === 'cancel') return message('Redeploy cancelled. Nothing was changed.');
    if (action === 'confirm') return confirm(interaction, actor, identity);
    if (action === 'refresh') return refresh(actor);
    fail('This control has expired. Run /deploy again.');
  }

  // Following a run ---------------------------------------------------------

  async function finish(run, { status, exit_code = null, error = null, log_tail = null }) {
    const result = await db.query(
      `UPDATE deploy_runs SET status = $2, exit_code = $3, error = $4, log_tail = $5, finished_at = now(), interaction_token = NULL
       WHERE id = $1 AND status = ANY($6::text[]) RETURNING *`,
      [run.id, status, exit_code, error, log_tail, ACTIVE_DEPLOY_STATUSES]);
    return result.rows[0] || null;
  }

  function resultText(run, site) {
    const by = safe(run.discord_username || run.requested_by_email || 'someone');
    if (run.status === 'succeeded') return `✅ The redeploy of ${safe(site)} started by ${by} finished successfully.`;
    const detail = run.error ? ` ${safe(run.error)}` : '';
    const tail = run.log_tail ? `\n\`\`\`\n${String(run.log_tail).replace(/`/g, "'").slice(-1500)}\n\`\`\`` : '';
    if (run.status === 'unknown') return `⚠️ The redeploy started by ${by} has no result.${detail} Check the server.`;
    return `❌ The redeploy of ${safe(site)} started by ${by} failed.${detail}${tail}`;
  }

  async function complete(run, remote, { notifyRequester = true } = {}) {
    const status = ['succeeded', 'failed'].includes(remote.status) ? remote.status : 'unknown';
    const done = await finish(run, { status, exit_code: remote.exit_code ?? null, error: remote.error || null, log_tail: remote.log_tail || null });
    if (!done) return null; // Another process already reported it.
    await audit({
      actor_email: done.requested_by_email, actor_role: 'system', action: `deploy_${status}`, entity_type: 'DeployRun', entity_id: done.id,
      description: `Redeploy requested by ${done.requested_by_email} ${status}${done.error ? `: ${done.error}` : ''}`,
    }).catch((error) => log.error?.({ err: error }, 'Deploy audit log failed'));
    await report({ ...done, interaction_token: notifyRequester ? run.interaction_token : null, discord_user_id: notifyRequester ? done.discord_user_id : null });
    return done;
  }

  async function report(run) {
    const current = await settings();
    const text = resultText(run, await platformName());
    let shown = false;
    const tokenFresh = run.interaction_token && now() - new Date(run.created_at).getTime() < TOKEN_MS;
    if (tokenFresh) {
      try {
        await api.call('PATCH', `/webhooks/${await applicationId()}/${run.interaction_token}/messages/@original`, message(text));
        shown = true;
      } catch (error) {
        log.warn?.({ err: error, deployId: run.id }, 'Deploy result could not update the Discord message');
      }
    }
    if (!shown && run.discord_user_id) {
      try {
        const dm = await api.call('POST', '/users/@me/channels', { recipient_id: run.discord_user_id });
        await api.call('POST', `/channels/${dm.id}/messages`, message(text));
      } catch (error) {
        log.warn?.({ err: error, deployId: run.id }, 'Deploy result DM failed');
      }
    }
    await notifyChannel(current, text);
  }

  async function notifyChannel(current, text) {
    if (!/^\d{15,22}$/.test(String(current?.log_channel_id || ''))) return;
    try {
      await api.call('POST', `/channels/${current.log_channel_id}/messages`, message(text));
    } catch (error) {
      log.warn?.({ err: error }, 'Deploy log channel message failed');
    }
  }

  async function check(run) {
    const current = await settings();
    if (now() - new Date(run.created_at).getTime() > GIVE_UP_MS) {
      return complete(run, { status: 'unknown', error: 'No result arrived from the server within 45 minutes.' });
    }
    let response;
    try {
      response = await runner(current, 'GET', `/runs/${run.id}`);
    } catch {
      return null; // The runner or network is briefly away; try again later.
    }
    if (response.status === 404) {
      // A starting run may still be on its way to the runner. Past two
      // minutes the process died before the request arrived.
      if (run.status === 'starting' && now() - new Date(run.created_at).getTime() < 2 * 60_000) return null;
      return complete(run, { status: run.status === 'starting' ? 'failed' : 'unknown', error: run.status === 'starting' ? 'The redeploy never reached the server.' : 'The server has no record of this run.' });
    }
    if (response.status !== 200 || ACTIVE_DEPLOY_STATUSES.includes(response.body?.status)) return null;
    return complete(run, response.body);
  }

  function watch(run) {
    if (watching.has(run.id)) return;
    watching.add(run.id);
    const tick = async () => {
      try {
        const fresh = (await db.query('SELECT * FROM deploy_runs WHERE id = $1', [run.id])).rows[0];
        if (!fresh || !ACTIVE_DEPLOY_STATUSES.includes(fresh.status) || await check(fresh)) {
          watching.delete(run.id);
          return;
        }
      } catch (error) {
        log.error?.({ err: error, deployId: run.id }, 'Deploy status check failed');
      }
      setTimeout(tick, pollMs).unref?.();
    };
    setTimeout(tick, pollMs).unref?.();
  }

  // Called at startup: the update script restarts this process mid-run.
  async function resume() {
    const result = await db.query('SELECT * FROM deploy_runs WHERE status = ANY($1::text[])', [ACTIVE_DEPLOY_STATUSES]);
    for (const run of result.rows) watch(run);
    return result.rows.length;
  }

  return { panel, component, check, resume, watch, resultText };
}
