import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, BookOpen, Check, ChevronRight, Copy, ExternalLink, KeyRound, Search, ShieldCheck, TimerReset } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const methodTone = {
  GET: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  POST: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  PATCH: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  DELETE: 'border-red-400/30 bg-red-400/10 text-red-300',
};

function CodeBlock({ children, onCopy }) {
  return <div className="group relative overflow-hidden rounded-lg border border-border bg-[#080d16]">
    <pre className="overflow-x-auto p-4 pr-12 text-xs leading-6 text-slate-300"><code>{children}</code></pre>
    <button onClick={() => onCopy(String(children))} className="absolute right-2 top-2 rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-400 opacity-70 transition hover:text-white group-hover:opacity-100" aria-label="Copy example"><Copy size={13} /></button>
  </div>;
}

function Method({ children }) {
  return <span className={`inline-flex w-[58px] justify-center rounded border px-2 py-1 font-mono text-[10px] font-bold ${methodTone[children]}`}>{children}</span>;
}

function Endpoint({ endpoint, baseUrl, token, onCopy }) {
  const example = endpoint.example(baseUrl, token);
  return <section id={endpoint.id} className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
    <div className="border-b border-border p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><Method>{endpoint.method}</Method><code className="break-all text-sm font-semibold text-foreground">{endpoint.path}</code>{endpoint.auth && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"><KeyRound size={10} /> Token</span>}{endpoint.staff && <span className="rounded-full bg-violet-400/10 px-2 py-1 text-[10px] font-medium text-violet-300">Staff</span>}</div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{endpoint.title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{endpoint.description}</p>
    </div>
    <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Parameters</p>
        {endpoint.parameters.length ? <div className="overflow-hidden rounded-lg border border-border">{endpoint.parameters.map((parameter) => <div key={parameter.name} className="grid gap-1 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[130px_90px_minmax(0,1fr)]"><code className="text-xs text-primary">{parameter.name}</code><span className="text-[11px] text-muted-foreground">{parameter.required ? 'required' : 'optional'} · {parameter.type}</span><span className="text-xs text-muted-foreground">{parameter.description}</span></div>)}</div> : <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No parameters.</p>}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground"><TimerReset size={14} className="mt-0.5 shrink-0 text-primary" /><span>Rate limit: <strong className="text-foreground">{endpoint.limit}</strong></span></div>
      </div>
      <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Example request</p><CodeBlock onCopy={onCopy}>{example}</CodeBlock></div>
    </div>
  </section>;
}

