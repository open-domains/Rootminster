export const OPEN_REQUEST_STATUSES = ['pending', 'needs_info', 'user_responded'];
export const REQUEST_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];
export const requestHostname = request => String(request.full_name || `${request.subdomain}.${request.root_domain}`).toLowerCase().replace(/\.$/, '');
export function requestRecords(request) {
  return Array.isArray(request.records) && request.records.length ? request.records : [{ record_type: request.record_type, record_value: request.record_value, ttl: request.ttl, priority: request.priority, proxied: request.proxied, cloudflare_record_id: request.cloudflare_record_id, dns_record_id: request.dns_record_id }];
}
export function recordSetError(records) {
  if (!Array.isArray(records) || !records.length || records.length > 20) return 'A request must contain between 1 and 20 DNS records.';
  if (records.some(record => !record || !REQUEST_RECORD_TYPES.includes(record.record_type) || typeof record.record_value !== 'string' || !record.record_value.trim())) return 'Every record needs a supported type and a value.';
  if (records.some(record => record.record_type === 'CNAME') && records.length > 1) return 'A CNAME must be the only record at a hostname. Use A/AAAA records or one CNAME, not both.';
  if (records.some(record => record.record_type === 'NS') && records.some(record => record.record_type !== 'NS')) return 'NS delegation cannot be combined with other record types at the same hostname.';
  const seen = new Set();
  for (const record of records) {
    let value = record.record_value.trim();
    if (['CNAME', 'NS', 'MX'].includes(record.record_type)) value = value.toLowerCase().replace(/\.$/, '');
    if (record.record_type === 'MX' && !/^\d+\s+/.test(value)) value = `10 ${value}`;
    const key = `${record.record_type}:${value}`;
    if (seen.has(key)) return 'The request contains a duplicate DNS record.';
    seen.add(key);
  }
  return null;
}
export function groupSubdomainRequests(requests) {
  const groups = new Map();
  for (const request of requests) {
    // Only unresolved legacy rows are grouped. New bundles and historical
    // submissions keep their own IDs, even when they reuse a hostname.
    const key = request.request_group_id || (!Array.isArray(request.records) && OPEN_REQUEST_STATUSES.includes(request.status)
      ? `legacy:${request.requester_id || String(request.requester_email).toLowerCase()}:${requestHostname(request)}` : request.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(request);
  }
  return [...groups.values()].map(rows => {
    const sorted = [...rows].sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')) || a.id.localeCompare(b.id));
    const canonical = sorted[0];
    const priority = { user_responded: 5, needs_info: 4, pending: 3, approved: 2, rejected: 1 };
    const status = sorted.reduce((value, row) => (priority[row.status] || 0) > (priority[value] || 0) ? row.status : value, canonical.status);
    return { ...canonical, status, _requests: sorted, _request_ids: sorted.map(row => row.id), _records: sorted.flatMap(row => requestRecords(row).map((record, index) => ({ ...row, ...record, id: `${row.id}:${index}`, request_id: row.id, status: row.status }))) };
  });
}
