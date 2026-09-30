# Admin AI Docker interface

Rootminster includes a Docker-only admin command for trusted AI/admin automation. It runs inside the app container and calls Rootminster server modules directly; it does not expose an HTTP endpoint.

## Usage

Run one action:

```bash
docker compose exec -T app node server/admin-ai-cli.js '{
  "tool": "get_review_request",
  "arguments": { "request_id": "00000000-0000-0000-0000-000000000000" }
}'
```

Run a batch:

```bash
cat admin-ai-actions.json | docker compose exec -T app node server/admin-ai-cli.js
```

Example batch payload:

```json
{
  "actions": [
    { "tool": "list_pending_reviews", "arguments": { "limit": 10 } },
    { "tool": "approve_review", "arguments": { "request_id": "00000000-0000-0000-0000-000000000000", "admin_notes": "Reviewed by Admin AI" } },
    { "tool": "update_user", "arguments": { "user_id": "00000000-0000-0000-0000-000000000000", "data": { "status": "suspended" } } }
  ]
}
```

Use `"dry_run": true` to validate and preview destructive actions without calling the review or account mutation handlers.

## Tools

- `list_pending_reviews`: list open review requests. Arguments match the MCP staff tool: `limit`, `offset`, and optional exact `hostname`.
- `get_review_request`: fetch a request by `request_id`, or search by exact `hostname`.
- `approve_review`: approve a pending request and provision DNS records. This changes external DNS.
- `reject_review`: reject a pending request and notify the requester. Requires `rejection_reason`.
- `update_user`: update permitted admin account fields through Rootminster's internal admin user handler. Requires `user_id` and `data`.

The command returns a JSON object with `success` and per-action `results`. A batch continues after individual action failures and exits non-zero if any action failed.

## Actor identity

Audit logs use an internal admin actor by default:

- `ADMIN_AI_ACTOR_ID` default: `admin-ai`
- `ADMIN_AI_ACTOR_EMAIL` default: `admin-ai@open-domains.local`
- `ADMIN_AI_ACTOR_NAME` default: `Admin AI`

Set those environment variables on the `docker compose exec` command if a specific bot identity is needed.

## Safety notes

- This is intentionally Docker-only. Do not route it through Fastify, Traefik, or any public HTTP path.
- The CLI sanitizes sensitive account fields (`password_hash`, `totp_secret`) from responses.
- The underlying request review handlers still perform their existing status checks, locking, DNS provisioning, notifications, and audit logging.
