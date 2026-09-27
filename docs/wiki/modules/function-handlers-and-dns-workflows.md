# Module: Function Handlers and DNS Workflows

Business commands live in `server/functions/*.js` and are executed by `server/function-runner.js`. DNS and request handling are the most important flows.

## Responsibilities

- Validate and submit subdomain requests.
- Score requests through deterministic safety screening and optional providers.
- Review, approve, reject, appeal, comment on, and bundle requests.
- Provision approved records in Cloudflare DNS and persist `DnsRecord`/`SubdomainOwnership` records.
- Let users manage owned DNS namespaces after approval.
- Verify DNS records, sync Cloudflare state, and repair missing records.
- Emit audits, emails, Discord notifications, and safety assessments.

## Key Files

- `server/function-runner.js` — function allow-list, HTTP/internal execution, production error masking.
- `server/functions/submitRequest.js` — request validation, Turnstile, donation-gated NS checks, blocklists, safety screen, request creation.
- `server/functions/approveRequest.js` — staff approval, Cloudflare provisioning, audits, email/Discord notifications.
- `server/functions/rejectRequest.js` — staff rejection flow.
- `server/functions/manageDnsRecord.js` — post-approval DNS management by owner/staff/admin.
- `server/functions/verifyDnsRecords.js` — public DNS verification against saved records.
- `server/functions/scheduledSync.js` and `syncCloudflare.js` — Cloudflare synchronization.
- `server/lib/request-approval.js` — provisioning logic for bundled requests.
- `server/lib/request-bundles.js` — grouped request/comment handling and locks.
- `server/lib/subdomain-ownership.js` — ownership namespace calculations.
- `server/lib/request-policy.js` — platform request lock/reserved-name policy.
- `server/lib/safety-screening.js` — risk scoring.
- `server/lib/cloudflare.js` — Cloudflare API wrapper.

## Request Submission

`submitRequest` accepts legacy single-record fields or a `records` array. It validates subdomain format, record compatibility, record values, preview link, Turnstile, private IPs, blocklists, reserved names, active duplicate/conflicting requests, request policy locks, and optional NS donation requirements before creating records and safety assessments.

## Approval and DNS Provisioning

`approveRequest` requires staff/admin, locks by hostname, reloads the request, calls `provisionRequestBundle()`, sends approval email, writes an `AuditLog`, optionally notifies Discord, and returns created DNS records. Provisioning uses Cloudflare through `cloudflareFetch()` and stores local records.

## Direct DNS Management

`manageDnsRecord` validates hostname, value, type, CNAME flattening, blocklists, conflict rules, donation-gated NS records, and ownership namespaces. Staff/admin can manage broadly; normal users must own the hostname namespace.

## Dependencies

- **Uses:** platform client, store/entities, Cloudflare module, module settings, shared request helpers, Discord/email integrations.
- **Used by:** frontend function calls, public API adapters, MCP staff tools, and jobs.

## Gotchas

- `FUNCTION_NAMES` is the source of truth for importable handlers; unknown names are rejected.
- Not every function is HTTP-exposed; some are internal-only.
- Cloudflare configuration is module-based and can come from encrypted settings or environment fallback.
- DNS ownership is not just current UI state; scheduled cleanup and ownership sync repair it over time.
