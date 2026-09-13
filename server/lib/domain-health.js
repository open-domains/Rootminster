import { isIP } from 'node:net';

export const DNS_TYPES = { A: 1, NS: 2, CNAME: 5, PTR: 12, MX: 15, TXT: 16, AAAA: 28, SRV: 33, CAA: 257 };
export const normalizeName = value => String(value || '').trim().toLowerCase().replace(/\.$/, '');
export const withinName = (name, base) => name === base || name.endsWith(`.${base}`);
export function validHealthName(name) {
  return typeof name === 'string' && name.length <= 253 && name.includes('.') && !isIP(name) && name.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

// Fixed resolver endpoint: user input is a DNS question, never a fetch target.
export async function queryPublicDns(name, type, { signal, checkingDisabled = false } = {}) {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.search = new URLSearchParams({ name, type, do: 'true', cd: String(checkingDisabled) }).toString();
  const response = await fetch(url, { headers: { Accept: 'application/dns-json' }, signal, redirect: 'error' });
  if (!response.ok) throw new Error('DNS resolver unavailable');
  const data = await response.json();
  if (!Number.isInteger(data.Status) || (data.Answer !== undefined && !Array.isArray(data.Answer))) throw new Error('Invalid resolver response');
  return data;
}
function decodeTxt(text) {
  const chunks = text.match(/"(?:\\[\s\S]|[^"\\])*"/g);
  if (!chunks || chunks.join(' ') !== text.replace(/"\s+"/g, '" "')) return text;
  const bytes = [];
  for (const chunk of chunks) {
    const value = chunk.slice(1, -1);
    for (let i = 0; i < value.length;) {
      if (value[i] === '\\') {
        const decimal = value.slice(i + 1, i + 4);
        if (/^\d{3}$/.test(decimal) && Number(decimal) <= 255) {
          bytes.push(Number(decimal)); i += 4; continue;
        }
        i++;
      }
      const char = String.fromCodePoint(value.codePointAt(i));
      bytes.push(...Buffer.from(char));
      i += char.length;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}
function normalizeValue(type, value, priority, presentation = false) {
  const text = String(value ?? '').trim();
  if (type === 'TXT') return presentation ? decodeTxt(text) : String(value ?? '');
  if (type === 'AAAA' && isIP(text) === 6) return new URL(`http://[${text}]/`).hostname;
  if (type === 'MX') {
    const match = text.match(/^(\d+)\s+(.+)$/);
    return `${match ? Number(match[1]) : Number(priority ?? 0)} ${normalizeName(match ? match[2] : text)}`;
  }
  if (['CNAME', 'NS', 'PTR'].includes(type)) return normalizeName(text);
  if (type === 'SRV') return text.replace(/\s+/g, ' ').replace(/\.$/, '').toLowerCase();
  return text;
}
const finding = (status, title, detail, action) => ({ status, title, detail, action });
const unavailable = () => finding('unknown', 'Check unavailable', 'The public resolver did not return a usable answer.', 'Try again shortly. Your saved DNS records have not changed.');

async function inspectRecord(record, query) {
  const type = String(record.record_type || '').toUpperCase();
  if (!DNS_TYPES[type] || record.name.includes('*')) return finding('info', 'Manual check needed', 'Wildcard or unsupported records are not compared automatically.', 'Test a specific hostname covered by this record with a DNS lookup.');
  if (record.status && record.status !== 'active') return finding('warning', 'Record is not active', `This record is ${record.status}.`, 'Review the record status or contact support before checking propagation.');
  const hiddenOrigin = ['A', 'AAAA', 'CNAME'].includes(type) && (record.proxied || (type === 'CNAME' && record.cname_flatten));
  try {
    const data = hiddenOrigin ? await Promise.all([query(record.name, 'A'), query(record.name, 'AAAA')]) : [await query(record.name, type)];
    if (hiddenOrigin && data.some(item => item.Status === 0 && item.Answer?.some(answer => [1, 28].includes(answer.type)))) {
      return finding('pass', 'Hostname resolves', 'Public address records are present. Proxying or CNAME flattening hides the saved origin.', 'Origin content and website availability are not verified by this check.');
    }
    if (data.some(item => ![0, 3].includes(item.Status))) return finding('unknown', 'Resolver could not answer', 'The resolver returned a DNS error.', 'Retry, then review delegation and DNSSEC with your domain operator if the error persists.');
    const answers = data.flatMap(item => item.Answer || []).filter(answer => answer.type === DNS_TYPES[type] && normalizeName(answer.name) === normalizeName(record.name));
    if (hiddenOrigin || !answers.length) return finding('warning', 'Public record missing', `No ${hiddenOrigin ? 'address' : type} answer was found for this hostname.`, 'Check the name and record type. If recently changed, wait for the previous TTL to expire and run the check again.');
    const expected = normalizeValue(type, record.content, record.priority);
    if (answers.some(answer => normalizeValue(type, answer.data, undefined, true) === expected)) return finding('pass', 'Public record matches', 'The public DNS answer matches the saved record.', null);
    return finding('warning', 'Public value differs', 'Public DNS returned a different value from the saved record.', 'Review the saved content and priority. Allow the previous TTL to expire; if it still differs, contact support about DNS synchronization.');
  } catch { return unavailable(); }
}

export async function buildDomainHealth(name, records, { query = queryPublicDns, signal = AbortSignal.timeout(12_000) } = {}) {
  const memo = new Map();
  const ask = (hostname, type, checkingDisabled = false) => {
    const key = `${hostname}:${type}:${checkingDisabled}`;
    if (!memo.has(key)) memo.set(key, Promise.resolve().then(() => {
      signal.throwIfAborted();
      return query(hostname, type, { signal, checkingDisabled });
    }));
    return memo.get(key);
  };
  const checks = [];
  if (!records.length) checks.push({ id: 'configuration', ...finding('warning', 'No saved records', 'This namespace has no managed DNS records.', 'Add the records required by your hosting or email provider. An A or AAAA record is not required for every use case.') });
  for (let i = 0; i < Math.min(records.length, 50); i += 5) {
    checks.push(...await Promise.all(records.slice(i, Math.min(i + 5, 50)).map(async record => ({
      id: record.id, name: record.name, record_type: record.record_type, ...await inspectRecord(record, ask),
    }))));
  }
  if (records.length > 50) checks.push({ id: 'limit', ...finding('info', 'Partial record check', `Checked the first 50 of ${records.length} saved records.`, 'Use individual DNS lookups to inspect the remaining records.') });
  let dnssec;
  try {
    const answer = await ask(name, 'A');
    if (answer.Status === 2) {
      const unchecked = await ask(name, 'A', true);
      dnssec = [0, 3].includes(unchecked.Status)
        ? finding('warning', 'Possible DNSSEC validation issue', 'The query failed with validation enabled but answered with validation disabled.', 'Ask the domain operator to review DNSSEC signatures and the parent DS record. Do not delete records based on this result alone.')
        : finding('unknown', 'DNSSEC could not be assessed', 'The resolver failed even with validation disabled.', 'Review authoritative nameservers and retry. This does not prove a DNSSEC fault.');
    } else if (![0, 3].includes(answer.Status)) dnssec = unavailable();
    else if (answer.AD === true) dnssec = finding('pass', 'DNSSEC validated', 'The resolver authenticated the DNS response.', null);
    else dnssec = finding('info', 'DNSSEC not confirmed', 'This response was not marked as authenticated. That alone does not indicate broken DNS.', 'The parent domain operator can confirm whether signing is enabled.');
  } catch { dnssec = unavailable(); }
  checks.push({ id: 'dnssec', ...dnssec });
  return { name, checked_at: new Date().toISOString(), resolver: 'Cloudflare 1.1.1.1', status: checks.some(c => c.status === 'warning') ? 'warning' : checks.some(c => c.status === 'unknown') ? 'unknown' : checks.some(c => c.status === 'info') ? 'info' : 'pass', checks, checked_records: Math.min(records.length, 50), total_records: records.length };
}
