import crypto from 'node:crypto';
import { authenticateRequest } from './auth.js';
import { config } from './config.js';
import { pool } from './database.js';
import { invokeInternal } from './function-runner.js';
import { cloudflareFetch } from './lib/cloudflare.js';
import { getModuleConfig } from './module-settings.js';
import { randomToken, sha256 } from './security.js';
import { store } from './store.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const REPO_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const GITHUB_PAGES_RECORDS = [
  ...['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'].map(content => ({ type: 'A', content })),
  ...['2606:50c0:8000::153', '2606:50c0:8001::153', '2606:50c0:8002::153', '2606:50c0:8003::153'].map(content => ({ type: 'AAAA', content })),
];

const pkce = (value) => crypto.createHash('sha256').update(value).digest('base64url');

function bearer(request) {
  return /^Bearer\s+(.+)$/i.exec(String(request.headers.authorization || ''))?.[1] || '';
}

function sameSecret(left, right) {
  const a = Buffer.from(sha256(String(left || '')), 'hex');
  const b = Buffer.from(sha256(String(right || '')), 'hex');
  return crypto.timingSafeEqual(a, b);
}

function designOrigin(module) {
  const url = new URL(module.base_url);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw Object.assign(new Error('Design base URL must use HTTPS'), { status: 400 });
  }
  return url.origin;
}

async function designModule() {
  const module = await getModuleConfig('design');
  if (!module.enabled) throw Object.assign(new Error('Design is not available'), { status: 404 });
  return module;
}

async function serviceModule(request) {
  const module = await designModule();
  if (!sameSecret(bearer(request), module.service_secret)) throw Object.assign(new Error('Invalid Design client'), { status: 401 });
  return module;
}

async function profile(subject, sessionId, module) {
  const result = await pool.query(`SELECT u.id, u.email, u.role, s.id AS session_id
    FROM users u JOIN sessions s ON s.user_id = u.id
    WHERE u.id::text = $1 AND s.id::text = $2
      AND u.status = 'active' AND u.email_verified_at IS NOT NULL
      AND s.expires_at > now() AND s.impersonator_user_id IS NULL
      AND (s.mfa_verified_at IS NOT NULL OR
        (NOT coalesce(u.totp_enabled, false) AND u.role NOT IN ('staff', 'admin')
          AND NOT EXISTS(SELECT 1 FROM webauthn_credentials w WHERE w.user_id = u.id)))`, [subject, sessionId]);
  const user = result.rows[0];
  if (!user || (module.admins_only && user.role !== 'admin')) return null;
  return { issuer: new URL(config.appUrl).origin, audience: 'design', subject: user.id, email: user.email, email_verified: true, session_id: user.session_id };
}

async function serviceProfile(request, module) {
  const subject = String(request.body?.subject || '');
  const sessionId = String(request.body?.session_id || '');
  if (!subject || !sessionId || subject.length > 128 || sessionId.length > 128) throw Object.assign(new Error('Invalid session'), { status: 400 });
  const user = await profile(subject, sessionId, module);
  if (!user) throw Object.assign(new Error('Inactive session'), { status: 401 });
  return user;
}

