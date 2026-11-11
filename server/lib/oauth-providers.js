// Social sign-in providers. Each provider turns an authorization code into a
// normalised profile: a stable provider account id, a verified email (or null
// when the provider cannot vouch for one), and a display name.

const DISCORD_API = 'https://discord.com/api/v10';

function failure(message, status = 502) {
  return Object.assign(new Error(message), { status });
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export const OAUTH_PROVIDERS = Object.freeze({
  google: {
    label: 'Google',
    module: 'google_oauth',
    pkce: true,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
    extraParams: { prompt: 'select_account' },
    async fetchProfile({ code, verifier, redirectUri, settings }) {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: settings.client_id, client_secret: settings.client_secret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
      });
      const tokens = await readJson(tokenResponse);
      if (!tokenResponse.ok || !tokens.access_token) throw failure('Google authentication failed');
      const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const profile = await readJson(profileResponse);
      if (!profileResponse.ok || !profile.sub) throw failure('Could not read the Google account profile');
      return normaliseGoogleProfile(profile);
    },
  },
  github: {
    label: 'GitHub',
    module: 'github_oauth',
    pkce: false,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'read:user user:email',
    extraParams: { allow_signup: 'true' },
    async fetchProfile({ code, redirectUri, settings }) {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: settings.client_id, client_secret: settings.client_secret, code, redirect_uri: redirectUri }),
      });
      const tokens = await readJson(tokenResponse);
      if (!tokenResponse.ok || !tokens.access_token) throw failure('GitHub authentication failed');
      const headers = {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Rootminster-V2',
      };
      const [profileResponse, emailsResponse] = await Promise.all([
        fetch('https://api.github.com/user', { headers }),
        fetch('https://api.github.com/user/emails', { headers }),
      ]);
      const profile = await readJson(profileResponse);
      const emails = await readJson(emailsResponse);
      if (!profileResponse.ok || !emailsResponse.ok || !Array.isArray(emails) || !profile.id) {
        throw failure('Could not read the GitHub account profile');
      }
      return normaliseGithubProfile(profile, emails);
    },
  },
  discord: {
    label: 'Discord',
    module: 'discord_oauth',
    pkce: false,
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    scope: 'identify email',
    extraParams: {},
    async fetchProfile({ code, redirectUri, settings }) {
      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: settings.client_id, client_secret: settings.client_secret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tokens = await readJson(tokenResponse);
      if (!tokenResponse.ok || !tokens.access_token) throw failure('Discord authentication failed');
      const profileResponse = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      const profile = await readJson(profileResponse);
      if (!profileResponse.ok || !profile.id) throw failure('Could not read the Discord account profile');
      return normaliseDiscordProfile(profile);
    },
  },
});

export function oauthProvider(name) {
  return Object.hasOwn(OAUTH_PROVIDERS, name) ? OAUTH_PROVIDERS[name] : null;
}

export function providerConfigured(settings) {
  return Boolean(settings?.enabled && settings.client_id && settings.client_secret);
}

export function normaliseGoogleProfile(profile) {
  return {
    id: String(profile.sub),
    email: profile.email && profile.email_verified === true ? String(profile.email) : null,
    name: profile.name || null,
    username: profile.email || null,
  };
}

export function normaliseGithubProfile(profile, emails = []) {
  const verified = emails.find((item) => item.primary && item.verified)?.email
    || emails.find((item) => item.verified)?.email
    || null;
  return {
    id: String(profile.id),
    email: verified,
    name: profile.name || profile.login || null,
    username: profile.login || null,
  };
}

export function normaliseDiscordProfile(profile) {
  // Discord only vouches for the address when `verified` is true; an unverified
  // email must never be used to match or create an account.
  return {
    id: String(profile.id),
    email: profile.email && profile.verified === true ? String(profile.email) : null,
    name: profile.global_name || profile.username || null,
    username: profile.username || null,
  };
}
