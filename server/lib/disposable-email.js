const BUILT_IN_DOMAINS = new Set([
  '10minutemail.com', 'dispostable.com', 'emailondeck.com', 'fakeinbox.com',
  'getnada.com', 'guerrillamail.com', 'guerrillamail.net', 'maildrop.cc',
  'mailinator.com', 'mintemail.com', 'mohmal.com', 'mytemp.email',
  'sharklasers.com', 'spam4.me', 'temp-mail.org', 'tempmail.com',
  'tempmail.net', 'tempail.com', 'throwawaymail.com', 'trashmail.com',
  'yopmail.com', 'yopmail.fr',
]);

export function parseDisposableDomains(value) {
  return new Set(String(value || '').split(/[\s,;]+/).map((item) => item.trim().toLowerCase().replace(/^@/, '')).filter((item) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(item)));
}

export function disposableEmailResult(email, settings = {}) {
  if (!settings.enabled) return { disposable: false, domain: '' };
  const domain = String(email || '').trim().toLowerCase().split('@').pop() || '';
  const configured = parseDisposableDomains(settings.additional_domains);
  return { disposable: BUILT_IN_DOMAINS.has(domain) || configured.has(domain), domain };
}
