const CATEGORY_LABELS = {
  general: 'General',
  dns: 'DNS',
  account: 'Account',
  abuse: 'Abuse',
  privacy: 'Privacy',
  rootminster: 'Rootminster',
};

function cleanText(value, max = 4000) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function cleanEmail(value) {
  const email = cleanText(value, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function line(label, value) {
  const cleaned = cleanText(value, 1000);
  return cleaned ? `${label}: ${cleaned}` : '';
}

function splitName(nameOrEmail) {
  const cleaned = cleanText(nameOrEmail, 200);
  const fallback = cleaned.includes('@') ? cleaned.split('@')[0] : cleaned;
  const parts = (cleaned || fallback || 'OpenDomains User').split(/\s+/).filter(Boolean);
  if (parts.length > 1) return { firstname: parts.slice(0, -1).join(' '), lastname: parts.at(-1) };
  return { firstname: parts[0] || 'OpenDomains', lastname: 'User' };
}

function missingCustomerError(status, data) {
  const message = String(data?.error || data?.message || '');
  return status === 422 && /No lookup value found.*customer/i.test(message);
}

export function buildZammadTicketPayload(input = {}, settings = {}) {
  const category = CATEGORY_LABELS[String(input.category || 'general').toLowerCase()] || CATEGORY_LABELS.general;
  const subject = cleanText(input.subject, 200);
  const message = cleanText(input.message, 10_000);
  const user = input.user || null;
  const reporterEmail = user?.email || cleanEmail(input.email);
  if (!subject || !message || !reporterEmail) throw Object.assign(new Error('Subject, message, and email are required'), { status: 400 });
  const context = input.context && typeof input.context === 'object' ? input.context : {};
  const bodySections = [
    message,
    user ? [
      '',
      '--- Rootminster user context ---',
      line('User ID', user.id),
      line('Email', user.email),
      line('Name', user.full_name),
      line('Role', user.role),
      line('Status', user.status),
    ].filter(Boolean).join('\n') : [
      '',
      '--- Reporter ---',
      line('Name', input.name),
      line('Email', reporterEmail),
    ].filter(Boolean).join('\n'),
    Object.keys(context).length ? [
      '',
      '--- Request context ---',
      ...Object.entries(context).map(([key, value]) => line(key, value)).filter(Boolean),
    ].join('\n') : '',
  ].filter(Boolean);
  return {
    title: `[${category}] ${subject}`,
    group: settings.group || 'General Support',
    customer: reporterEmail,
    article: {
      subject,
      body: bodySections.join('\n'),
      type: 'email',
      sender: 'Customer',
      from: reporterEmail,
      internal: false,
    },
  };
}

async function zammadRequest(apiUrl, apiToken, path, body, fetchImpl) {
  const response = await fetchImpl(`${apiUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Token token=${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function ensureZammadCustomer(apiUrl, apiToken, payload, input, user, fetchImpl) {
  const email = payload.customer;
  const { firstname, lastname } = splitName(user?.full_name || input.name || email);
  const { response, data } = await zammadRequest(apiUrl, apiToken, '/api/v1/users', {
    email,
    login: email,
    firstname,
    lastname,
    roles: ['Customer'],
  }, fetchImpl);
  if (!response.ok && response.status !== 422) {
    throw Object.assign(new Error(data.error || data.message || 'Zammad customer creation failed'), { status: response.status, data });
  }
}

export async function createZammadTicketWithSettings(input, user, settings, fetchImpl = fetch) {
  if (!settings.enabled && settings.enabled !== undefined) throw Object.assign(new Error('Zammad integration is not configured'), { status: 503 });
  if (!settings.api_url || !settings.api_token) throw Object.assign(new Error('Zammad integration is not configured'), { status: 503 });
  const apiUrl = String(settings.api_url).replace(/\/$/, '');
  const apiToken = settings.api_token;
  const payload = buildZammadTicketPayload({ ...input, user }, { group: settings.default_group || 'General Support' });
  let { response, data } = await zammadRequest(apiUrl, apiToken, '/api/v1/tickets', payload, fetchImpl);
  if (missingCustomerError(response.status, data)) {
    await ensureZammadCustomer(apiUrl, apiToken, payload, input, user, fetchImpl);
    ({ response, data } = await zammadRequest(apiUrl, apiToken, '/api/v1/tickets', payload, fetchImpl));
  }
  if (!response.ok) throw Object.assign(new Error(data.error || data.message || 'Zammad ticket creation failed'), { status: response.status, data });
  return data;
}

export async function createZammadTicket(input, user = null) {
  const { getModuleConfig } = await import('./module-settings.js');
  const settings = await getModuleConfig('zammad');
  return createZammadTicketWithSettings(input, user, settings);
}

export async function registerZammadRoutes(app) {
  app.post('/api/support/tickets', { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { authenticateRequest } = await import('./auth.js');
    const user = await authenticateRequest(request, { allowMfaPending: true });
    const ticket = await createZammadTicket(request.body || {}, user);
    return reply.code(201).send({ success: true, ticket: { id: ticket.id, number: ticket.number, title: ticket.title } });
  });
}
