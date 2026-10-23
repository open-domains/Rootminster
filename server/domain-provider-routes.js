import { authenticateRequest } from './auth.js';
import { pool } from './database.js';
import { store } from './store.js';

/**
 * Dedicated routes for domain provider users.
 * A domain provider is a user with role='domain_provider' who has been assigned
 * one or more donated domains by an admin (Domain.provider_user_id = user.id).
 */
export async function registerDomainProviderRoutes(app) {
  /**
   * GET /api/domain-provider/stats
   * Returns stats for all domains assigned to the authenticated domain_provider.
   * Accessible only to users with role='domain_provider' or 'admin'.
   */
  app.get('/api/domain-provider/stats', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (user.role !== 'domain_provider' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Admins may supply ?user_id= to look up any provider; providers see only their own
    const targetUserId = user.role === 'admin' && request.query?.user_id
      ? request.query.user_id
      : user.id;

    // Find all domains assigned to this provider
    const domains = await store.filter('Domain', { provider_user_id: targetUserId });

    if (!domains.length) {
      return { data: { domains: [], totals: { active_subdomains: 0, pending_requests: 0, dns_records: 0, new_requests_7d: 0 } } };
    }

    const domainNames = domains.map((d) => d.name);

    // Per-domain stats from entity_records
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const statsResult = await pool.query(
      `SELECT
         data->>'domain' AS domain_name,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND data->>'status' = 'pending') AS pending_requests,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND data->>'status' = 'approved') AS approved_subdomains,
         count(*) FILTER (WHERE entity_type = 'SubdomainRequest' AND created_at >= $2) AS new_requests_7d,
         count(*) FILTER (WHERE entity_type = 'DnsRecord' AND (data->>'managed')::boolean = true) AS dns_records
       FROM entity_records
       WHERE (entity_type IN ('SubdomainRequest', 'DnsRecord'))
         AND data->>'domain' = ANY($1::text[])
       GROUP BY data->>'domain'`,
      [domainNames, weekAgo],
    );

    const statsByDomain = Object.fromEntries(statsResult.rows.map((row) => [row.domain_name, row]));

    const domainStats = domains.map((domain) => {
      const s = statsByDomain[domain.name] || {};
      return {
        id: domain.id,
        name: domain.name,
        status: domain.status,
        allow_new_requests: domain.allow_new_requests,
        record_count: domain.record_count ?? null,
        last_synced: domain.last_synced ?? null,
        provider_assigned_at: domain.provider_assigned_at ?? null,
        stats: {
          pending_requests: parseInt(s.pending_requests || 0, 10),
          approved_subdomains: parseInt(s.approved_subdomains || 0, 10),
          new_requests_7d: parseInt(s.new_requests_7d || 0, 10),
          dns_records: parseInt(s.dns_records || 0, 10),
        },
      };
    });

    // dns_records total uses record_count (synced from Cloudflare) when available,
    // falling back to the entity_records count — matching what the per-domain UI shows.
    const totals = domainStats.reduce(
      (acc, d) => ({
        active_subdomains: acc.active_subdomains + d.stats.approved_subdomains,
        pending_requests: acc.pending_requests + d.stats.pending_requests,
        dns_records: acc.dns_records + (d.record_count ?? d.stats.dns_records),
        new_requests_7d: acc.new_requests_7d + d.stats.new_requests_7d,
      }),
      { active_subdomains: 0, pending_requests: 0, dns_records: 0, new_requests_7d: 0 },
    );

    return { data: { domains: domainStats, totals } };
  });

  /**
   * GET /api/domain-provider/domains
   * Lists domains assigned to the authenticated domain_provider (no stats, fast).
   * Accessible to domain_provider and admin.
   */
  app.get('/api/domain-provider/domains', async (request, reply) => {
    const user = await authenticateRequest(request);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    if (user.role !== 'domain_provider' && user.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const targetUserId = user.role === 'admin' && request.query?.user_id
      ? request.query.user_id
      : user.id;
    const domains = await store.filter('Domain', { provider_user_id: targetUserId });
    // Strip sensitive infra fields for non-admin providers
    const safe = domains.map(({ zone_id: _, nameservers: __, reserved_names: ___, notes: ____, created_by: _____, ...rest }) =>
      user.role === 'admin' ? { zone_id: _, nameservers: __, reserved_names: ___, notes: ____, created_by: _____, ...rest } : rest,
    );
    return { data: safe };
  });
}
