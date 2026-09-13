# Subdomain requests and conversations

New submissions store up to 20 DNS records in one `SubdomainRequest.records` array, with one request ID, status, conversation, safety assessment, and approval/rejection action. Legacy single-record input remains supported, including the legacy public API (a preview link is required); the response includes `request` and a one-item `requests` array. Top-level record fields describe the first record for compatibility; consumers should use `records` for the complete set.

## Compatibility

A CNAME must be the only record at a hostname. A and AAAA can coexist, along with compatible MX/TXT records. NS delegation may contain multiple NS records but cannot mix with other types under platform policy. Duplicate records are rejected. Validation runs on submission and again before approval against current Cloudflare records.

An unresolved request (`pending`, `needs_info`, or `user_responded`) reserves the hostname. Additional submissions must wait until that request is resolved. Appeals apply the same checks.

## Existing split requests

Open legacy rows for the same account and hostname appear as one request. Their conversations are merged chronologically, including replies saved against a sibling ID. Internal notes remain staff-only. Replies update every open row to `user_responded`; staff questions update them to `needs_info`, independently of email preferences.

When a legacy group changes, its rows receive a shared `request_group_id`, preserving the relationship after closure. Existing rows and comments are retained; no destructive migration is required. Previously closed, ungrouped requests remain separate historical submissions.

Conflicting legacy requests cannot be approved. Staff can read the complete conversation, reject the request with an explanation, and ask the owner to submit compatible records.

Approval checkpoints each Cloudflare record. If a later write fails, retry the same request to resume. Do not reject a partially provisioned request; resolve the interrupted approval first.

## Finding requests through MCP

`list_pending_reviews` includes all three unresolved statuses. `list_my_requests` is restricted to the connected account. Both accept `hostname`, `limit` (1–100), and `offset`.

For an exact staff lookup across all statuses:

```json
{"hostname":"askfowzan.localplayer.dev"}
```

Pass this to `get_review_request`, or pass a `request_id` to retrieve one complete bundle and conversation. Hostname searches can return multiple historical requests. Follow `next_offset` until it is `null`; pagination counts stored rows, so legacy bundles may repeat across pages—deduplicate by request ID.

Deploy the API and frontend together. If Claude retains the old tool definitions, reconnect the Rootminster MCP connection. Staff tools require a staff/admin account; ordinary accounts can search their own requests.
