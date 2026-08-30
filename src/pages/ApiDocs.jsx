import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';

const BASE_URL = 'https://api.open-domains.net';
const DEVICE_AUTH_URL = 'https://api.open-domains.net/deviceAuth';

export default function ApiDocs() {
  const [domains, setDomains] = useState([]);
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    rootminster.entities.Domain.list().then((domainData) => {
      const domainList = domainData.map(d => d.name).join(', ');
      const exampleDomain = domainData[0]?.name || 'example.com';
      
      setSpec({
  openapi: '3.0.3',
  info: {
    title: 'Open Domains API',
    version: '1.0.0',
    description: `The Open Domains public API lets you programmatically check subdomain availability, perform RDAP lookups, list DNS records, request new subdomains, and submit edit requests.

**Supported Domains**

This API manages DNS records across the following domains: **${domainList || 'loading...'}**

**Authentication**

Write operations (POST) require a Bearer API token. You can generate one in your [Settings](/Settings) page, or obtain one programmatically using the **Device OAuth flow** described below.

\`\`\`
Authorization: Bearer od_xxxxxxxxxxxxxxxx
\`\`\`

---

## Device OAuth Flow

For CLI tools, scripts, or applications that need to obtain an API token on behalf of a logged-in user, Open Domains supports a Device Authorization flow (similar to OAuth 2.0 Device Flow — RFC 8628).

### Steps

**1. Request a device code**

\`\`\`
POST ${DEVICE_AUTH_URL}
Content-Type: application/json

{ "action": "request_code", "token_name": "My CLI Tool" }
\`\`\`

Returns:
\`\`\`json
{
  "device_code": "...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://open-domains.com/activate",
  "expires_in": 600
}
\`\`\`

**2. Direct the user to the verification URL**

Show the user their \`user_code\` and ask them to visit \`/activate\` (or your app's activation page). They log in and approve the code there.

**3. Poll for the API key**

While the user is approving, poll every ~2 seconds:

\`\`\`
POST ${DEVICE_AUTH_URL}
Content-Type: application/json

{ "action": "poll", "device_code": "<device_code from step 1>" }
\`\`\`

Possible responses:
| \`status\`    | Meaning                                      |
|-------------|----------------------------------------------|
| \`pending\`   | User hasn't approved yet — keep polling      |
| \`approved\`  | Success! \`api_key\` is included in response  |
| \`denied\`    | User denied — stop polling                   |
| \`expired\`   | Code expired (10 min) — restart the flow     |

On \`approved\`, the response includes your API key:
\`\`\`json
{ "status": "approved", "api_key": "od_xxxxxxxxxxxxxxxx" }
\`\`\`

Store this key securely and use it in the \`Authorization: Bearer\` header for all authenticated requests.`,
  },
  servers: [
    { url: BASE_URL, description: 'Public API' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'API token generated from Settings → API Tokens',
      },
    },
    schemas: {
      DnsRecord: {
        type: 'object',
        properties: {
          name:    { type: 'string', example: 'mysite.is-a.dev' },
          type:    { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'], example: 'A' },
          content: { type: 'string', example: '1.2.3.4' },
          ttl:     { type: 'integer', example: 3600 },
          proxied: { type: 'boolean', example: false },
        },
      },
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      DeviceCodeRequest: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['request_code'] },
          token_name: { type: 'string', example: 'My CLI Tool' },
        },
      },
      DeviceCodeResponse: {
        type: 'object',
        properties: {
          device_code: { type: 'string' },
          user_code: { type: 'string' },
          verification_uri: { type: 'string' },
          expires_in: { type: 'integer' },
        },
      },
      PollRequest: {
        type: 'object',
        required: ['action', 'device_code'],
        properties: {
          action: { type: 'string', enum: ['poll'] },
          device_code: { type: 'string' },
        },
      },
      PollResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'denied', 'expired'] },
          api_key: { type: 'string' },
        },
      },
    },
  },
  paths: {
    '/deviceAuth': {
      post: {
        tags: ['Device OAuth'],
        summary: 'Device OAuth Flow',
        description: `Device Authorization flow for CLI/apps to obtain API tokens.

**All device OAuth operations use this single endpoint. Pass different \`action\` values in the request body:**

- \`request_code\` — Generate a device & user code
- \`approve\` — User approves the code (must be logged in at /activate)
- \`deny\` — User denies the code
- \`poll\` — Poll for token status

**Endpoint:** \`${DEVICE_AUTH_URL}\`

**Example — Request a code:**
\`\`\`bash
curl -X POST ${DEVICE_AUTH_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"action":"request_code","token_name":"My CLI"}'
\`\`\`

**Example — Poll for token:**
\`\`\`bash
curl -X POST ${DEVICE_AUTH_URL} \\
  -H "Content-Type: application/json" \\
  -d '{"action":"poll","device_code":"dvc_..."}'
\`\`\``,
        operationId: 'deviceAuth',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  {
                    title: 'Request Code',
                    type: 'object',
                    required: ['action'],
                    properties: {
                      action: { type: 'string', enum: ['request_code'] },
                      token_name: { type: 'string', example: 'My CLI Tool' },
                    },
                  },
                  {
                    title: 'Approve Code',
                    type: 'object',
                    required: ['action', 'user_code'],
                    properties: {
                      action: { type: 'string', enum: ['approve'] },
                      user_code: { type: 'string', example: 'ABCD-1234' },
                    },
                  },
                  {
                    title: 'Deny Code',
                    type: 'object',
                    required: ['action', 'user_code'],
                    properties: {
                      action: { type: 'string', enum: ['deny'] },
                      user_code: { type: 'string', example: 'ABCD-1234' },
                    },
                  },
                  {
                    title: 'Poll',
                    type: 'object',
                    required: ['action', 'device_code'],
                    properties: {
                      action: { type: 'string', enum: ['poll'] },
                      device_code: { type: 'string', example: 'dvc_abc123...' },
                    },
                  },
                ],
              },
              examples: {
                request_code: {
                  summary: 'Request a device code',
                  value: { action: 'request_code', token_name: 'My CLI Tool' },
                },
                approve: {
                  summary: 'Approve a code',
                  value: { action: 'approve', user_code: 'ABCD-1234' },
                },
                deny: {
                  summary: 'Deny a code',
                  value: { action: 'deny', user_code: 'ABCD-1234' },
                },
                poll: {
                  summary: 'Poll for token',
                  value: { action: 'poll', device_code: 'dvc_abc123...' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                examples: {
                  request_code: {
                    summary: 'Code requested',
                    value: {
                      device_code: 'dvc_abc123...',
                      user_code: 'ABCD-1234',
                      verification_uri: 'https://open-domains.com/activate',
                      expires_in: 600,
                    },
                  },
                  approve: {
                    summary: 'Code approved',
                    value: { success: true, message: 'Code approved' },
                  },
                  poll_pending: {
                    summary: 'Poll - still waiting',
                    value: { status: 'pending' },
                  },
                  poll_approved: {
                    summary: 'Poll - approved with token',
                    value: { status: 'approved', api_key: 'od_xxxxxxxxxxxxxxxx' },
                  },
                },
              },
            },
          },
          400: { description: 'Bad request', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          404: { description: 'Not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          410: { description: 'Code expired', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
    '/': {
      get: {
        summary: 'Check availability, whois lookup, or list records',
        description: 'Most actions are public. `action=whois` and `action=me` require a Bearer API token. `action=whois` is further restricted to **staff and admin** accounts only.',
        parameters: [
          {
            name: 'action',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['check', 'whois', 'rdap', 'records', 'me'] },
            description: '`check` — test if a subdomain is available. `whois` — subdomain ownership lookup (staff/admin API key required). `rdap` — ICANN RDAP lookup. `records` — list all DNS records for a domain. `me` — return authenticated user info (requires Bearer token).',
          },
          {
            name: 'domain',
            in: 'query',
            required: false,
            schema: { type: 'string', example: exampleDomain },
            description: 'Domain or subdomain to look up. Required for `rdap` and `records`.',
          },
          {
            name: 'subdomain',
            in: 'query',
            required: false,
            schema: { type: 'string', example: 'mysite' },
            description: 'Required when `action=check`.',
          },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                examples: {
                  available: {
                    summary: 'check — available',
                    value: { status: 'available', message: 'Subdomain is available' },
                  },
                  taken: {
                    summary: 'check — taken',
                    value: { status: 'taken', message: 'Subdomain is already in use' },
                  },
                  pending: {
                    summary: 'check — pending approval',
                    value: { status: 'pending', message: 'Subdomain has a pending request' },
                  },
                  reserved: {
                    summary: 'check — reserved',
                    value: { status: 'reserved', message: 'This subdomain name is reserved' },
                  },
                  rdap: {
                    summary: 'rdap — domain lookup',
                    value: {
                      objectClassName: 'domain',
                      ldhName: 'example.is-a.dev',
                      handle: 'abc123',
                      status: ['active'],
                      nameservers: [{ objectClassName: 'nameserver', ldhName: 'ns1.example.com' }],
                      events: [
                        { eventAction: 'registration', eventDate: '2025-01-01T00:00:00Z' },
                        { eventAction: 'last changed', eventDate: '2025-06-01T00:00:00Z' },
                        { eventAction: 'last update of RDAP database', eventDate: new Date().toISOString() },
                      ],
                      entities: [],
                      remarks: [{ title: 'Managed by Open Domains', description: ['This domain is managed by Open Domains.'] }],
                      links: [{ value: 'https://rdap.open-domains.com/domain/example.is-a.dev', rel: 'self', href: 'https://rdap.open-domains.com/domain/example.is-a.dev', type: 'application/rdap+json' }],
                      notices: [{ title: 'Data Redaction', description: ['Some registration data has been redacted.'] }],
                      port43: 'whois.open-domains.com',
                    },
                  },
                  records: {
                    summary: 'records — list',
                    value: {
                      records: [
                        { name: 'mysite.is-a.dev', type: 'A', content: '1.2.3.4', ttl: 3600, proxied: false },
                      ],
                    },
                  },
                  whois: {
                    summary: 'whois — subdomain ownership info',
                    value: {
                      subdomain: 'mysite.is-a.dev',
                      owner_email: 'user@example.com',
                      owner_id: 'usr_abc123',
                      record_type: 'A',
                      content: '1.2.3.4',
                      ttl: 3600,
                      proxied: false,
                      status: 'active',
                      managed: true,
                      created: '2025-03-01T10:00:00Z',
                      last_synced: '2025-06-15T08:00:00Z',
                      dns_verified: true,
                      request_history: [
                        { id: 'req_abc', status: 'approved', submitted: '2025-03-01T09:00:00Z', reviewed_by: 'admin@example.com', reviewed_at: '2025-03-01T10:00:00Z' },
                      ],
                    },
                  },
                  me: {
                    summary: 'me — authenticated user info',
                    value: {
                      id: 'usr_abc123',
                      email: 'user@example.com',
                      display_name: 'Alex Smith',
                      full_name: 'Alex Smith',
                      role: 'user',
                      ns_unlocked: false,
                      joined: '2025-01-15T10:00:00Z',
                      stats: {
                        active_records: 3,
                        total_records: 4,
                        total_requests: 7,
                        pending_requests: 1,
                        active_api_tokens: 2,
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Bad request', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          401: { description: 'Unauthorized (action=me or action=whois requires a Bearer token)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          403: { description: 'Forbidden (action=whois requires staff or admin role)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          404: { description: 'Domain or subdomain not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
      post: {
        summary: 'Submit a new subdomain request or an edit request',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                submit: {
                  summary: 'Request a new subdomain',
                  value: {
                    action: 'submit',
                    subdomain: 'mysite',
                    root_domain: 'is-a.dev',
                    record_type: 'A',
                    record_value: '1.2.3.4',
                    ttl: 3600,
                    proxied: false,
                    reason: 'Personal project',
                  },
                },
                update: {
                  summary: 'Edit an existing record',
                  value: {
                    action: 'update',
                    dns_record_id: 'abc123',
                    new_content: '5.6.7.8',
                    new_proxied: false,
                    new_ttl: 3600,
                    reason: 'Changed server IP',
                  },
                },
              },
              schema: {
                oneOf: [
                  {
                    title: 'Submit new subdomain',
                    type: 'object',
                    required: ['action', 'subdomain', 'root_domain', 'record_type', 'record_value'],
                    properties: {
                      action:       { type: 'string', enum: ['submit'] },
                      subdomain:    { type: 'string', example: 'mysite', description: 'Subdomain label only (no dot or root domain)' },
                      root_domain:  { type: 'string', example: 'is-a.dev' },
                      record_type:  { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'] },
                      record_value: { type: 'string', example: '1.2.3.4' },
                      ttl:          { type: 'integer', default: 3600 },
                      proxied:      { type: 'boolean', default: false },
                      reason:       { type: 'string', example: 'Personal project' },
                    },
                  },
                  {
                    title: 'Edit existing record',
                    type: 'object',
                    required: ['action', 'dns_record_id'],
                    properties: {
                      action:        { type: 'string', enum: ['update'] },
                      dns_record_id: { type: 'string', description: 'ID of the DnsRecord to update' },
                      new_content:   { type: 'string', example: '5.6.7.8' },
                      new_proxied:   { type: 'boolean' },
                      new_ttl:       { type: 'integer' },
                      reason:        { type: 'string' },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Request submitted — pending admin review',
            content: {
              'application/json': {
                examples: {
                  submit_ok: {
                    summary: 'submit success',
                    value: { success: true, request_id: 'req_xyz', status: 'pending' },
                  },
                  update_ok: {
                    summary: 'update success',
                    value: { success: true, message: '1 edit request(s) submitted for review' },
                  },
                },
              },
            },
          },
          400: { description: 'Bad request / validation error', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          401: { description: 'Missing or invalid API token', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          403: { description: 'Forbidden (e.g. NS records require donation unlock)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          404: { description: 'Domain or record not found', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          409: { description: 'Conflict (record already exists)', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        },
      },
    },
  },
      });
    }).catch(console.error);
  }, []);

  if (!spec) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground text-sm">Loading API docs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SwaggerUI 
          spec={spec} 
          docExpansion="list" 
          defaultModelsExpandDepth={1} 
          tryItOutEnabled={false}
        />
      </div>
    </div>
  );
}