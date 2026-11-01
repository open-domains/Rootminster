# Instant approval

Instant approval lets low-risk subdomain requests go live seconds after they're submitted, instead of waiting in the staff queue. It is **off by default**. Turn it on under **Admin → Module Settings → Instant approval**.

## How a request is decided

When a request is submitted, Rootminster already asks Observer to scan the preview link. With instant approval enabled, the request is approved straight away only if **all** of these hold:

- The Observer module is enabled, the scan completed, and it found nothing.
- Every record type is in the allow-list (default `A, AAAA, CNAME, TXT`; NS and MX stay manual because Observer cannot see what they serve).
- The account and request risk rules (protected brands, suspicious wording, preview URL checks, request velocity, prior rejections, shared DNS targets) score as `clear`, with no high or critical signal.
- The account is at least the minimum age (default 1 day).
- The account has never had an instant approval pulled back.
- Neither the per-account daily limit (default 1) nor the platform-wide daily limit (default 50) has been reached.

Anything else goes to the staff queue exactly as before. The approval uses the same provisioning, email and Discord notice as a staff approval, with **Instant approval** as the reviewer.

## Monitoring after approval

The preview can differ from what the DNS record serves, and content can change later. So the job runner re-scans each instantly approved hostname with Observer: first after **First re-scan after approval** (default 30 minutes), then daily for the **Monitoring period** (default 14 days).

If a re-scan finds issues at or above **Pull back to review at Observer severity** (default critical only), Rootminster:

1. Deletes the hostname's DNS records from Cloudflare (taking the site offline).
2. Returns the request to the pending queue with its records intact, so staff can approve it again.
3. Emails the requester that it's under review, posts a Discord alert, and writes an audit log entry containing the removed records.

Lower-severity findings are stored as normal Observer findings and leave the site live.

## Staff controls

- The **Instant approval** panel in the request review dialog shows each decision and its reasons. Requesters never see these.
- On a live instant approval, staff can **Pull back to review** with a reason. This does the same as an automatic pull-back.
- Every decision is in the audit log: `instant_approval_granted`, `instant_approval_declined`, `instant_approval_failed`, `instant_approval_revoked` and `instant_approval_revoke_failed`.

Turning the module off stops new instant approvals. Hostnames already approved keep being monitored until their monitoring period ends.
