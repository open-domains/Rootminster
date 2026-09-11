const TOKEN_KEY = 'rootminster_access_token';

function storedToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = storedToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
    body: options.body === undefined || options.body instanceof FormData
      ? options.body
      : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const responseError = data?.error;
    const message = typeof responseError === 'string' ? responseError : responseError?.message;
    const error = new Error(message || data?.message || `Request failed (${response.status})`);
    error.code = typeof responseError === 'object' ? responseError?.code : undefined;
    error.status = response.status;
    error.data = data;
    error.response = { status: response.status, data };
    throw error;
  }
  return data;
}

function entityApi(entity) {
  const base = `/api/entities/${encodeURIComponent(entity)}`;
  const query = (filter, sort, limit, skip) => {
    const params = new URLSearchParams();
    if (filter && Object.keys(filter).length) params.set('filter', JSON.stringify(filter));
    if (sort) params.set('sort', sort);
    if (limit !== undefined) params.set('limit', String(limit));
    if (skip !== undefined) params.set('skip', String(skip));
    return params.size ? `?${params}` : '';
  };

  return {
    async list(sort, limit, skip) {
      const result = await request(`${base}${query(null, sort, limit, skip)}`);
      return result.data;
    },
    async filter(filter, sort, limit, skip) {
      const result = await request(`${base}${query(filter, sort, limit, skip)}`);
      return result.data;
    },
    async get(id) {
      const result = await request(`${base}/${encodeURIComponent(id)}`);
      return result.data;
    },
    async create(data) {
      const result = await request(base, { method: 'POST', body: data });
      return result.data;
    },
    async bulkCreate(rows) {
      const result = await request(`${base}/bulk`, { method: 'POST', body: { rows } });
      return result.data;
    },
    async update(id, data) {
      const result = await request(`${base}/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
      return result.data;
    },
    async delete(id) {
      const result = await request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return result.data;
    },
  };
}

const entities = new Proxy({}, {
  get: (_, entity) => entityApi(String(entity)),
});

export const rootminster = {
  entities,
  setup: {
    async status() {
      return request('/api/setup/status');
    },
    async initialize(data) {
      return request('/api/setup/initialize', { method: 'POST', body: data });
    },
  },
  discord: {
    async status() {
      return request('/api/discord/status');
    },
    async link(token) {
      return request('/api/discord/link', { method: 'POST', body: { token } });
    },
    async unlink() {
      return request('/api/discord/link', { method: 'DELETE' });
    },
  },
  apiTokens: {
    async list() {
      const result = await request('/api/auth/tokens');
      return result.data;
    },
    async create(settings) {
      const body = typeof settings === 'string' ? { name: settings } : settings;
      const result = await request('/api/auth/tokens', { method: 'POST', body });
      return result.data;
    },
    async revoke(id) {
      const result = await request(`/api/auth/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return result.data;
    },
  },
  passkeys: {
    async list() { const result = await request('/api/auth/passkeys'); return result.data; },
    async registrationOptions() { return request('/api/auth/passkeys/register/options', { method: 'POST', body: {} }); },
    async verifyRegistration(challengeId, response, name) { return request('/api/auth/passkeys/register/verify', { method: 'POST', body: { challenge_id: challengeId, response, name } }); },
    async remove(id) { return request(`/api/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async loginOptions() { return request('/api/auth/passkeys/login/options', { method: 'POST', body: {} }); },
    async verifyLogin(challengeId, response) { return request('/api/auth/passkeys/login/verify', { method: 'POST', body: { challenge_id: challengeId, response } }); },
    async mfaOptions() { return request('/api/auth/passkeys/mfa/options', { method: 'POST', body: {} }); },
    async verifyMfa(challengeId, response) { return request('/api/auth/passkeys/mfa/verify', { method: 'POST', body: { challenge_id: challengeId, response } }); },
  },
  impersonation: {
    async start(userId, reason) {
      const result = await request('/api/admin/impersonation/start', { method: 'POST', body: { user_id: userId, reason } });
      if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
      return result;
    },
    async stop() { return request('/api/auth/impersonation/stop', { method: 'POST', body: {} }); },
  },
  config: {
    async getPublic() {
      return request('/api/config');
    },
  },
  terms: {
    async current() { const result = await request('/api/terms/current'); return result.terms; },
    async published() { const result = await request('/api/terms/versions'); return result.versions; },
    async getPublished(version) { const result = await request(`/api/terms/versions/${encodeURIComponent(version)}`); return result.terms; },
    async accept() { const result = await request('/api/terms/accept', { method: 'POST', body: {} }); return result.user; },
    async listAdmin() { const result = await request('/api/admin/terms'); return result.versions; },
    async create(data) { const result = await request('/api/admin/terms', { method: 'POST', body: data }); return result.terms; },
    async update(id, data) { const result = await request(`/api/admin/terms/${encodeURIComponent(id)}`, { method: 'PUT', body: data }); return result.terms; },
    async publish(id, confirmation) { const result = await request(`/api/admin/terms/${encodeURIComponent(id)}/publish`, { method: 'POST', body: { confirmation } }); return result.terms; },
    async deleteDraft(id) { return request(`/api/admin/terms/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  },
  accountDeletion: {
    async getMine() { return request('/api/account-deletion-request'); },
    async request(reason = '') { return request('/api/account-deletion-request', { method: 'POST', body: { reason } }); },
    async cancel(id) { return request(`/api/account-deletion-request/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async listAdmin() { return request('/api/admin/account-deletion-requests'); },
    async getAdmin(id) { return request(`/api/admin/account-deletion-requests/${encodeURIComponent(id)}`); },
    async decide(id, decision, reason = '') { return request(`/api/admin/account-deletion-requests/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision, reason } }); },
  },
  modules: {
    async list() { return request('/api/admin/modules'); },
    async update(id, data) { return request(`/api/admin/modules/${encodeURIComponent(id)}`, { method: 'PUT', body: data }); },
    async importEnvironment() { return request('/api/admin/modules/import-environment', { method: 'POST', body: {} }); },
    async testGlitchTip() { return request('/api/admin/modules/glitchtip/test', { method: 'POST', body: {} }); },
  },
  backups: {
    async status() { return request('/api/admin/backups'); },
    async testR2() { return request('/api/admin/backups/r2/test', { method: 'POST', body: {} }); },
    async create() { return request('/api/admin/backups', { method: 'POST', body: {} }); },
    async verify(id) { return request(`/api/admin/backups/${encodeURIComponent(id)}/verify`, { method: 'POST', body: {} }); },
    async restore(id, confirmation, totpCode) { return request(`/api/admin/backups/${encodeURIComponent(id)}/restore`, { method: 'POST', body: { confirmation, totp_code: totpCode } }); },
    async delete(id) { return request(`/api/admin/backups/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    downloadUrl(id) { return `/api/admin/backups/${encodeURIComponent(id)}/download`; },
  },
  functions: {
    async invoke(name, data = {}) {
      const result = await request(`/api/functions/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: data,
      });
      return { data: result };
    },
  },
  integrations: {
    Core: {
      async SendEmail(message) {
        return request('/api/functions/sendEmail', { method: 'POST', body: message });
      },
    },
  },
  auth: {
    async me() {
      const result = await request('/api/auth/me');
      return result.user;
    },
    async isAuthenticated() {
      try {
        await this.me();
        return true;
      } catch {
        return false;
      }
    },
    async loginViaEmailPassword(email, password) {
      const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
      if (result.access_token) this.setToken(result.access_token);
      return result;
    },
    loginWithProvider(provider, returnTo = '/user-dashboard') {
      if (!['google', 'github'].includes(provider)) throw new Error(`Unsupported login provider: ${provider}`);
      window.location.href = `/api/auth/oauth/${provider}?return_to=${encodeURIComponent(returnTo)}`;
    },
    async register(data) {
      return request('/api/auth/register', { method: 'POST', body: data });
    },
    async verifyEmail(token) {
      return request('/api/auth/verify-email', { method: 'POST', body: { token } });
    },
    async resendVerification(email) {
      return request('/api/auth/resend-verification', { method: 'POST', body: { email } });
    },
    async resetPasswordRequest(email) {
      return request('/api/auth/forgot-password', { method: 'POST', body: { email } });
    },
    async resetPassword(data) {
      return request('/api/auth/reset-password', { method: 'POST', body: data });
    },
    async updateMe(data) {
      const result = await request('/api/auth/me', { method: 'PATCH', body: data });
      return result.user;
    },
    setToken(token) {
      if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, token);
    },
    async logout(returnTo = '/login') {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(TOKEN_KEY);
          window.sessionStorage.removeItem('2fa_verified');
          if (returnTo !== false) {
            const destination = typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/login';
            window.location.assign(destination);
          }
        }
      }
    },
    redirectToLogin(returnTo = window.location.href) {
      window.location.href = `/login?return_to=${encodeURIComponent(returnTo)}`;
    },
  },
};

export default rootminster;
