import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { authenticateRequest, createSession, markSessionMfaVerified } from './auth.js';
import { config } from './config.js';
import { pool } from './database.js';

const rpURL = new URL(config.appUrl);
const rpID = rpURL.hostname;
const expectedOrigin = rpURL.origin;
const rpName = process.env.WEBAUTHN_RP_NAME || 'Open Domains';

function credentialJSON(row) {
  return {
    id: row.id,
    name: row.name,
    device_type: row.device_type,
    backed_up: row.backed_up,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
  };
}

async function createChallenge(userId, purpose, challenge) {
  await pool.query('DELETE FROM webauthn_challenges WHERE expires_at <= now()');
  const result = await pool.query(
    `INSERT INTO webauthn_challenges(user_id, challenge, purpose)
     VALUES ($1, $2, $3) RETURNING id`,
    [userId || null, challenge, purpose],
  );
  return result.rows[0].id;
}

async function consumeChallenge(id, purpose, userId = undefined) {
  const values = [id, purpose];
  let userClause = '';
  if (userId !== undefined) {
    values.push(userId);
    userClause = ` AND user_id ${userId === null ? 'IS NULL' : `= $${values.length}`}`;
    if (userId === null) values.pop();
  }
  const result = await pool.query(
    `DELETE FROM webauthn_challenges
     WHERE id = $1 AND purpose = $2 AND expires_at > now()${userClause}
     RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

async function credentialsFor(userId) {
  const result = await pool.query('SELECT * FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

function canManagePasskeys(user) {
  return Boolean(user?.mfa_verified || (!user?.totp_enabled && !user?.passkey_enabled));
}

function webauthnCredential(row) {
  return {
    id: row.credential_id,
    publicKey: new Uint8Array(row.public_key),
    counter: Number(row.counter),
    transports: Array.isArray(row.transports) ? row.transports : [],
  };
}

export async function registerPasskeyRoutes(app) {
  app.get('/api/auth/passkeys', async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (!canManagePasskeys(user)) return reply.code(403).send({ error: 'Complete multi-factor authentication before managing passkeys' });
    return { data: (await credentialsFor(user.id)).map(credentialJSON) };
  });

  app.post('/api/auth/passkeys/register/options', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (!canManagePasskeys(user)) return reply.code(403).send({ error: 'Complete multi-factor authentication before managing passkeys' });
    const credentials = await credentialsFor(user.id);
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.display_name || user.full_name || user.email,
      attestationType: 'none',
      excludeCredentials: credentials.map((item) => ({ id: item.credential_id, transports: item.transports || [] })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    return { options, challenge_id: await createChallenge(user.id, 'register', options.challenge) };
  });

  app.post('/api/auth/passkeys/register/verify', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (!canManagePasskeys(user)) return reply.code(403).send({ error: 'Complete multi-factor authentication before managing passkeys' });
    const challenge = await consumeChallenge(request.body?.challenge_id, 'register', user.id);
    if (!challenge) return reply.code(400).send({ error: 'Passkey registration expired. Please try again.' });
    const verification = await verifyRegistrationResponse({
      response: request.body?.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) return reply.code(400).send({ error: 'Passkey could not be verified' });
    const info = verification.registrationInfo;
    const name = String(request.body?.name || 'Passkey').trim().slice(0, 80) || 'Passkey';
    try {
      const result = await pool.query(
        `INSERT INTO webauthn_credentials(user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) RETURNING *`,
        [user.id, info.credential.id, Buffer.from(info.credential.publicKey), info.credential.counter, JSON.stringify(request.body?.response?.response?.transports || []), info.credentialDeviceType, info.credentialBackedUp, name],
      );
      await markSessionMfaVerified(user);
      return reply.code(201).send({ passkey: credentialJSON(result.rows[0]) });
    } catch (error) {
      if (error.code === '23505') return reply.code(409).send({ error: 'This passkey is already registered' });
      throw error;
    }
  });

  app.delete('/api/auth/passkeys/:id', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const result = await pool.query('DELETE FROM webauthn_credentials WHERE id = $1 AND user_id = $2 RETURNING id', [request.params.id, user.id]);
    if (!result.rowCount) return reply.code(404).send({ error: 'Passkey not found' });
    return { success: true };
  });

  app.post('/api/auth/passkeys/login/options', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async () => {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
    return { options, challenge_id: await createChallenge(null, 'authenticate', options.challenge) };
  });

  app.post('/api/auth/passkeys/login/verify', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const challenge = await consumeChallenge(request.body?.challenge_id, 'authenticate', null);
    if (!challenge) return reply.code(400).send({ error: 'Passkey sign-in expired. Please try again.' });
    const result = await pool.query(
      `SELECT c.*, u.status, u.email_verified_at
       FROM webauthn_credentials c JOIN users u ON u.id = c.user_id
       WHERE c.credential_id = $1`,
      [request.body?.response?.id],
    );
    const credential = result.rows[0];
    if (!credential || credential.status !== 'active' || !credential.email_verified_at) return reply.code(401).send({ error: 'Passkey sign-in failed' });
    const verification = await verifyAuthenticationResponse({
      response: request.body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: webauthnCredential(credential),
      requireUserVerification: true,
    });
    if (!verification.verified) return reply.code(401).send({ error: 'Passkey sign-in failed' });
    await pool.query('UPDATE webauthn_credentials SET counter = $1, last_used_at = now() WHERE id = $2', [verification.authenticationInfo.newCounter, credential.id]);
    await createSession(credential.user_id, request, reply, { mfaVerified: true });
    return { success: true };
  });

  app.post('/api/auth/passkeys/mfa/options', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const credentials = await credentialsFor(user.id);
    if (!credentials.length) return reply.code(404).send({ error: 'No passkeys are registered for this account' });
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: credentials.map((item) => ({ id: item.credential_id, transports: item.transports || [] })),
    });
    return { options, challenge_id: await createChallenge(user.id, 'mfa', options.challenge) };
  });

  app.post('/api/auth/passkeys/mfa/verify', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const user = await authenticateRequest(request, { allowMfaPending: true });
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    const challenge = await consumeChallenge(request.body?.challenge_id, 'mfa', user.id);
    if (!challenge) return reply.code(400).send({ error: 'Passkey challenge expired. Please try again.' });
    const result = await pool.query('SELECT * FROM webauthn_credentials WHERE user_id = $1 AND credential_id = $2', [user.id, request.body?.response?.id]);
    const credential = result.rows[0];
    if (!credential) return reply.code(401).send({ error: 'Passkey verification failed' });
    const verification = await verifyAuthenticationResponse({ response: request.body.response, expectedChallenge: challenge.challenge, expectedOrigin, expectedRPID: rpID, credential: webauthnCredential(credential), requireUserVerification: true });
    if (!verification.verified) return reply.code(401).send({ error: 'Passkey verification failed' });
    await pool.query('UPDATE webauthn_credentials SET counter = $1, last_used_at = now() WHERE id = $2', [verification.authenticationInfo.newCounter, credential.id]);
    await markSessionMfaVerified(user);
    return { success: true };
  });
}
