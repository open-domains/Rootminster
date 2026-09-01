import { getModuleConfig } from '../module-settings.js';

export const SAFETY_RULESET_VERSION = '2026-08-31.1';

const SUSPICIOUS_TERMS = new Map([
  ['login', 18], ['signin', 18], ['verify', 16], ['verification', 16],
  ['account', 10], ['secure', 10], ['wallet', 18], ['recovery', 12],
  ['password', 22], ['support', 8], ['billing', 12], ['update', 8],
  ['gift', 10], ['claim', 10], ['free', 6], ['crypto', 12],
]);

const URL_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'rebrand.ly',
  'shorturl.at', 'tiny.cc', 'ow.ly', 'buff.ly',
]);

function signal(code, label, score, severity = 'medium', evidence = '') {
  return { code, label, score, severity, evidence: String(evidence || '').slice(0, 500) };
}

function parseDate(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function parseProtectedBrands(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
  return [...new Set(values.map((item) => String(item).trim().toLowerCase()).filter((item) => /^[a-z0-9][a-z0-9-]{1,62}$/.test(item)))];
}

function hostnameIsPrivate(hostname) {
  const value = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return value === 'localhost' || value.endsWith('.localhost') || value === '::1' || value.startsWith('127.') ||
    value.startsWith('10.') || value.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    value.startsWith('169.254.') || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd');
}

function addTextSignals(request, signals) {
  const name = String(request.subdomain || '').toLowerCase();
  const text = `${name} ${request.reason || ''}`.toLowerCase();
  const matches = [];
  let termScore = 0;
  for (const [term, weight] of SUSPICIOUS_TERMS) {
    if (new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`, 'i').test(text) || name.includes(term)) {
      matches.push(term);
      termScore = Math.max(termScore, weight);
    }
  }
  if (matches.length) {
    const bonus = Math.min(Math.max(matches.length - 1, 0) * 4, 12);
    signals.push(signal('suspicious_terms', 'Suspicious wording', termScore + bonus, termScore >= 18 ? 'high' : 'medium', matches.join(', ')));
  }
}

function addPreviewSignals(request, signals) {
  const raw = String(request.preview_link || '').trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    signals.push(signal('invalid_preview_url', 'Preview link is not a valid URL', 45, 'high', raw));
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    signals.push(signal('unsafe_preview_scheme', 'Preview link uses an unsupported protocol', 70, 'critical', url.protocol));
  }
  if (url.username || url.password) signals.push(signal('preview_credentials', 'Preview URL contains embedded credentials', 45, 'high', url.hostname));
  if (hostnameIsPrivate(url.hostname)) signals.push(signal('private_preview_host', 'Preview points to a private or local host', 70, 'critical', url.hostname));
  if (URL_SHORTENERS.has(url.hostname.toLowerCase())) signals.push(signal('shortened_preview', 'Preview uses a URL shortener', 28, 'medium', url.hostname));
  if (url.hostname.toLowerCase().startsWith('xn--') || url.hostname.toLowerCase().includes('.xn--')) {
    signals.push(signal('punycode_preview', 'Preview contains an internationalised hostname', 25, 'medium', url.hostname));
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) signals.push(signal('preview_ip_literal', 'Preview uses an IP address instead of a hostname', 25, 'medium', url.hostname));
}

function addBrandSignals(request, protectedBrands, signals) {
  const name = String(request.subdomain || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const brand of parseProtectedBrands(protectedBrands)) {
    const compact = brand.replace(/-/g, '');
    if (name === compact || name.startsWith(compact) || name.endsWith(compact)) {
      signals.push(signal('protected_brand', 'Subdomain resembles a protected brand', 50, 'high', brand));
      break;
    }
  }
}

export function assessDeterministic(request, context = {}) {
  const signals = [];
  addTextSignals(request, signals);
  addPreviewSignals(request, signals);
  addBrandSignals(request, context.protectedBrands, signals);

  const now = context.now ? new Date(context.now).getTime() : Date.now();
  const accountCreated = parseDate(context.user?.created_date);
  const accountAgeDays = accountCreated ? Math.max((now - accountCreated) / 86_400_000, 0) : null;
  if (accountAgeDays !== null && accountAgeDays < 7) {
    signals.push(signal('new_account', 'Account is less than seven days old', 10, 'low', `${Math.floor(accountAgeDays)} day(s)`));
    if (['MX', 'NS'].includes(request.record_type)) {
      signals.push(signal('new_account_sensitive_record', 'New account requested a sensitive DNS record type', 18, 'medium', request.record_type));
    }
  }

  const recent = Array.isArray(context.recentRequests) ? context.recentRequests : [];
  const hourAgo = now - 3_600_000;
  const dayAgo = now - 86_400_000;
  const lastHour = recent.filter((item) => parseDate(item.created_date) >= hourAgo).length;
  const lastDay = recent.filter((item) => parseDate(item.created_date) >= dayAgo).length;
  if (lastHour >= 5) signals.push(signal('request_velocity_hour', 'High request velocity in the last hour', 25, 'high', `${lastHour} requests`));
  else if (lastDay >= 10) signals.push(signal('request_velocity_day', 'High request velocity in the last day', 15, 'medium', `${lastDay} requests`));

  const rejected = recent.filter((item) => item.status === 'rejected').length;
  if (rejected >= 3) signals.push(signal('prior_rejections', 'Account has several rejected requests', 20, 'medium', `${rejected} rejected requests`));
  if (Number(context.distinctTargetAccounts || 0) >= 3) {
    signals.push(signal('shared_dns_target', 'DNS target is reused across several accounts', 20, 'medium', `${context.distinctTargetAccounts} accounts`));
  }

  const score = Math.min(signals.reduce((total, item) => total + item.score, 0), 100);
  const verdict = score >= 70 ? 'high_risk' : score >= 30 ? 'review' : 'clear';
  return { score, verdict, signals, ruleset_version: SAFETY_RULESET_VERSION };
}

function normaliseProviderResult(data) {
  if (!data || typeof data !== 'object') return null;
  const score = Math.min(Math.max(Number(data.risk_score) || 0, 0), 40);
  const rawSignals = Array.isArray(data.signals) ? data.signals.slice(0, 10) : [];
  const signals = rawSignals.map((item, index) => signal(
    `provider_${String(item.code || index).replace(/[^a-z0-9_-]/gi, '').slice(0, 40)}`,
    String(item.label || 'Reputation provider signal').slice(0, 160),
    Math.min(Math.max(Number(item.score) || 0, 0), 40),
    ['low', 'medium', 'high', 'critical'].includes(item.severity) ? item.severity : 'medium',
    item.evidence,
  ));
  if (score > 0 && signals.length === 0) signals.push(signal('provider_risk', 'Reputation provider reported risk', score, score >= 30 ? 'high' : 'medium'));
  return { score, signals };
}

async function checkProvider(request, safety) {
  if (!safety.provider_url) return { status: 'not_configured', score: 0, signals: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), safety.provider_timeout_ms || 5000);
  try {
    const response = await fetch(safety.provider_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(safety.provider_token ? { Authorization: `Bearer ${safety.provider_token}` } : {}),
      },
      body: JSON.stringify({
        request_id: request.id,
        subdomain: request.subdomain,
        root_domain: request.root_domain,
        record_type: request.record_type,
        record_value: request.record_value,
        reason: request.reason,
        preview_link: request.preview_link,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const result = normaliseProviderResult(await response.json());
    if (!result) throw new Error('Provider returned an invalid response');
    return { status: 'complete', ...result };
  } catch (error) {
    return { status: 'failed', score: 0, signals: [], error: error.name === 'AbortError' ? 'Provider timed out' : error.message };
  } finally {
    clearTimeout(timer);
  }
}

async function screeningContext(platform, request, user) {
  const [settings, byUser, targetMatches, safety] = await Promise.all([
    platform.asServiceRole.entities.PlatformSettings.filter({ key: { $in: ['safety_screening_enabled', 'safety_protected_brands'] } }),
    platform.asServiceRole.entities.SubdomainRequest.filter({ requester_id: request.requester_id }, '-created_date', 500),
    platform.asServiceRole.entities.SubdomainRequest.filter({ record_value: request.record_value }, '-created_date', 500),
    getModuleConfig('safety'),
  ]);
  const settingMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const distinctTargetAccounts = new Set(targetMatches.map((item) => item.requester_id || item.requester_email).filter(Boolean)).size;
  return {
    enabled: settingMap.safety_screening_enabled !== 'false' && safety.enabled,
    safety,
    protectedBrands: settingMap.safety_protected_brands || '',
    recentRequests: byUser.filter((item) => item.id !== request.id),
    distinctTargetAccounts,
    user,
  };
}

export async function screenRequest(platform, request, user, trigger = 'submission') {
  const context = await screeningContext(platform, request, user);
  const screenedAt = new Date().toISOString();
  let result;
  let provider = { status: 'not_run', score: 0, signals: [] };
  if (!context.enabled) {
    result = { score: 0, verdict: 'disabled', signals: [], ruleset_version: SAFETY_RULESET_VERSION };
  } else {
    result = assessDeterministic(request, context);
    provider = await checkProvider(request, context.safety);
    const signals = [...result.signals, ...provider.signals];
    const score = Math.min(result.score + provider.score, 100);
    result = { ...result, score, verdict: score >= 70 ? 'high_risk' : score >= 30 ? 'review' : 'clear', signals };
  }
  const assessment = await platform.asServiceRole.entities.SafetyAssessment.create({
    request_id: request.id,
    score: result.score,
    verdict: result.verdict,
    signals: result.signals,
    ruleset_version: result.ruleset_version,
    provider_status: provider.status,
    provider_error: provider.error || '',
    trigger,
    screened_at: screenedAt,
    overridden: false,
  });
  await platform.asServiceRole.entities.SubdomainRequest.update(request.id, {
    safety_assessment_id: assessment.id,
    safety_score: result.score,
    safety_verdict: result.verdict,
    safety_screened_at: screenedAt,
    safety_ruleset_version: result.ruleset_version,
    safety_provider_status: provider.status,
  });
  return assessment;
}
