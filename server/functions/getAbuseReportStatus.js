import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { findReporter, parseStatusToken, publicReportStatus } from '../lib/abuse-reports.js';

// Public: a reporter's private status link. Shows the status only, never staff notes.
export default async function (req) {
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
    try {
        const body = await req.json().catch(() => ({}));
        const parsed = parseStatusToken(body.token);
        const notFound = Response.json({ error: 'This status link is not valid.' }, { status: 404 });
        if (!parsed) return notFound;
        const platform = createPlatformClientFromRequest(req);
        const rows = await platform.asServiceRole.entities.AbuseReport.filter({ id: parsed.reportId });
        const report = rows[0];
        if (!report || !findReporter(report, parsed.secret)) return notFound;
        return Response.json(publicReportStatus(report), { headers: { 'Cache-Control': 'no-store' } });
    }
    catch {
        return Response.json({ error: 'Could not load the report status.' }, { status: 500 });
    }
}
