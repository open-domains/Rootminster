import crypto from 'node:crypto';
import { config } from './config.js';
import { pool } from './database.js';
import { sendEmail } from './mail.js';
import { hashPassword, randomToken, sha256, verifyPassword } from './security.js';
import { serializeUser } from './store.js';
import { getModuleConfig } from './module-settings.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function publicUser(user) {
  if (!user) return null;
  const result = { ...user };
  delete result.password_hash;
  delete result.totp_secret;
  delete result.metadata;
  delete result._session_id;
  return result;
}

function tokenFromRequest(request) {
  const authorization = request.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return authorization.slice(7).trim();
  return request.cookies?.[config.cookieName] || null;
}

export async function authenticateRequest(request, { allowMfaPending = false } = {}) {
  const raw = tokenFromRequest(request);
  if (!raw) return null;
  const result = await pool.query(
    `SELECT u.*, s.id AS _session_id, s.mfa_verified_at AS _session_mfa_verified_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sha256(raw)],
  );
  const row = result.rows[0];
  if (!row) return null;
  const mfaRequired = Boolean(row.totp_enabled || ['staff', 'admin'].includes(row.role));
  const mfaVerified = !mfaRequired || Boolean(row._session_mfa_verified_at);
  if (!mfaVerified && !allowMfaPending) return null;
  pool.query('UPDATE sessions SET last_used_at = now() WHERE token_hash = $1', [sha256(raw)]).catch(() => {});
  return { ...serializeUser(row), _session_id: row._session_id, mfa_required: mfaRequired, mfa_verified: mfaVerified };
}

export async function markSessionMfaVerified(user) {
  if (!user?._session_id) throw Object.assign(new Error('No browser session is available'), { status: 401 });
  await pool.query('UPDATE sessions SET mfa_verified_at = now(), last_used_at = now() WHERE id = $1 AND user_id = $2', [user._session_id, user.id]);
}

export async function createSession(userId, request, reply) {
  const token = randomToken(32);
  const expires = new Date(Date.now() + config.sessionDays * 86_400_000);
  await pool.query(
    `INSERT INTO sessions(user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(token), request.headers['user-agent'] || null, request.ip || null, expires],
  );
  reply.setCookie(config.cookieName, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    expires,
  });
  return token;
}

async function sendVerification(user, token) {
  const verificationUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your Open Domains account',
    body: `<p>Hi ${escapeHtml(user.full_name)},</p><p>Confirm your email address to finish creating your Open Domains account.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#6d5dfc;color:#fff;text-decoration:none;font-weight:600">Verify email address</a></p><p>This single-use link expires in 24 hours.</p><p>If the button does not work, copy this link into your browser:<br><a href="${verificationUrl}">${verificationUrl}</a></p>`,
  });
  return verificationUrl;
}

async function issueVerification(user) {
  const token = randomToken(32);
  await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [user.id]);
  await pool.query(
    `INSERT INTO email_verifications(user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '24 hours')`,
    [user.id, sha256(token)],
  );
  const verificationUrl = await sendVerification(user, token);
  return { token, verificationUrl };
}

function safeReturnTo(value) {
  const target = String(value || '/user-dashboard');
  return target.startsWith('/') && !target.startsWith('//') ? target : '/user-dashboard';
}

async function upsertOauthUser(email, name) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await pool.query('SELECT status FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows[0]?.status === 'disabled') {
    throw Object.assign(new Error('This account is disabled'), { status: 403 });
  }
  return pool.query(
    `INSERT INTO users(email, full_name, display_name, status, email_verified_at)
     VALUES ($1, $2, $2, 'active', now())
     ON CONFLICT (email) DO UPDATE SET
       email_verified_at = coalesce(users.email_verified_at, now()),
       status = CASE WHEN users.status = 'pending' THEN 'active' ELSE users.status END,
       full_name = coalesce(users.full_name, excluded.full_name),
       display_name = coalesce(users.display_name, excluded.display_name),
       updated_at = now()
     RETURNING *`,
    [normalizedEmail, name || null],
  );
}

