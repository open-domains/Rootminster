import { createPlatformClientFromRequest } from '../lib/platform-client.js';
export default async function (req) {
    try {
        const platform = createPlatformClientFromRequest(req);
        const body = await req.json();
        const domain = body.domain;
        if (!domain) {
            return Response.json({
                error: 'Missing domain parameter',
                description: ['Provide a domain name via ?domain=example.com'],
            }, { status: 400 });
        }
        const cleanDomain = domain.trim().toLowerCase();
        // First try exact match (root domain)
        let domains = await platform.asServiceRole.entities.Domain.filter({ name: cleanDomain });
        let domainRecord = null;
        let rootDomain = cleanDomain;
        let isSubdomain = false;
        if (!domains.length) {
            // Try to extract root domain for subdomain lookups (e.g. "migration.is-cool.dev" → "is-cool.dev")
            const parts = cleanDomain.split('.');
            if (parts.length > 2) {
                // Try increasingly short suffixes
                for (let i = 1; i < parts.length - 1; i++) {
                    const candidate = parts.slice(i).join('.');
                    domains = await platform.asServiceRole.entities.Domain.filter({ name: candidate });
                    if (domains.length) {
                        rootDomain = candidate;
                        isSubdomain = true;
                        break;
                    }
                }
            }
        }
        if (!domains.length) {
            return Response.json({
                error: 'Domain not found',
                description: [`No domain matching "${cleanDomain}" is managed by Open Domains.`],
            }, { status: 404 });
        }
        domainRecord = domains[0];
        // Fetch DNS records for the root domain
        const dnsRecords = await platform.asServiceRole.entities.DnsRecord.filter({
            zone_name: rootDomain,
            status: 'active',
        });
        // If it's a subdomain lookup, find the specific record
        let subdomainRecord = null;
        if (isSubdomain) {
            subdomainRecord = dnsRecords.find(r => r.name === cleanDomain);
        }
        // Build RDAP response
        const nameservers = dnsRecords
            .filter(r => r.record_type === 'NS')
            .map(r => ({
            objectClassName: 'nameserver',
            ldhName: r.content,
        }));
        const rdapResponse = {
            objectClassName: 'domain',
            ldhName: cleanDomain,
            handle: domainRecord.id,
            status: [domainRecord.status === 'active' ? 'active' : 'inactive'],
            nameservers,
            events: [
                {
                    eventAction: 'registration',
                    eventDate: domainRecord.created_date,
                },
                {
                    eventAction: 'last changed',
                    eventDate: domainRecord.updated_date,
                },
                {
                    eventAction: 'last update of RDAP database',
                    eventDate: new Date().toISOString(),
                },
            ],
            entities: [],
            remarks: [
                {
                    title: isSubdomain ? 'Subdomain under Open Domains' : 'Managed by Open Domains',
                    description: [
                        isSubdomain
                            ? `This subdomain is registered under ${rootDomain}, which is managed by Open Domains. It has ${dnsRecords.length} active DNS record(s), including ${dnsRecords.filter(r => r.record_type === 'NS').length} nameserver(s).`
                            : `This domain is managed by Open Domains. It has ${dnsRecords.length} active DNS record(s), including ${dnsRecords.filter(r => r.record_type === 'NS').length} nameserver(s).`,
                        domainRecord.notes || 'No additional notes.',
                    ].filter(Boolean),
                    links: [
                        {
                            value: `https://github.com/open-domains`,
                            rel: 'about',
                            href: `https://github.com/open-domains`,
                            type: 'text/html',
                        },
                    ],
                },
            ],
            links: [
                {
                    value: `https://rdap.open-domains.net/domain/${cleanDomain}`,
                    rel: 'self',
                    href: `https://rdap.open-domains.net/domain/${cleanDomain}`,
                    type: 'application/rdap+json',
                },
            ],
            notices: [
                {
                    title: 'Data Redaction',
                    description: [
                        'Some registration data has been redacted in accordance with our privacy policy.',
                        'Sensitive fields such as contact names, email addresses, and internal identifiers are not published.',
                    ],
                    links: [
                        {
                            value: `https://open-domains.net/PrivacyPolicy`,
                            rel: 'alternate',
                            href: `https://open-domains.net/PrivacyPolicy`,
                            type: 'text/html',
                        },
                    ],
                },
            ],
            port43: 'whois.open-domains.net',
        };
        return Response.json(rdapResponse);
    }
    catch (error) {
        return Response.json({ error: 'Internal server error', description: [error.message] }, { status: 500 });
    }
}
