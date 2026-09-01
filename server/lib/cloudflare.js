import { getModuleConfig } from '../module-settings.js';

const CF_BASE = 'https://api.cloudflare.com/client/v4';

export async function cloudflareFetch(method, path, body) {
  const module = await getModuleConfig('cloudflare');
  if (!module.enabled || !module.api_token) {
    throw Object.assign(new Error('Cloudflare module is disabled or not configured'), { status: 503 });
  }
  const response = await fetch(`${CF_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${module.api_token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ...data, _httpStatus: response.status };
}

export function cloudflareGet(path) {
  return cloudflareFetch('GET', path);
}
