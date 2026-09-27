# Sequence Diagrams

## Workflow: User submits a subdomain request

A signed-in user submits one or more DNS records for staff review.

```mermaid
sequenceDiagram
    participant User
    participant React as React page / RequestModal
    participant Client as rootminsterClient
    participant Runner as function-runner.js
    participant Submit as submitRequest.js
    participant Store as store.js
    participant Safety as safety-screening.js
    participant DB as PostgreSQL
    User->>React: submit hostname, records, preview link
    React->>Client: functions.invoke("submitRequest", body)
    Client->>Runner: POST /api/functions/submitRequest
    Runner->>Submit: bound Request with actor
    Submit->>Submit: validate subdomain, records, Turnstile, blocklist
    Submit->>Safety: screenRequest(...)
    Submit->>Store: create SubdomainRequest / SafetyAssessment
    Store->>DB: INSERT entity_records
    Submit-->>Runner: Response JSON
    Runner-->>Client: request result
    Client-->>React: data
```

### Walkthrough

1. Frontend uses `src/api/rootminsterClient.js:rootminster.functions.invoke`.
2. `server/function-runner.js` authenticates and imports `server/functions/submitRequest.js`.
3. `submitRequest` validates and persists request data through the platform client/store.

## Workflow: Staff approves a request

Approval mutates external DNS and local ownership state.

```mermaid
sequenceDiagram
    participant Staff
    participant AdminUI as AdminRequests.jsx
    participant Runner as function-runner.js
    participant Approve as approveRequest.js
    participant Lock as request-bundles.js
    participant Provision as request-approval.js
    participant CF as Cloudflare API
    participant Store as store.js
    participant Mail as SMTP
    participant DB as PostgreSQL
    Staff->>AdminUI: approve request
    AdminUI->>Runner: POST /api/functions/approveRequest
    Runner->>Approve: execute handler as staff/admin
    Approve->>Lock: withRequestLock(hostname)
    Lock->>Approve: lock acquired
    Approve->>Provision: provisionRequestBundle(...)
    Provision->>CF: create DNS records
    Provision->>Store: create/update DnsRecord and ownership
    Store->>DB: persist records/audit data
    Approve->>Mail: send approval email
    Approve->>Store: create AuditLog
    Approve-->>AdminUI: dns_record / dns_records
```

### Walkthrough

1. `approveRequest` requires `admin` or `staff`.
2. Request locking prevents concurrent approval/rejection for the same hostname.
3. Cloudflare is called through `server/lib/cloudflare.js`.
4. Local state and audit records are persisted after provisioning.

## Workflow: Browser creates an API token

A signed-in user creates a scoped token for `/api/v1`.

```mermaid
sequenceDiagram
    participant User
    participant Settings as Settings / ApiTokenManager
    participant Client as rootminsterClient
    participant API as public-api.js
    participant Store as store.js
    participant DB as PostgreSQL
    User->>Settings: choose token name, scopes, restrictions
    Settings->>Client: apiTokens.create(settings)
    Client->>API: POST /api/auth/tokens
    API->>API: validate scopes, hostnames, record types, expiry
    API->>Store: create ApiToken with sha256(raw token)
    Store->>DB: INSERT entity_records
    API-->>Client: raw token once + metadata
    Client-->>Settings: display token
```

### Walkthrough

1. `server/public-api.js:createBrowserToken()` creates `od_...` tokens.
2. Only the hash is stored; the raw token is returned once.
3. DDNS tokens require hostname and A/AAAA restrictions.

## Workflow: Scheduled encrypted R2 backup

The jobs process checks backup schedule every 15 minutes and runs a backup when due.

```mermaid
sequenceDiagram
    participant Jobs as jobs.js
    participant Backup as backup-service.js
    participant DB as PostgreSQL
    participant Dump as pg_dump
    participant Crypto as backup-crypto.js
    participant R2 as Cloudflare R2
    Jobs->>Backup: runScheduledBackup()
    Backup->>DB: advisory lock / read settings / create backup_runs
    Backup->>Dump: pg_dump custom archive
    Backup->>Crypto: encryptBackup + sha256File
    Backup->>R2: list/head/delete as needed for capacity
    Backup->>R2: put encrypted archive
    Backup->>DB: mark completed + audit
    Backup-->>Jobs: completed or skipped
```

### Walkthrough

1. `server/jobs.js` schedules `runScheduledBackup()` every 15 minutes.
2. `server/backup-service.js` enforces R2 limits and retention before upload.
3. Backup artifacts are encrypted before leaving the server.
