import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { requestBundle, bundleComments } from '../lib/request-bundles.js';
export default async function(req) {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const platform = createPlatformClientFromRequest(req);
  const user = await platform.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { request_id } = await req.json();
  const target = await platform.asServiceRole.entities.SubdomainRequest.get(request_id);
  const elevated = ['admin','staff'].includes(user.role);
  if (!target || (!elevated && !(target.requester_id ? target.requester_id === user.id : target.requester_email === user.email))) return Response.json({ error: 'Request not found' }, { status: 404 });
  const bundle = await requestBundle(platform.asServiceRole.entities, target);
  const comments = await bundleComments(platform.asServiceRole.entities, bundle, elevated);
  return Response.json({ request_id: bundle.id, status: bundle.status, comments });
}
