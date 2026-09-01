import { createPlatformClientFromRequest } from '../lib/platform-client.js';
import { getClient } from '@umami/api-client';
import { getModuleConfig } from '../module-settings.js';
function cleanHost(value) {
    return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\.+$/, '');
}
function analyticsBaseUrl(settings) {
    const explicit = settings.base_url;
    if (explicit) return explicit.replace(/\/+$/, '');
    return settings.api_endpoint ? settings.api_endpoint.replace(/\/api\/?$/, '').replace(/\/+$/, '') : '';
}
function makeUmamiClient(settings) {
    const userId = settings.user_id;
    const secret = settings.api_secret;
    const base = analyticsBaseUrl(settings);
    const apiEndpoint = settings.api_endpoint || (base ? `${base}/api/` : '');
    if (!userId || !secret || !apiEndpoint) {
        throw new Error('Analytics is not configured. UMAMI user ID, app secret and endpoint are required.');
    }
    return getClient({ userId, secret, apiEndpoint });
}
function unwrap(result, message) {
    if (!result?.ok) {
        const detail = result?.error?.message || result?.error?.error || result?.error || `HTTP ${result?.status || 'error'}`;
        throw new Error(`${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
    return result.data;
}
async function getOwnership(platform, user, rawName) {
    const fullName = cleanHost(rawName);
    if (!fullName)
        throw new Error('A subdomain is required');
    const rows = await platform.asServiceRole.entities.SubdomainOwnership.filter({
        owner_id: user.id,
        full_name: fullName,
    });
    const ownership = rows[0];
    if (!ownership)
        throw new Error('You do not own this subdomain');
    return ownership;
}
function metricRows(value) {
    if (Array.isArray(value))
        return value;
    if (Array.isArray(value?.data))
        return value.data;
    return [];
}
function trackingSnippet(websiteId, settings) {
    const base = analyticsBaseUrl(settings);
    return `<script defer src="${base}/script.js" data-website-id="${websiteId}"></script>`;
}
export default async function (req) {
    try {
        if (req.method !== 'POST') {
            return Response.json({ error: 'Method not allowed' }, { status: 405 });
        }
        const platform = createPlatformClientFromRequest(req);
        const user = await platform.auth.me().catch(() => null);
        if (!user)
            return Response.json({ error: 'Authentication required' }, { status: 401 });
        const body = await req.json().catch(() => ({}));
        const analytics = await getModuleConfig('analytics');
        if (!analytics.enabled) return Response.json({ error: 'Analytics is disabled' }, { status: 404 });
        const action = String(body.action || 'status');
        const ownership = await getOwnership(platform, user, body.subdomain);
        const umami = makeUmamiClient(analytics);
        if (action === 'status') {
            return Response.json({
                enabled: !!ownership.analytics_enabled && !!ownership.umami_website_id,
                website_id: ownership.umami_website_id || null,
                enabled_at: ownership.analytics_enabled_at || null,
                subdomain: ownership.full_name,
                tracker_url: `${analyticsBaseUrl(analytics)}/script.js`,
                tracking_snippet: ownership.umami_website_id ? trackingSnippet(ownership.umami_website_id, analytics) : null,
            });
        }
        if (action === 'enable') {
            if (ownership.umami_website_id) {
                await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                    analytics_enabled: true,
                    analytics_enabled_at: ownership.analytics_enabled_at || new Date().toISOString(),
                });
                return Response.json({
                    enabled: true,
                    website_id: ownership.umami_website_id,
                    tracking_snippet: trackingSnippet(ownership.umami_website_id, analytics),
                });
            }
            const created = unwrap(await umami.createWebsite({ name: ownership.full_name, domain: ownership.full_name }), 'Could not create the analytics site');
            const websiteId = created?.id;
            if (!websiteId)
                throw new Error('Umami did not return a website ID');
            const now = new Date().toISOString();
            await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                analytics_enabled: true,
                umami_website_id: websiteId,
                analytics_enabled_at: now,
            });
            return Response.json({
                enabled: true,
                website_id: websiteId,
                enabled_at: now,
                tracking_snippet: trackingSnippet(websiteId, analytics),
            });
        }
        if (action === 'disable') {
            if (ownership.umami_website_id && body.delete_data === true) {
                unwrap(await umami.deleteWebsite(ownership.umami_website_id), 'Could not delete analytics data');
                await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                    analytics_enabled: false,
                    umami_website_id: '',
                    analytics_enabled_at: null,
                });
            }
            else {
                await platform.asServiceRole.entities.SubdomainOwnership.update(ownership.id, {
                    analytics_enabled: false,
                });
            }
            return Response.json({ enabled: false, data_deleted: body.delete_data === true });
        }
        if (action === 'stats') {
            if (!ownership.analytics_enabled || !ownership.umami_website_id) {
                return Response.json({ error: 'Analytics is not enabled for this subdomain' }, { status: 409 });
            }
            const days = Math.min(365, Math.max(1, Number(body.days || 30)));
            const endAt = Date.now();
            const startAt = endAt - days * 24 * 60 * 60 * 1000;
            const timezone = String(body.timezone || 'UTC');
            const unit = days <= 2 ? 'hour' : days <= 180 ? 'day' : 'month';
            const id = ownership.umami_website_id;
            const [statsResult, pageviewsResult, activeResult, pagesResult, referrersResult, countriesResult, devicesResult] = await Promise.all([
                umami.getWebsiteStats(id, { startAt, endAt }),
                umami.getWebsitePageviews(id, { startAt, endAt, unit, timezone }),
                umami.getWebsiteActive(id),
                umami.getWebsiteMetrics(id, { type: 'url', startAt, endAt, limit: 8 }),
                umami.getWebsiteMetrics(id, { type: 'referrer', startAt, endAt, limit: 8 }),
                umami.getWebsiteMetrics(id, { type: 'country', startAt, endAt, limit: 8 }),
                umami.getWebsiteMetrics(id, { type: 'device', startAt, endAt, limit: 8 }),
            ]);
            const stats = unwrap(statsResult, 'Could not load analytics summary');
            const pageviews = unwrap(pageviewsResult, 'Could not load traffic history');
            const active = unwrap(activeResult, 'Could not load active visitors');
            return Response.json({
                subdomain: ownership.full_name,
                website_id: id,
                range: { days, start_at: startAt, end_at: endAt, unit, timezone },
                stats,
                pageviews,
                active,
                metrics: {
                    pages: pagesResult?.ok ? metricRows(pagesResult.data) : [],
                    referrers: referrersResult?.ok ? metricRows(referrersResult.data) : [],
                    countries: countriesResult?.ok ? metricRows(countriesResult.data) : [],
                    devices: devicesResult?.ok ? metricRows(devicesResult.data) : [],
                },
            });
        }
        return Response.json({ error: 'Unknown analytics action' }, { status: 400 });
    }
    catch (error) {
        console.error('analyticsManager error', error);
        return Response.json({
            error: error instanceof Error ? error.message : 'Analytics request failed',
        }, { status: 500 });
    }
}
