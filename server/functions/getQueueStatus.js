import { createPlatformClientFromRequest } from '../lib/platform-client.js';
export default async function (req) {
    const platform = createPlatformClientFromRequest(req);
    const pending = await platform.asServiceRole.entities.SubdomainRequest.filter({ status: 'pending' });
    const count = pending.length;
    // Estimate: base 1 day + 1 extra day per 10 pending requests, max 5 days
    let days;
    if (count <= 5)
        days = '1 business day';
    else if (count <= 15)
        days = '1–2 business days';
    else if (count <= 30)
        days = '2–3 business days';
    else
        days = '3–5 business days';
    return Response.json({ pending_count: count, estimated_review: days });
}