function endpoints(exampleDomain) {
  return [
    { id: 'list-domains', group: 'Public', method: 'GET', path: '/api/v1/domains', title: 'List managed domains', description: 'Returns the domains currently configured in Rootminster and whether each accepts new requests.', auth: false, staff: false, limit: '60 requests/minute per IP', parameters: [], example: (base) => `curl ${base}/api/v1/domains` },
    { id: 'availability', group: 'Public', method: 'GET', path: '/api/v1/availability', title: 'Check availability', description: 'Checks formatting, request locks, reserved names, ownership, existing DNS and pending requests.', auth: false, staff: false, limit: '60 requests/minute per IP', parameters: [{ name: 'name', required: true, type: 'string', description: 'Subdomain label without the root domain.' }, { name: 'domain', required: true, type: 'string', description: 'A managed root domain.' }], example: (base) => `curl "${base}/api/v1/availability?name=myproject&domain=${exampleDomain}"` },
    { id: 'rdap', group: 'Public', method: 'GET', path: '/api/v1/rdap/{domain}', title: 'RDAP lookup', description: 'Returns RDAP-compatible registration information for a domain.', auth: false, staff: false, limit: '30 requests/minute per IP', parameters: [{ name: 'domain', required: true, type: 'path', description: 'Fully qualified domain name to look up.' }], example: (base) => `curl ${base}/api/v1/rdap/myproject.${exampleDomain}` },
    { id: 'public-records', group: 'Public', method: 'GET', path: '/api/v1/dns/records', title: 'List public DNS records', description: 'Lists public DNS records belonging to one managed zone.', auth: false, staff: false, limit: '60 requests/minute per IP', parameters: [{ name: 'domain', required: true, type: 'string', description: 'Managed root domain.' }], example: (base) => `curl "${base}/api/v1/dns/records?domain=${exampleDomain}"` },
    { id: 'me', group: 'Account', method: 'GET', path: '/api/v1/me', title: 'Get your account', description: 'Returns the API-token owner, platform role, feature access and account totals.', auth: true, staff: false, limit: '120 requests/minute per token', parameters: [], example: (base, key) => `curl ${base}/api/v1/me \\\n  -H "Authorization: Bearer ${key}"` },
    { id: 'list-requests', group: 'Requests', method: 'GET', path: '/api/v1/requests', title: 'List requests', description: 'Returns your requests using predictable page-based pagination. Staff may use scope=all.', auth: true, staff: false, limit: '120 requests/minute per token', parameters: [{ name: 'page', required: false, type: 'integer', description: 'Page number, starting at 1.' }, { name: 'limit', required: false, type: 'integer', description: 'Items per page, from 1 to 100.' }, { name: 'status', required: false, type: 'string', description: 'Filter by request status.' }, { name: 'scope', required: false, type: 'string', description: 'Staff only: use all to view every user.' }], example: (base, key) => `curl "${base}/api/v1/requests?page=1&limit=25" \\\n  -H "Authorization: Bearer ${key}"` },
    { id: 'get-request', group: 'Requests', method: 'GET', path: '/api/v1/requests/{id}', title: 'Get one request', description: 'Returns a request owned by the token user. Staff and administrators may access any request.', auth: true, staff: false, limit: '120 requests/minute per token', parameters: [{ name: 'id', required: true, type: 'UUID', description: 'Request ID returned during submission.' }], example: (base, key) => `curl ${base}/api/v1/requests/REQUEST_ID \\\n  -H "Authorization: Bearer ${key}"` },
    { id: 'create-request', group: 'Requests', method: 'POST', path: '/api/v1/requests', title: 'Create a subdomain request', description: 'Submits one or more DNS records for staff review. API tokens are already verified, so CAPTCHA is not required.', auth: true, staff: false, limit: '30 requests/minute per token', parameters: [{ name: 'subdomain', required: true, type: 'string', description: 'Requested subdomain label.' }, { name: 'root_domain', required: true, type: 'string', description: 'Managed root domain.' }, { name: 'reason', required: true, type: 'string', description: 'What you are building.' }, { name: 'preview_link', required: true, type: 'URL', description: 'A URL staff can review.' }, { name: 'records', required: true, type: 'array', description: 'DNS records containing record_type, record_value, ttl and proxied.' }], example: (base, key) => `curl -X POST ${base}/api/v1/requests \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "subdomain": "myproject",\n    "root_domain": "${exampleDomain}",\n    "reason": "Personal portfolio",\n    "preview_link": "https://preview.example.com",\n    "records": [{\n      "record_type": "A",\n      "record_value": "203.0.113.10",\n      "ttl": 3600,\n      "proxied": false\n    }]\n  }'` },
    { id: 'update-record', group: 'DNS', method: 'PATCH', path: '/api/v1/dns/records/{id}', title: 'Update an owned record', description: 'Validates ownership and applies the change to Cloudflare and Rootminster.', auth: true, staff: false, limit: '30 requests/minute per token', parameters: [{ name: 'id', required: true, type: 'UUID', description: 'DNS record ID.' }, { name: 'content', required: false, type: 'string', description: 'Replacement DNS content.' }, { name: 'ttl', required: false, type: 'integer', description: 'Replacement TTL.' }, { name: 'proxied', required: false, type: 'boolean', description: 'Cloudflare proxy state where supported.' }], example: (base, key) => `curl -X PATCH ${base}/api/v1/dns/records/RECORD_ID \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"content":"203.0.113.20","ttl":3600}'` },
    { id: 'delete-record', group: 'DNS', method: 'DELETE', path: '/api/v1/dns/records/{id}', title: 'Delete an owned record', description: 'Deletes the record from Cloudflare and Rootminster. Removing the final record suspends the empty subdomain.', auth: true, staff: false, limit: '30 requests/minute per token', parameters: [{ name: 'id', required: true, type: 'UUID', description: 'DNS record ID.' }], example: (base, key) => `curl -X DELETE ${base}/api/v1/dns/records/RECORD_ID \\\n  -H "Authorization: Bearer ${key}"` },
    { id: 'staff-whois', group: 'Staff', method: 'GET', path: '/api/v1/staff/whois', title: 'Ownership lookup', description: 'Returns ownership, DNS and request history. Restricted using the current Rootminster account role.', auth: true, staff: true, limit: '120 requests/minute per token', parameters: [{ name: 'name', required: true, type: 'string', description: 'Subdomain label.' }, { name: 'domain', required: true, type: 'string', description: 'Managed root domain.' }], example: (base, key) => `curl "${base}/api/v1/staff/whois?name=myproject&domain=${exampleDomain}" \\\n  -H "Authorization: Bearer ${key}"` },
    { id: 'device-code', group: 'Device auth', method: 'POST', path: '/api/v1/device/code', title: 'Start device authorization', description: 'Creates a ten-minute code for a CLI or headless device. Direct the user to the returned verification URI.', auth: false, staff: false, limit: '10 requests/15 minutes per IP', parameters: [{ name: 'token_name', required: false, type: 'string', description: 'Friendly integration name.' }], example: (base) => `curl -X POST ${base}/api/v1/device/code \\\n  -H "Content-Type: application/json" \\\n  -d '{"token_name":"My CLI"}'` },
    { id: 'device-token', group: 'Device auth', method: 'POST', path: '/api/v1/device/token', title: 'Poll device authorization', description: 'Poll every few seconds until approved, denied or expired. The API token is shown once.', auth: false, staff: false, limit: '60 requests/minute per IP', parameters: [{ name: 'device_code', required: true, type: 'string', description: 'Device code returned by the start endpoint.' }], example: (base) => `curl -X POST ${base}/api/v1/device/token \\\n  -H "Content-Type: application/json" \\\n  -d '{"device_code":"dvc_..."}'` },
  ];
}

