# Security review patch batch 1

Base revision: `ef505d9fa33bc80c7e431eb176ae2bce35d40e9d`.

## Changes

| Finding | Result | Limits |
| --- | --- | --- |
| R01 - DNS namespace escalation | Deleting a DNS record no longer passes a client-supplied `base_name` into ownership resolution. The existing server-side boundary determines which namespace becomes suspended. Both HTTP aliases reject the subsequent cross-namespace creation in the reported attack sequence. | This closes the reported delete-path escalation. Existing root/ancestor grants are not audited or repaired, and exclusive ownership enforcement across all writers is not implemented in this batch. R04 remains open. |
| R02 - Legacy API token bypass | Legacy API actions share the current API's identity and scope checks. Expired/revoked tokens, missing or inactive owners, insufficient scopes and prohibited DNS targets are denied. Staff WHOIS requires both staff/admin role and `staff:read`. Request submissions enforce token hostname/type restrictions, including all records in a bundle, in both legacy and v1 routes. | Deliberately preserves the current API's normal-user compatibility policy for old unscoped tokens; those tokens do not acquire staff scopes. Public unauthenticated DNS lookup endpoints retain their existing behaviour. |
| R03 - Passkey MFA enrollment bypass | TOTP setup and enrollment require verified MFA when a passkey or TOTP factor already exists. A password-only pending session cannot enroll a chosen TOTP seed to satisfy a passkey challenge. | Initial enrollment remains available when no factor exists, including staff/admin bootstrap. Verified sessions can add TOTP; pending sessions can still verify their existing TOTP. |

## Validation

- 85 new behavioural tests exercise Fastify routes and real authentication/handler code with mocked persistence and Cloudflare HTTP. They cover `/functions`, `/api/functions`, and corresponding v1 API behaviour.
- Negative API cases independently cover expiry, malformed expiry, revocation, inactive users, missing owners, scope, hostname and record-type restrictions. Positive cases cover scoped and legacy tokens.
- DNS tests attempt parent/ancestor/sibling `base_name` values, then attempt creation on another user's occupied hostname. The only provider call before rejection is the authorized deletion. Valid creation beneath the retained namespace still succeeds.
- MFA tests cover user/staff/admin pending-passkey rejection, initial enrollment, verified-passkey enrollment and existing TOTP verification.
- Complete suite: `node --test server/*.test.js server/lib/*.test.js tests/*.test.js` - **220 passed, 0 failed**.
- Changed production JavaScript passes `node --check`; `git diff --check` passes.
- Existing bundle-validation test now explicitly supplies an active account, so it continues testing bundle validation after the new authentication gate.

## Deployment and follow-up

No database migration or configuration change is required. No production requests, database changes, push or deployment were performed.

Clients using expired, revoked, inactive-account or inadequately scoped credentials on the legacy API will now receive 401/403 responses. Legacy staff WHOIS callers need an explicitly authorized staff token.

Next priority: R04's ownership expiry/reassignment lifecycle, exclusive namespace checks and a read-only audit of existing conflicting/root-level grants. Do not treat this batch as a complete remediation of all DNS ownership risks or the remaining review findings. Production verification against real PostgreSQL, sessions and provider configuration remains outstanding.
