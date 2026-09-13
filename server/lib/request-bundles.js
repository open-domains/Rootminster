import { groupSubdomainRequests, OPEN_REQUEST_STATUSES, requestHostname } from '../../shared/subdomain-requests.js';
import { withAdvisoryLock } from '../database.js';

export async function withRequestLock(hostname, callback) {
  const result = await withAdvisoryLock(`subdomain-request:${hostname.toLowerCase()}`, callback);
  if (result?.skipped) return Response.json({ error: 'Another request operation is in progress for this hostname. Please retry.' }, { status: 409 });
  return result;
}
export async function requestBundle(entities, request) {
  if (request.request_group_id) {
    const rows = await entities.SubdomainRequest.filter({ request_group_id: request.request_group_id });
    const own = rows.filter(row => request.requester_id ? row.requester_id === request.requester_id : row.requester_email === request.requester_email);
    return groupSubdomainRequests(own.length ? own : [request])[0];
  }
  if (Array.isArray(request.records) || !OPEN_REQUEST_STATUSES.includes(request.status)) return groupSubdomainRequests([request])[0];
  const siblings = await entities.SubdomainRequest.filter({ subdomain: request.subdomain, root_domain: request.root_domain, status: { $in: OPEN_REQUEST_STATUSES } });
  const rows = siblings.filter(row => !Array.isArray(row.records) && (request.requester_id ? row.requester_id === request.requester_id : String(row.requester_email).toLowerCase() === String(request.requester_email).toLowerCase()) && requestHostname(row) === requestHostname(request));
  return groupSubdomainRequests(rows.length ? rows : [request])[0];
}
export async function bundleComments(entities, bundle, elevated) {
  const comments = await entities.RequestComment.filter({ request_id: { $in: bundle._request_ids }, request_type: 'subdomain' }, 'created_date', 10000);
  return comments.filter(comment => elevated || !comment.is_internal);
}

export async function ensureRequestGroup(entities, bundle) {
  if (bundle._requests.length < 2) return;
  for (const row of bundle._requests) {
    await entities.SubdomainRequest.update(row.id, { request_group_id: bundle.id });
    row.request_group_id = bundle.id;
  }
}