export default function ApiDocs() {
  const [domains, setDomains] = useState([]);
  const [query, setQuery] = useState('');
  const [token, setToken] = useState('od_your_api_token');
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window === 'undefined' ? '' : window.location.origin;

  useEffect(() => { rootminster.entities.Domain.list().then(setDomains).catch(() => {}); }, []);
  const endpointList = useMemo(() => endpoints(domains[0]?.name || 'open-domains.net'), [domains]);
  const filtered = endpointList.filter((item) => `${item.title} ${item.path} ${item.group}`.toLowerCase().includes(query.toLowerCase()));
  const groups = [...new Set(endpointList.map((item) => item.group))];
  const copy = async (value) => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1400); };

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Open Domains</Link>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2"><BookOpen size={16} className="text-primary" /><span className="text-sm font-semibold">API Documentation</span><span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">v1</span></div>
        <div className="ml-auto hidden items-center gap-2 sm:flex"><a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">OpenAPI JSON <ExternalLink size={11} /></a><Button asChild size="sm"><Link to="/settings?section=api">Create token</Link></Button></div>
      </div>
    </header>

    <div className="mx-auto grid max-w-7xl lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border px-5 py-7 lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoints" className="h-9 pl-8 text-xs" /></div>
        <nav className="mt-6 space-y-5">
          <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Guides</p>{[['getting-started', 'Getting started'], ['authentication', 'Authentication'], ['rate-limits', 'Rate limits'], ['errors', 'Errors']].map(([id, label]) => <a key={id} href={`#${id}`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{label}<ChevronRight size={11} /></a>)}</div>
          {groups.map((group) => <div key={group}><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</p>{endpointList.filter((item) => item.group === group).map((item) => <a key={item.id} href={`#${item.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><span className={`font-mono text-[9px] font-bold ${methodTone[item.method].split(' ').at(-1)}`}>{item.method}</span><span className="truncate">{item.title}</span></a>)}</div>)}
        </nav>
      </aside>

      <main className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <section id="getting-started" className="scroll-mt-24 border-b border-border pb-10">
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300"><Activity size={11} /> Versioned and available</span><span className="text-xs text-muted-foreground">Base URL: <code>{baseUrl}/api/v1</code></span></div>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Build with the Rootminster User API</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">Check availability, submit and track requests, inspect account data and manage owned DNS records. Version 1 uses resource-based URLs, JSON envelopes and stable per-token rate limits.</p>
          <div className="mt-6 max-w-3xl"><CodeBlock onCopy={copy}>curl {baseUrl}/api/v1/domains</CodeBlock></div>
          <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-6 text-muted-foreground"><strong className="text-amber-300">Legacy compatibility:</strong> <code>/functions/publicApi?action=…</code> remains available for existing integrations, but new work should use <code>/api/v1</code>.</div>
        </section>

        <section id="authentication" className="scroll-mt-24 border-b border-border py-10">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><div><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck size={17} /></div><h2 className="mt-4 text-xl font-semibold">Authentication</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Create a token under Settings → API Tokens. Tokens are displayed once and stored as SHA-256 hashes. Send one using the Bearer scheme. Permissions follow the current Rootminster user role, so promoting or disabling an account takes effect without issuing a new key.</p><Button asChild variant="outline" size="sm" className="mt-4"><Link to="/settings?section=api">Manage API tokens</Link></Button></div><div><label className="mb-2 block text-xs font-medium text-muted-foreground">Example token used in snippets</label><Input value={token} onChange={(event) => setToken(event.target.value)} className="mb-3 font-mono text-xs" /><CodeBlock onCopy={copy}>Authorization: Bearer {token}</CodeBlock></div></div>
        </section>

        <section id="rate-limits" className="scroll-mt-24 border-b border-border py-10"><h2 className="text-xl font-semibold">Rate limits</h2><p className="mt-2 text-sm text-muted-foreground">Yes—the platform has rate limiting at both the application and API level. Authenticated limits are keyed by a hash of the API token; public limits use the client IP.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[['Global safety limit', '300/min per IP'], ['Public reads', '60/min per IP'], ['Authenticated reads', '120/min per token'], ['Authenticated writes', '30/min per token'], ['RDAP', '30/min per IP'], ['Device-code creation', '10/15 min per IP']].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>)}</div><p className="mt-4 text-xs leading-6 text-muted-foreground">Responses include <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code> and <code>X-RateLimit-Reset</code>. A limited request returns HTTP <code>429</code> and <code>Retry-After</code>.</p></section>

        <section id="errors" className="scroll-mt-24 border-b border-border py-10"><h2 className="text-xl font-semibold">Predictable errors</h2><p className="mt-2 text-sm text-muted-foreground">Version 1 errors always contain a machine-readable code and a human-readable message.</p><div className="mt-5 max-w-xl"><CodeBlock onCopy={copy}>{`{\n  "error": {\n    "code": "invalid_token",\n    "message": "Provide a valid API token using Authorization: Bearer <token>"\n  }\n}`}</CodeBlock></div></section>

        <div className="py-10"><div className="relative mb-7 lg:hidden"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search endpoints" className="pl-9" /></div><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Reference</p><h2 className="mt-1 text-2xl font-semibold">Endpoints</h2><p className="mt-2 text-sm text-muted-foreground">{filtered.length} endpoint{filtered.length === 1 ? '' : 's'} shown</p></div><div className="space-y-5">{filtered.map((endpoint) => <Endpoint key={endpoint.id} endpoint={endpoint} baseUrl={baseUrl} token={token} onCopy={copy} />)}{!filtered.length && <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">No matching endpoints. The API has hidden behind the sofa.</div>}</div></div>
      </main>
    </div>

    {copied && <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-card px-4 py-3 text-sm text-emerald-300 shadow-xl"><Check size={15} /> Copied</div>}
  </div>;
}
