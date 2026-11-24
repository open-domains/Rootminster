// Guided DNS setups for common hosts. Each template builds the records to create, relative
// to the subdomain being managed ('@' is the subdomain itself), and is plain data so the
// "check it worked" step and tests can use it without React.

export const DNS_TEMPLATES = [
  {
    id: 'github-pages',
    icon: 'github',
    field: { key: 'username' },
    build: ({ username }) => [
      { name: '@', type: 'A', value: '185.199.108.153' },
      { name: '@', type: 'A', value: '185.199.109.153' },
      { name: '@', type: 'A', value: '185.199.110.153' },
      { name: '@', type: 'A', value: '185.199.111.153' },
      { name: 'www', type: 'CNAME', value: `${username}.github.io` },
    ],
  },
  {
    id: 'vercel',
    icon: 'cloud',
    build: () => [
      { name: '@', type: 'A', value: '76.76.21.21' },
      { name: 'www', type: 'CNAME', value: 'cname.vercel-dns-0.com' },
    ],
  },
  {
    id: 'netlify',
    icon: 'cloud',
    field: { key: 'site' },
    build: ({ site }) => [
      { name: '@', type: 'A', value: '75.2.60.5' },
      { name: 'www', type: 'CNAME', value: `${site}.netlify.app` },
    ],
  },
  {
    id: 'cloudflare-pages',
    icon: 'cloud',
    field: { key: 'project' },
    build: ({ project }) => [
      { name: 'www', type: 'CNAME', value: `${project}.pages.dev` },
    ],
  },
  {
    id: 'render',
    icon: 'cloud',
    field: { key: 'service' },
    build: ({ service }) => [
      { name: '@', type: 'A', value: '216.24.57.1' },
      { name: 'www', type: 'CNAME', value: `${service}.onrender.com` },
    ],
  },
  {
    id: 'fastmail',
    icon: 'mail',
    build: (_values, baseName) => [
      { name: '@', type: 'MX', value: '10 in1-smtp.messagingengine.com' },
      { name: '@', type: 'MX', value: '20 in2-smtp.messagingengine.com' },
      { name: '@', type: 'TXT', value: 'v=spf1 include:spf.messagingengine.com ?all' },
      { name: 'fm1._domainkey', type: 'CNAME', value: `fm1.${baseName}.dkim.fmhosted.com` },
      { name: 'fm2._domainkey', type: 'CNAME', value: `fm2.${baseName}.dkim.fmhosted.com` },
      { name: 'fm3._domainkey', type: 'CNAME', value: `fm3.${baseName}.dkim.fmhosted.com` },
    ],
  },
  {
    id: 'proton-mail',
    icon: 'mail',
    field: { key: 'token', raw: true },
    build: ({ token }) => [
      { name: '@', type: 'TXT', value: token },
      { name: '@', type: 'MX', value: '10 mail.protonmail.ch' },
      { name: '@', type: 'MX', value: '20 mailsec.protonmail.ch' },
      { name: '@', type: 'TXT', value: 'v=spf1 include:_spf.protonmail.ch ~all' },
    ],
  },
  {
    id: 'bluesky',
    icon: 'badge',
    field: { key: 'did' },
    build: ({ did }) => [
      { name: '_atproto', type: 'TXT', value: `did=${did}` },
    ],
  },
  {
    id: 'minecraft',
    icon: 'server',
    field: { key: 'ip' },
    build: ({ ip }) => [
      { name: 'mc', type: 'A', value: ip },
    ],
  },
  {
    id: 'verification',
    icon: 'badge',
    field: { key: 'token', raw: true },
    build: ({ token }) => [
      { name: '@', type: 'TXT', value: token },
    ],
  },
];

export function templateById(id) {
  return DNS_TEMPLATES.find((template) => template.id === id) || DNS_TEMPLATES[0];
}

// Normalises what someone types into a template field. Tokens are pasted verbatim; other
// fields are hostnames or identifiers, so they are trimmed and lower-cased.
export function templateFieldValue(template, value) {
  const text = String(value ?? '');
  if (template.field?.raw) return text;
  const trimmed = text.trim();
  return template.id === 'bluesky' ? trimmed.replace(/^did=/, '') : trimmed.toLowerCase();
}

export function fullRecordName(name, baseName) {
  return !name || name === '@' ? baseName : `${name}.${baseName}`;
}

// Picks the health check results that belong to the records a template just created, and
// sums them up. Any record with no result yet counts as pending.
export function summariseTemplateHealth(report, records, baseName) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const rows = [];
  const seen = new Set();
  for (const record of records) {
    const full = fullRecordName(record.name, baseName).toLowerCase();
    const key = `${full}|${record.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = checks.filter((check) => String(check.name || '').toLowerCase() === full && String(check.record_type || '').toUpperCase() === record.type);
    const status = !matches.length ? 'pending'
      : matches.every((check) => check.status === 'pass') ? 'pass'
        : matches.some((check) => check.status === 'warning') ? 'warning' : 'unknown';
    const detail = matches.find((check) => check.status !== 'pass') || matches[0];
    rows.push({ name: full, type: record.type, status, title: detail?.title || null, action: detail?.action || null });
  }
  const overall = rows.every((row) => row.status === 'pass') ? 'pass'
    : rows.some((row) => row.status === 'warning') ? 'warning' : 'pending';
  return { overall, rows };
}
