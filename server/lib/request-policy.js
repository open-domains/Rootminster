export async function getRequestPolicy(platform) {
  const rows = await platform.asServiceRole.entities.PlatformSettings.filter({
    key: { $in: ['requests_locked', 'requests_locked_message'] },
  });
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    locked: settings.requests_locked === 'true',
    message: settings.requests_locked_message || 'New subdomain requests are temporarily closed.',
  };
}

export function isReservedName(name, rules = []) {
  const candidate = String(name || '').trim().toLowerCase();
  return rules.some((rawRule) => {
    const rule = String(rawRule || '').trim().toLowerCase();
    if (!rule) return false;
    if (rule === '*') return true;
    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i').test(candidate);
  });
}
