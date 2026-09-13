# Domain health checks

Open a subdomain's DNS manager and select **Run health check**. Results include the check time, an explicit status and a suggested next step. Running a check does not modify DNS, record verification flags, or account state.

## What is checked

- Saved managed records are compared with public DNS answers, including record names, types, values and MX priorities. TXT comparisons preserve case; equivalent IPv6 representations match.
- Proxied records and flattened CNAMEs are checked for address resolution. Their origin values are hidden, so the report does not claim to verify the origin or website uptime.
- Missing or different answers produce a warning with propagation guidance. Resolver errors and timeouts remain inconclusive rather than marking records as broken.
- DNSSEC is assessed from the resolver's authenticated-data flag. When a query returns SERVFAIL, a second query disables validation; a successful response then indicates a **possible** validation problem, not a definitive diagnosis. An unauthenticated answer alone is not treated as a fault.
- Empty namespaces, wildcard records and unsupported types receive explicit guidance instead of a misleading pass.

The check uses Cloudflare 1.1.1.1's [DNS-over-HTTPS JSON API](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/). One resolver cannot establish worldwide propagation. TLS certificates, HTTP uptime and nameserver configuration are not independently probed.

## Operational limits

`checkDomainHealth` accepts `POST { "name": "project.example.com" }` through the existing authenticated function dispatcher. Callers must own the requested namespace or an exact legacy record; staff roles do not bypass this boundary. Results only include records owned by the caller.

Checks use a fixed HTTPS resolver endpoint, five-record batches, at most 50 records, deduplicated questions and a shared 12-second timeout. The report identifies partial coverage. A per-user 30-second cooldown is held in process memory; replicas maintain separate cooldowns and restarts reset them. The existing API rate limiter also applies. No schema migration or new credentials are required.

## Verification

Run `node --test server/domain-health.test.js` for ownership boundaries, invalid input, cooldown behavior, record matching, DNSSEC distinctions, resolver failure and query limits. Browser verification should cover results, errors/retry, switching subdomains during a request, keyboard navigation, long hostnames and mobile horizontal scrolling in both themes.

New health-panel chrome uses the English i18n catalog with existing fallback behavior. Diagnostic text returned by the server is currently English.

## Accessibility and mobile behavior

The DNS manager labels search, filters, record selection, proxy state and edit actions. Validation is connected to the content field; keyboard focus returns to the edit button when editing ends. The record table remains horizontally scrollable by keyboard and touch, with sticky name columns disabled on narrow screens. Controls use larger mobile targets and long hostnames wrap in the surrounding content.

The dashboard navigation drawer traps focus, supports Escape and restores focus to its trigger. Skip links are available in the dashboard and landing page. Reduced-motion preferences suppress movement. Empty toast containers no longer intercept mobile header taps, and status text uses mode-appropriate contrast.