export async function registerAuthRoutes(app) {
  app.post('/api/auth/register', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const emailModule = await getModuleConfig('email');
    const verificationRequired = emailModule.require_verification !== false;
    if (verificationRequired && !emailModule.enabled) return reply.code(503).send({ error: 'Registration is unavailable until the email module is enabled' });
    const firstName = String(request.body?.firstName || request.body?.first_name || '').trim();
    const email = String(request.body?.email || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    if (!firstName || firstName.length > 80) return reply.code(400).send({ error: 'Enter your first name (80 characters or fewer)' });
    if (!emailPattern.test(email)) return reply.code(400).send({ error: 'Enter a valid email address' });
    if (password.length < 10) return reply.code(400).send({ error: 'Password must be at least 10 characters' });
    const existing = await pool.query('SELECT id, status FROM users WHERE email = $1', [email]);
    if (existing.rowCount) return reply.code(409).send({ error: 'An account with this email already exists' });
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users(email, password_hash, full_name, display_name, status, email_verified_at)
       VALUES ($1, $2, $3, $3, $4, $5) RETURNING *`,
      [email, passwordHash, firstName, verificationRequired ? 'pending' : 'active', verificationRequired ? null : new Date()],
    );
    const user = serializeUser(result.rows[0]);
    if (!verificationRequired) {
      await createSession(user.id, request, reply);
      return reply.code(201).send({ success: true, verified: true });
    }
    const issued = await issueVerification(user);
    return reply.code(201).send({ success: true, ...(config.production ? {} : { development_verification_url: issued.verificationUrl }) });
  });

  app.post('/api/auth/verify-email', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const token = String(request.body?.token || '').trim();
    if (!token) return reply.code(400).send({ error: 'Verification token is required' });
    const result = await pool.query(
      `DELETE FROM email_verifications
       WHERE token_hash = $1 AND expires_at > now()
       RETURNING user_id`,
      [sha256(token)],
    );
    if (!result.rowCount) return reply.code(400).send({ error: 'Invalid or expired verification link' });
    const userId = result.rows[0].user_id;
    await pool.query(`UPDATE users SET status = 'active', email_verified_at = coalesce(email_verified_at, now()), updated_at = now() WHERE id = $1`, [userId]);
    await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
    await createSession(userId, request, reply);
    return { success: true };
  });

  app.post('/api/auth/resend-verification', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rowCount || result.rows[0].email_verified_at) return { success: true };
    const user = serializeUser(result.rows[0]);
    const issued = await issueVerification(user);
    return { success: true, ...(config.production ? {} : { development_verification_url: issued.verificationUrl }) };
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const row = result.rows[0];
    if (!row || !(await verifyPassword(row.password_hash, String(request.body?.password || '')))) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }
    if (row.status === 'disabled') return reply.code(403).send({ error: 'This account is disabled' });
    if (!row.email_verified_at) return reply.code(403).send({ error: 'Verify your email before signing in' });
    if (row.status !== 'active') await pool.query(`UPDATE users SET status = 'active' WHERE id = $1`, [row.id]);
    await createSession(row.id, request, reply);
    return { user: publicUser(serializeUser({ ...row, status: 'active' })) };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    return { user: publicUser(user) };
  });

  app.patch('/api/auth/me', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const allowed = ['display_name', 'full_name', 'tos_accepted_at', 'tos_accepted_version', 'disable_email_notifications'];
    const updates = Object.fromEntries(Object.entries(request.body || {}).filter(([key]) => allowed.includes(key)));
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      values.push(value || null);
      fields.push(`${key} = $${values.length}`);
    }
    if (fields.length) {
      values.push(user.id);
      await pool.query(`UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values);
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
    return { user: publicUser(serializeUser(result.rows[0])) };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = tokenFromRequest(request);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    reply.clearCookie(config.cookieName, { path: '/' });
    return { success: true };
  });

  app.post('/api/auth/forgot-password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request) => {
    const email = String(request.body?.email || '').trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rowCount) return { success: true };
    const token = randomToken(32);
    await pool.query('INSERT INTO password_resets(user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'1 hour\')', [result.rows[0].id, sha256(token)]);
    await sendEmail({
      to: email,
      subject: 'Reset your Open Domains password',
      body: `<p>Use the link below to reset your password. It expires in one hour.</p><p><a href="${config.appUrl}/reset-password?token=${encodeURIComponent(token)}">Reset password</a></p>`,
    });
    return { success: true, ...(config.production ? {} : { development_token: token }) };
  });

  app.post('/api/auth/reset-password', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const token = String(request.body?.resetToken || '');
    const password = String(request.body?.newPassword || '');
    if (password.length < 10) return reply.code(400).send({ error: 'Password must be at least 10 characters' });
    const result = await pool.query('SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()', [sha256(token)]);
    if (!result.rowCount) return reply.code(400).send({ error: 'Invalid or expired reset link' });
    const reset = result.rows[0];
    await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [await hashPassword(password), reset.user_id]);
    await pool.query('UPDATE password_resets SET used_at = now() WHERE id = $1', [reset.id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [reset.user_id]);
    return { success: true };
  });

  app.get('/api/auth/oauth/google', async (request, reply) => {
    const google = await getModuleConfig('google_oauth');
    if (!google.enabled || !google.client_id || !google.client_secret) return reply.code(501).send({ error: 'Google sign-in is not configured' });
    const state = randomToken(24);
    const verifier = randomToken(48);
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    await pool.query('INSERT INTO oauth_states(state_hash, verifier, provider, return_to, expires_at) VALUES ($1, $2, $3, $4, now() + interval \'10 minutes\')', [sha256(state), verifier, 'google', safeReturnTo(request.query?.return_to)]);
    const redirectUri = `${config.appUrl}/api/auth/oauth/google/callback`;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: google.client_id, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
    return reply.redirect(url.toString());
  });

  app.get('/api/auth/oauth/google/callback', async (request, reply) => {
    const google = await getModuleConfig('google_oauth');
    if (!google.enabled || !google.client_id || !google.client_secret) return reply.code(501).send({ error: 'Google sign-in is not configured' });
    const state = String(request.query?.state || '');
    const code = String(request.query?.code || '');
    const stateResult = await pool.query("DELETE FROM oauth_states WHERE state_hash = $1 AND provider = 'google' AND expires_at > now() RETURNING *", [sha256(state)]);
    if (!stateResult.rowCount || !code) return reply.code(400).send({ error: 'Invalid OAuth state' });
    const saved = stateResult.rows[0];
    const redirectUri = `${config.appUrl}/api/auth/oauth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: google.client_id, client_secret: google.client_secret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: saved.verifier }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) return reply.code(502).send({ error: 'Google authentication failed' });
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email || !profile.email_verified) return reply.code(403).send({ error: 'A verified Google email is required' });
    const userResult = await upsertOauthUser(profile.email, profile.name);
    await createSession(userResult.rows[0].id, request, reply);
    return reply.redirect(saved.return_to);
  });

  app.get('/api/auth/oauth/github', async (request, reply) => {
    const github = await getModuleConfig('github_oauth');
    if (!github.enabled || !github.client_id || !github.client_secret) return reply.code(501).send({ error: 'GitHub sign-in is not configured' });
    const state = randomToken(24);
    await pool.query(
      'INSERT INTO oauth_states(state_hash, verifier, provider, return_to, expires_at) VALUES ($1, $2, $3, $4, now() + interval \'10 minutes\')',
      [sha256(state), randomToken(24), 'github', safeReturnTo(request.query?.return_to)],
    );
    const redirectUri = `${config.appUrl}/api/auth/oauth/github/callback`;
    const url = new URL('https://github.com/login/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: github.client_id,
      redirect_uri: redirectUri,
      scope: 'read:user user:email',
      state,
      allow_signup: 'true',
    });
    return reply.redirect(url.toString());
  });

  app.get('/api/auth/oauth/github/callback', async (request, reply) => {
    const github = await getModuleConfig('github_oauth');
    if (!github.enabled || !github.client_id || !github.client_secret) return reply.code(501).send({ error: 'GitHub sign-in is not configured' });
    const state = String(request.query?.state || '');
    const code = String(request.query?.code || '');
    const stateResult = await pool.query(
      "DELETE FROM oauth_states WHERE state_hash = $1 AND provider = 'github' AND expires_at > now() RETURNING *",
      [sha256(state)],
    );
    if (!stateResult.rowCount || !code) return reply.code(400).send({ error: 'Invalid OAuth state' });
    const saved = stateResult.rows[0];
    const redirectUri = `${config.appUrl}/api/auth/oauth/github/callback`;
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: github.client_id,
        client_secret: github.client_secret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) return reply.code(502).send({ error: 'GitHub authentication failed' });

    const githubHeaders = {
      Authorization: `Bearer ${tokens.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Rootminster-V2',
    };
    const [profileResponse, emailsResponse] = await Promise.all([
      fetch('https://api.github.com/user', { headers: githubHeaders }),
      fetch('https://api.github.com/user/emails', { headers: githubHeaders }),
    ]);
    const profile = await profileResponse.json();
    const emails = await emailsResponse.json();
    if (!profileResponse.ok || !emailsResponse.ok || !Array.isArray(emails)) {
      return reply.code(502).send({ error: 'Could not read the GitHub account profile' });
    }
    const verifiedEmail = emails.find((item) => item.primary && item.verified)?.email
      || emails.find((item) => item.verified)?.email;
    if (!verifiedEmail) return reply.code(403).send({ error: 'A verified GitHub email is required' });

    const userResult = await upsertOauthUser(verifiedEmail, profile.name || profile.login);
    await createSession(userResult.rows[0].id, request, reply);
    return reply.redirect(saved.return_to);
  });
}
