// Bindings between Rootminster users and their social accounts (Google, GitHub,
// Discord). Every function takes a pg client so callers can run it inside a
// transaction; linking and unlinking expect to be called in one.

export class IdentityError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function clip(value, length = 200) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, length) : null;
}

export async function findIdentity(client, provider, providerUserId) {
  const result = await client.query(
    `SELECT i.user_id, u.status FROM user_identities i JOIN users u ON u.id = i.user_id
     WHERE i.provider = $1 AND i.provider_user_id = $2`,
    [provider, providerUserId],
  );
  return result.rows[0] || null;
}

export async function touchIdentity(client, provider, profile) {
  await client.query(
    `UPDATE user_identities SET last_used_at = now(), provider_email = coalesce($3, provider_email),
       display_name = coalesce($4, display_name)
     WHERE provider = $1 AND provider_user_id = $2`,
    [provider, profile.id, clip(profile.email), clip(profile.username || profile.name)],
  );
}

// Called after an email-matched sign-in. The account was matched on the
// provider's verified email, so it is safe to remember the binding, but it
// never replaces a different account the user already linked for this provider.
export async function rememberIdentity(client, userId, provider, profile) {
  await client.query(
    `INSERT INTO user_identities(user_id, provider, provider_user_id, provider_email, display_name, last_used_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT DO NOTHING`,
    [userId, provider, profile.id, clip(profile.email), clip(profile.username || profile.name)],
  );
}

// Link a provider account to a signed-in user who has just proven control of
// it. Refuses when the provider account belongs to someone else.
export async function linkIdentity(client, userId, provider, profile) {
  await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const owner = await client.query(
    'SELECT user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2',
    [provider, profile.id],
  );
  if (owner.rowCount && owner.rows[0].user_id !== userId) {
    throw new IdentityError('in_use', 'That account is already linked to a different Rootminster user');
  }
  if (provider === 'discord') {
    const bot = await client.query('SELECT user_id FROM discord_accounts WHERE discord_user_id = $1', [profile.id]);
    if (bot.rowCount && bot.rows[0].user_id !== userId) {
      throw new IdentityError('in_use', 'That account is already linked to a different Rootminster user');
    }
  }
  const mine = await client.query(
    'SELECT provider_user_id FROM user_identities WHERE user_id = $1 AND provider = $2',
    [userId, provider],
  );
  if (mine.rowCount && mine.rows[0].provider_user_id !== profile.id) {
    throw new IdentityError('provider_taken', 'Unlink your current account for this provider before linking another one');
  }
  try {
    await client.query(
      `INSERT INTO user_identities(user_id, provider, provider_user_id, provider_email, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (provider, provider_user_id) DO UPDATE SET
         provider_email = excluded.provider_email, display_name = excluded.display_name
       WHERE user_identities.user_id = excluded.user_id`,
      [userId, provider, profile.id, clip(profile.email), clip(profile.username || profile.name)],
    );
  } catch (error) {
    if (error.code === '23505') throw new IdentityError('in_use', 'That account is already linked to a different Rootminster user');
    throw error;
  }
  if (provider === 'discord') {
    // Signing in with Discord also authorises the Discord bot for this user.
    await client.query('DELETE FROM discord_accounts WHERE user_id = $1 AND discord_user_id <> $2', [userId, profile.id]);
    await client.query(
      `INSERT INTO discord_accounts(discord_user_id, user_id, discord_username) VALUES ($1, $2, $3)
       ON CONFLICT (discord_user_id) DO UPDATE SET discord_username = excluded.discord_username
       WHERE discord_accounts.user_id = excluded.user_id`,
      [profile.id, userId, clip(profile.username || profile.name, 100)],
    );
  }
}

// Other ways this user could still sign in if `provider` were removed.
export async function remainingSignInMethods(client, userId, provider) {
  const result = await client.query(
    `SELECT (u.password_hash IS NOT NULL) AS has_password,
            (SELECT count(*)::int FROM webauthn_credentials w WHERE w.user_id = u.id) AS passkeys,
            (SELECT count(*)::int FROM user_identities i WHERE i.user_id = u.id AND i.provider <> $2) AS other_identities
     FROM users u WHERE u.id = $1 FOR UPDATE OF u`,
    [userId, provider],
  );
  const row = result.rows[0];
  if (!row) return 0;
  return (row.has_password ? 1 : 0) + Number(row.passkeys || 0) + Number(row.other_identities || 0);
}

export async function unlinkIdentity(client, userId, provider) {
  const current = await client.query(
    'SELECT provider_user_id FROM user_identities WHERE user_id = $1 AND provider = $2',
    [userId, provider],
  );
  if (!current.rowCount) throw new IdentityError('not_linked', 'No account is linked for this provider', 404);
  if (await remainingSignInMethods(client, userId, provider) < 1) {
    throw new IdentityError('last_method', 'This is your only way to sign in. Set a password, add a passkey or link another account first.');
  }
  await client.query('DELETE FROM user_identities WHERE user_id = $1 AND provider = $2', [userId, provider]);
  if (provider === 'discord') {
    await client.query('DELETE FROM discord_accounts WHERE user_id = $1 AND discord_user_id = $2', [userId, current.rows[0].provider_user_id]);
  }
  return current.rows[0].provider_user_id;
}

export async function listIdentities(client, userId) {
  const [identities, methods] = await Promise.all([
    client.query(
      `SELECT provider, provider_email, display_name, linked_at, last_used_at
       FROM user_identities WHERE user_id = $1 ORDER BY provider`,
      [userId],
    ),
    client.query(
      `SELECT (password_hash IS NOT NULL) AS has_password,
              (SELECT count(*)::int FROM webauthn_credentials w WHERE w.user_id = users.id) AS passkeys
       FROM users WHERE id = $1`,
      [userId],
    ),
  ]);
  return {
    identities: identities.rows,
    has_password: Boolean(methods.rows[0]?.has_password),
    passkeys: Number(methods.rows[0]?.passkeys || 0),
  };
}
