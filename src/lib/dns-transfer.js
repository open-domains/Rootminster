export const DNS_BACKUP_FORMAT = 'rootminster-dns-backup';
export const DNS_BACKUP_VERSION = 1;

const TRANSFERABLE_TYPES = new Set(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS']);

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function relativeName(name, baseName) {
  const full = normalizeName(name);
  const base = normalizeName(baseName);
  if (full === base) return '@';
  if (full.endsWith(`.${base}`)) return full.slice(0, -(base.length + 1));
  return null;
}

export function createDnsBackup(baseName, records, exportedAt = new Date().toISOString()) {
  const base = normalizeName(baseName);
  const portableRecords = (Array.isArray(records) ? records : []).map((record) => {
    const name = relativeName(record.name, base);
    if (name === null) return null;
    const type = String(record.record_type || '').toUpperCase();
    if (!TRANSFERABLE_TYPES.has(type)) return null;
    let content = String(record.content || '');
    if (type === 'MX' && record.priority !== undefined && record.priority !== null && !/^\d{1,5}\s+/.test(content)) {
      content = `${Number(record.priority)} ${content}`;
    }
    return {
      name,
      type,
      content,
      ttl: Number(record.ttl || 3600),
      proxied: Boolean(record.proxied),
      ...(record.priority !== undefined && record.priority !== null ? { priority: Number(record.priority) } : {}),
      ...(record.cname_flatten ? { cname_flatten: true } : {}),
    };
  }).filter(Boolean).sort((a, b) => `${a.name}:${a.type}:${a.content}`.localeCompare(`${b.name}:${b.type}:${b.content}`));

  return {
    format: DNS_BACKUP_FORMAT,
    version: DNS_BACKUP_VERSION,
    exported_at: exportedAt,
    base_name: base,
    records: portableRecords,
  };
}

export function parseDnsBackup(source, expectedBaseName) {
  if (typeof source !== 'string' || source.length > 256 * 1024) throw new Error('DNS backup files must be 256 KB or smaller');
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('This is not a valid JSON DNS backup');
  }
  if (!parsed || parsed.format !== DNS_BACKUP_FORMAT || parsed.version !== DNS_BACKUP_VERSION) {
    throw new Error('This is not a supported Rootminster DNS backup');
  }
  if (normalizeName(parsed.base_name) !== normalizeName(expectedBaseName)) {
    throw new Error(`This backup belongs to ${normalizeName(parsed.base_name) || 'another subdomain'}`);
  }
  if (!Array.isArray(parsed.records) || parsed.records.length > 100) {
    throw new Error('A DNS backup must contain no more than 100 records');
  }

  const records = parsed.records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`Record ${index + 1} is invalid`);
    const type = String(record.type || '').toUpperCase();
    const content = String(record.content ?? '').trim();
    const name = String(record.name ?? '').trim().toLowerCase();
    const ttl = Number(record.ttl ?? 3600);
    if (!TRANSFERABLE_TYPES.has(type)) throw new Error(`Record ${index + 1} has an unsupported type`);
    if (!name || name.length > 255) throw new Error(`Record ${index + 1} has an invalid name`);
    if (!content || content.length > 4096) throw new Error(`Record ${index + 1} has invalid content`);
    if (!Number.isInteger(ttl) || (ttl !== 1 && (ttl < 60 || ttl > 86400))) throw new Error(`Record ${index + 1} has an invalid TTL`);
    const priority = record.priority === undefined ? undefined : Number(record.priority);
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 999)) throw new Error(`Record ${index + 1} has an invalid priority`);
    return {
      name,
      type,
      content,
      ttl,
      proxied: Boolean(record.proxied),
      ...(priority !== undefined ? { priority } : {}),
      cname_flatten: Boolean(record.cname_flatten),
    };
  });

  return { ...parsed, base_name: normalizeName(parsed.base_name), records };
}