async function inspectHostname(userId, hostname) {
  const name = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME.test(name)) throw Object.assign(new Error('Invalid hostname'), { status: 400 });
  const rows = await store.filter('DnsRecord', { owner_id: userId, name, status: 'active' }, '-created_date', 20);
  const anchor = rows.find((item) => item.managed !== false && item.zone_id && item.cloudflare_record_id);
  if (!anchor) throw Object.assign(new Error('This hostname is not an active managed subdomain owned by the signed-in user'), { status: 403 });
  const listed = cfResult(await cloudflareFetch('GET', `/zones/${anchor.zone_id}/dns_records?name=${encodeURIComponent(name)}&per_page=100`), 'DNS inspection failed');
  const records = Array.isArray(listed) ? listed : [];
  const desired = new Set(GITHUB_PAGES_RECORDS.map(record => `${record.type}:${record.content.toLowerCase()}`));
  const summary = record => ({ type: record.type, content: record.content, proxied: !!record.proxied });
  const conflicts = records.filter(record => record.type === 'CNAME' || (['A', 'AAAA'].includes(record.type) && (!desired.has(`${record.type}:${String(record.content).toLowerCase()}`) || record.proxied))).map(summary);
  const blocking = records.filter(record => record.type === 'NS').map(summary);
  const preserved = records.filter(record => !['A', 'AAAA', 'CNAME', 'NS'].includes(record.type)).map(summary);
  const satisfied = records.filter(record => desired.has(`${record.type}:${String(record.content).toLowerCase()}`) && !record.proxied).map(summary);
  const revision = sha256(JSON.stringify(records.map(record => [record.id, record.type, record.content, !!record.proxied]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  return { anchor, records, preview: { hostname: name, conflicts, blocking, preserved, satisfied, proposed: GITHUB_PAGES_RECORDS, revision } };
}

async function removeDnsRecord(zoneId, record) {
  cfResult(await cloudflareFetch('DELETE', `/zones/${zoneId}/dns_records/${record.id}`), `Could not remove existing ${record.type} record`);
  const stored = await store.filter('DnsRecord', { cloudflare_record_id: record.id }, '-created_date', 20);
  await Promise.all(stored.map(item => store.delete('DnsRecord', item.id)));
}

async function createPagesRecord(anchor, hostname, record, user) {
  const created = cfResult(await cloudflareFetch('POST', `/zones/${anchor.zone_id}/dns_records`, { type: record.type, name: hostname, content: record.content, ttl: 1, proxied: false }), `Could not create GitHub Pages ${record.type} record`);
  return store.create('DnsRecord', {
    zone_id: anchor.zone_id, zone_name: anchor.zone_name, cloudflare_record_id: created.id,
    record_type: record.type, name: hostname, subdomain: anchor.subdomain, content: record.content,
    proxied: false, ttl: created.ttl || 1, managed: true, owner_email: user.email,
    owner_id: user.subject, status: 'active', last_synced: new Date().toISOString(), dns_verified: null,
  }, { id: user.subject, email: user.email, role: 'user' });
}

function cfResult(response, fallback) {
  if (!response.success) {
    const message = response.errors?.map((error) => error.message).filter(Boolean).join('; ') || fallback;
    throw Object.assign(new Error(message), { status: response._httpStatus >= 400 ? response._httpStatus : 502 });
  }
  return response.result;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function designAnalytics(user, body = {}) {
  const actions = { create: 'enable', tracking_code: 'status', stats: 'stats' };
  const requestedAction = String(body.action || '');
  const action = actions[requestedAction];
  if (!action) throw Object.assign(new Error('Analytics action must be create, tracking_code, or stats'), { status: 400 });
  const subdomain = String(body.subdomain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME.test(subdomain)) throw Object.assign(new Error('Invalid hostname'), { status: 400 });

  const input = { action, subdomain };
  if (action === 'stats') {
    const days = body.days === undefined ? 30 : Number(body.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw Object.assign(new Error('Days must be an integer from 1 to 365'), { status: 400 });
    const timezone = String(body.timezone || 'UTC');
    try {
      Intl.DateTimeFormat('en', { timeZone: timezone });
    } catch {
      throw Object.assign(new Error('Timezone must be a valid IANA timezone name'), { status: 400 });
    }
    Object.assign(input, { days, timezone });
  }

  const result = await invokeInternal('analyticsManager', input, {
    id: user.subject,
    email: user.email,
    role: 'user',
    trusted_source: 'design',
  });
  if (requestedAction === 'tracking_code') {
    if (!result.enabled || !result.tracking_snippet) throw Object.assign(new Error('Analytics is not enabled for this subdomain'), { status: 409 });
    return {
      subdomain: result.subdomain,
      website_id: result.website_id,
      tracker_url: result.tracker_url,
      tracking_code: result.tracking_snippet,
      enabled_at: result.enabled_at,
    };
  }
  if (requestedAction === 'create') {
    return {
      subdomain,
      enabled: Boolean(result.enabled),
      website_id: result.website_id,
      tracking_code: result.tracking_snippet,
      enabled_at: result.enabled_at || null,
    };
  }
  return result;
}

export async function registerDesignRoutes(app) {
  app.get('/api/design-auth/authorize', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const module = await designModule();
      const designBase = designOrigin(module);
      const rootminsterBase = new URL(config.appUrl).origin;
      const redirectUri = `${designBase}/api/auth/rootminster/callback`;
      const query = request.query || {};
      reply
        .header('Cache-Control', 'no-store, no-transform')
        .header('Cloudflare-CDN-Cache-Control', 'no-store, no-transform')
        .header('Referrer-Policy', 'no-referrer');
      if (query.client_id !== 'design' || query.redirect_uri !== redirectUri || query.response_type !== 'code' || query.code_challenge_method !== 'S256' || !TOKEN.test(query.state || '') || !TOKEN.test(query.code_challenge || '')) return reply.code(400).send({ error: 'Invalid authorization request' });
      const user = await authenticateRequest(request, { allowMfaPending: true });
      if (!user) return reply.redirect(`/login?return_to=${encodeURIComponent(request.url)}`);
      if (user.mfa_required && !user.mfa_verified) return reply.redirect(`/user-dashboard?return_to=${encodeURIComponent(request.url)}`);
      if (user.impersonation?.active || (module.admins_only && user.role !== 'admin') || !await profile(user.id, user._session_id, module)) {
        return reply.code(403).send({ error: module.admins_only ? 'Design is currently available to administrators only.' : 'Use your own verified, active account to sign in to Design.' });
      }
      const consent = randomToken(32);
      await pool.query('DELETE FROM design_auth_requests WHERE expires_at < now()');
      await pool.query(`INSERT INTO design_auth_requests(request_hash,user_id,session_id,state,challenge,redirect_uri,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,now() + interval '10 minutes')`, [sha256(consent), user.id, user._session_id, query.state, query.code_challenge, redirectUri]);
      reply.header('Content-Security-Policy', `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; form-action ${rootminsterBase} ${designBase}; frame-ancestors 'none'; base-uri 'none'`);
      return reply.type('text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize Design</title><style>body{font-family:system-ui;background:#071a2d;color:#f8fbff;display:grid;min-height:100vh;place-items:center;margin:0}.card{width:min(520px,calc(100% - 48px));padding:32px;border:1px solid #244764;border-radius:18px;background:#0d263c}p{color:#b8cad8;line-height:1.6}form{display:flex;gap:12px;margin-top:24px}button{padding:12px 18px;border:0;border-radius:10px;font-weight:700;cursor:pointer}.allow{background:#0c5da1;color:white}.deny{background:#263f53;color:white}</style></head><body><main class="card"><h1>Continue to Design?</h1><p>Design by Open-Domains will receive your verified account ID and email address. It will not receive your password or Rootminster session token.</p><p>Signed in as <strong><!--email_off-->${escapeHtml(user.email)}<!--/email_off--></strong></p><form method="post" action="${rootminsterBase}/api/design-auth/authorize"><input type="hidden" name="consent" value="${escapeHtml(consent)}"><button class="allow" name="decision" value="allow">Continue</button><button class="deny" name="decision" value="deny">Cancel</button></form></main></body></html>`);
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/authorize', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Sign in before continuing' });
    const result = await pool.query(`DELETE FROM design_auth_requests WHERE request_hash=$1 AND user_id=$2 AND session_id=$3 AND expires_at>now() RETURNING *`, [sha256(String(request.body?.consent || '')), user.id, user._session_id]);
    const grant = result.rows[0];
    if (!grant) return reply.code(400).send({ error: 'Authorization request expired' });
    const destination = new URL(grant.redirect_uri);
    if (request.body?.decision !== 'allow') {
      destination.search = new URLSearchParams({ error: 'access_denied', state: grant.state }).toString();
      return reply.redirect(destination.href);
    }
    const code = randomToken(32);
    await pool.query(`INSERT INTO design_auth_codes(code_hash,user_id,session_id,challenge,redirect_uri,expires_at) VALUES($1,$2,$3,$4,$5,now() + interval '60 seconds')`, [sha256(code), user.id, user._session_id, grant.challenge, grant.redirect_uri]);
    destination.search = new URLSearchParams({ code, state: grant.state }).toString();
    return reply.redirect(destination.href);
  });

  app.post('/api/design-auth/token', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const module = await serviceModule(request);
      const redirectUri = `${designOrigin(module)}/api/auth/rootminster/callback`;
      const body = request.body || {};
      reply.header('Cache-Control', 'no-store');
      if (body.client_id !== 'design' || body.redirect_uri !== redirectUri || !TOKEN.test(body.code || '') || !TOKEN.test(body.code_verifier || '')) return reply.code(400).send({ error: 'Invalid exchange' });
      const result = await pool.query(`DELETE FROM design_auth_codes WHERE code_hash=$1 AND challenge=$2 AND redirect_uri=$3 AND expires_at > now() RETURNING user_id,session_id`, [sha256(body.code), pkce(body.code_verifier), redirectUri]);
      const grant = result.rows[0];
      const user = grant && await profile(grant.user_id, grant.session_id, module);
      if (!user) return reply.code(401).send({ error: 'Expired or invalid code' });
      return user;
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/session', { config: { rateLimit: { max: 300, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const module = await serviceModule(request);
      reply.header('Cache-Control', 'no-store');
      return await serviceProfile(request, module);
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/service-config', async (request, reply) => {
    try {
      const module = await serviceModule(request);
      reply.header('Cache-Control', 'no-store');
      return { github_client_id: module.github_client_id, github_client_secret: module.github_client_secret, repository_visibility: module.repository_visibility };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/subdomains', async (request, reply) => {
    try {
      const module = await serviceModule(request);
      const user = await serviceProfile(request, module);
      const records = await store.filter('DnsRecord', { owner_id: user.subject, status: 'active' }, 'name', 500);
      return { subdomains: [...new Set(records.filter((record) => record.managed !== false && record.zone_id && record.cloudflare_record_id).map((record) => String(record.name).toLowerCase()))] };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/analytics', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      const module = await serviceModule(request);
      const user = await serviceProfile(request, module);
      reply.header('Cache-Control', 'no-store');
      return await designAnalytics(user, request.body);
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/dns-preview', { config: { rateLimit: { max: 60, timeWindow: '10 minutes' } } }, async (request, reply) => {
    try {
      const module = await serviceModule(request);
      const user = await serviceProfile(request, module);
      const { preview } = await inspectHostname(user.subject, request.body?.hostname);
      return preview;
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });

  app.post('/api/design-auth/dns', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (request, reply) => {
    try {
      const module = await serviceModule(request);
      const user = await serviceProfile(request, module);
      const hostname = String(request.body?.hostname || '').trim().toLowerCase();
      const owner = String(request.body?.github_owner || '').trim();
      const repo = String(request.body?.github_repo || '').trim();
      if (!REPO_PART.test(owner) || !REPO_PART.test(repo)) return reply.code(400).send({ error: 'Invalid GitHub repository name' });
      const { anchor, records, preview } = await inspectHostname(user.subject, hostname);
      if (preview.blocking.length) return reply.code(409).send({ error: 'This hostname has delegated NS records. Remove the delegation before publishing.', confirmation_required: false, dns_preview: preview });
      if (preview.conflicts.length && (!request.body?.confirm_overwrite || request.body?.dns_revision !== preview.revision)) {
        return reply.code(409).send({ error: 'Confirm the existing web records that will be replaced.', confirmation_required: true, dns_preview: preview });
      }
      const pagesHostname = `${owner.toLowerCase()}.github.io`;
      const desired = new Set(GITHUB_PAGES_RECORDS.map(record => `${record.type}:${record.content.toLowerCase()}`));
      const conflicts = records.filter(record => record.type === 'CNAME' || (['A', 'AAAA'].includes(record.type) && (!desired.has(`${record.type}:${String(record.content).toLowerCase()}`) || record.proxied)));
      for (const record of conflicts) await removeDnsRecord(anchor.zone_id, record);
      const satisfied = new Set(records.filter(record => !conflicts.includes(record) && desired.has(`${record.type}:${String(record.content).toLowerCase()}`) && !record.proxied).map(record => `${record.type}:${String(record.content).toLowerCase()}`));
      const created = [];
      for (const record of GITHUB_PAGES_RECORDS) {
        if (!satisfied.has(`${record.type}:${record.content.toLowerCase()}`)) created.push(await createPagesRecord(anchor, hostname, record, user));
      }
      await store.create('AuditLog', { actor_email: user.email, actor_role: 'user', action: 'design_site_published', entity_type: 'DnsRecord', entity_id: created[0]?.id || anchor.id, description: `Published ${owner}/${repo} to ${hostname} with GitHub Pages A and AAAA records; preserved ${preview.preserved.length} compatible record(s)` }, { id: user.subject, email: user.email, role: 'user' });
      return { github_pages_hostname: pagesHostname, hostname, deployment_url: `https://${hostname}`, dns_records: GITHUB_PAGES_RECORDS, preserved_records: preview.preserved };
    } catch (error) {
      return reply.code(error.status || 400).send({ error: error.message });
    }
  });
}
