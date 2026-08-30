export const PROXYABLE_TYPES = ['A', 'AAAA', 'CNAME'];
export const BASE_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];

export const TTL_OPTIONS = [
  { v: 3600, l: 'Auto' },
  { v: 60, l: '1 min' },
  { v: 300, l: '5 min' },
  { v: 1800, l: '30 min' },
  { v: 7200, l: '2 hours' },
  { v: 21600, l: '6 hours' },
  { v: 43200, l: '12 hours' },
  { v: 86400, l: '24 hours' },
];

export function ttlLabel(ttl) {
  const t = Number(ttl);
  const opt = TTL_OPTIONS.find(o => o.v === t);
  return opt ? opt.l : `${t}s`;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Normalize typed name: lowercase, collapse dots, strip outer dots/spaces. Keeps '@' and '*'.
export function sanitizeNameInput(v) {
  return (v || '').toLowerCase().replace(/\s/g, '').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '');
}

// Validate a name entered in the Add row, relative to baseName (the page's subdomain).
// Returns { valid, isRoot, label, full, error }
export function validateAddName(raw, baseName) {
  const r = (raw || '').trim().toLowerCase();
  if (r === '' || r === '@' || r === baseName) return { valid: true, isRoot: true, label: '', full: baseName, error: null };

  const s = sanitizeNameInput(r);
  if (s === '') return { valid: false, isRoot: false, label: '', full: '', error: 'Invalid name' };
  if (!/^[a-z0-9\-._*]+$/.test(s)) return { valid: false, isRoot: false, label: s, full: '', error: 'Only a-z, 0-9, -, _, ., * allowed' };

  const labels = s.split('.');
  for (const lab of labels) {
    if (lab.length > 63) return { valid: false, isRoot: false, label: s, full: '', error: 'Label exceeds 63 chars' };
    // allow '*' (wildcard label), underscore-prefixed system labels, and normal labels
    const ok = lab === '*' || /^[a-z0-9_][a-z0-9_\-]*$/.test(lab) || /^[a-z0-9\-]+[a-z0-9_\-]$/.test(lab);
    if (!ok) return { valid: false, isRoot: false, label: s, full: '', error: `Invalid label: "${lab}"` };
  }

  const full = `${s}.${baseName}`;
  if (full.length > 255) return { valid: false, isRoot: false, label: s, full: '', error: 'FQDN exceeds 255 chars' };
  return { valid: true, isRoot: false, label: s, full, error: null };
}

export function validateContent(type, content) {
  const v = (content || '').trim();
  if (!v) return { valid: false, error: 'Required' };
  switch (type) {
    case 'A':
      return IPV4.test(v) ? { valid: true } : { valid: false, error: 'Invalid IPv4 address' };
    case 'AAAA': {
      const ok = /^[0-9a-fA-F:]+$/.test(v) && v.includes(':') && !v.includes(' ')
        && (v.match(/:/g) || []).length <= 7 && v.split(':').every(p => p.length <= 4);
      return ok ? { valid: true } : { valid: false, error: 'Invalid IPv6 address' };
    }
    case 'CNAME':
      return (v === '@' || /^(\*\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(v))
        ? { valid: true } : { valid: false, error: 'Invalid hostname' };
    case 'MX': {
      const m = v.match(/^(\d{1,3})\s+(\S+)$/);
      if (m) {
        return /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(m[2])
          ? { valid: true } : { valid: false, error: 'Invalid MX target' };
      }
      return { valid: false, error: 'MX needs priority & host — e.g. "10 mail.example.com"' };
    }
    case 'TXT':
      return { valid: true };
    default:
      return { valid: true };
  }
}

// Conflict detection for add / edit. excludeId optional (editing existing record).
export function checkConflict(fullName, type, content, existing, excludeId) {
  const sameName = existing.filter(r => r.name === fullName && r.id !== excludeId);
  if (type === 'CNAME') {
    if (sameName.length > 0) return { conflict: true, message: 'CNAME cannot coexist with other records at this name' };
  } else {
    if (sameName.some(r => r.record_type === 'CNAME')) return { conflict: true, message: 'A CNAME exists at this name' };
  }
  const dup = existing.find(r =>
    r.name === fullName && r.record_type === type && r.id !== excludeId &&
    (r.content || '').trim().toLowerCase() === (content || '').trim().toLowerCase()
  );
  if (dup) return { conflict: true, message: 'Identical record already exists' };
  return { conflict: false, message: null };
}