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
        const cleanDomain = typeof domain === 'string' ? domain.trim().toLowerCase().replace(/\.$/, '') : '';
        const parts = cleanDomain.split('.');
        // Reject anything that is not a plausible hostname before touching the database, so an
        // anonymous caller cannot turn one lookup into hundreds of queries.
        if (!cleanDomain || cleanDomain.length > 253 || parts.length < 2 ||
            parts.some(label => !/^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/.test(label))) {
            return Response.json({
                error: 'Invalid domain',
                description: ['Provide a valid domain name, such as example.com'],
            }, { status: 400 });
        }
        // The exact name and every parent with at least two labels, looked up in one query. The
        // longest match wins, so "migration.is-cool.dev" resolves to "is-cool.dev".
        const candidates = parts.slice(0, -1).map((_, index) => parts.slice(index).join('.'));
        const matches = await platform.asServiceRole.entities.Domain.filter({ name: { $in: candidates } });
        const domains = matches.sort((a, b) => b.name.length - a.name.length);
        let domainRecord = null;
        const rootDomain = domains[0]?.name || cleanDomain;
        const isSubdomain = rootDomain !== cleanDomain;
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
