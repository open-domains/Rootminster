import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Copy, ExternalLink, Key, Loader2, Plus, Radio, ShieldCheck, Terminal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const SCOPE_OPTIONS = [
  ['account:read', 'Read account'], ['requests:read', 'Read requests'], ['requests:write', 'Submit requests'],
  ['dns:read', 'Read DNS'], ['dns:write', 'Manage DNS'], ['dns:dynamic', 'Dynamic DNS updates'],
];
const PRESETS = {
  full: ['account:read', 'requests:read', 'requests:write', 'dns:read', 'dns:write'],
  read: ['account:read', 'requests:read', 'dns:read'],
  dynamic: ['dns:read', 'dns:dynamic'],
};

export default function ApiTokenManager({ user }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [tokenName, setTokenName] = useState('My API Token');
  const [preset, setPreset] = useState('full');
  const [scopes, setScopes] = useState(PRESETS.full);
  const [hostnames, setHostnames] = useState('');
  const [recordTypes, setRecordTypes] = useState([]);
  const [expiresDays, setExpiresDays] = useState('90');

  const load = async () => {
    setLoading(true);
    try {
      setTokens(await rootminster.apiTokens.list());
    } catch (error) {
      toast.error(error.message || 'Could not load API tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const createToken = async () => {
    setCreating(true);
    try {
      const allowedHostnames = hostnames.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
      const created = await rootminster.apiTokens.create({ name: tokenName, scopes, allowed_hostnames: allowedHostnames, allowed_record_types: recordTypes, expires_in_days: Number(expiresDays) });
      setNewToken(created);
      setTokenName('My API Token');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not create API token');
    } finally {
      setCreating(false);
    }
  };

  const selectPreset = (value) => {
    setPreset(value);
    if (value !== 'custom') setScopes(PRESETS[value]);
    if (value === 'dynamic') setRecordTypes(['A', 'AAAA']);
    else if (value !== 'custom') setRecordTypes([]);
  };

  const toggleScope = (scope) => setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  const toggleRecordType = (type) => setRecordTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);

  const revokeToken = async (token) => {
    try {
      await rootminster.apiTokens.revoke(token.id);
      toast.success('API token revoked');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not revoke API token');
    }
  };

  const copy = async (value) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return <div className="space-y-5">
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Key size={15} /> API tokens</h2>
      <p className="mt-1 text-xs text-muted-foreground">Create tokens for scripts, integrations and the versioned user API. You can have up to ten active tokens.</p>
    </div>

    {newToken && <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div><p className="text-sm font-semibold text-emerald-300">Copy this token now</p><p className="mt-0.5 text-xs text-muted-foreground">It is stored as a hash and cannot be shown again.</p></div>
      <div className="flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-md bg-background px-3 py-2 text-xs text-emerald-300">{newToken.token}</code><Button size="icon" variant="outline" onClick={() => copy(newToken.token)} aria-label="Copy API token"><Copy size={14} /></Button></div>
      <div className="rounded-md border border-border bg-background/60 p-3"><p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Terminal size={12} /> Example</p><code className="mt-2 block break-all text-xs text-foreground">{newToken.scopes?.includes('dns:dynamic') ? `curl -X POST -H "Authorization: Bearer ${newToken.token}" -H "Content-Type: application/json" -d '{"hostname":"${newToken.allowed_hostnames?.[0] || 'host.example.com'}","use_request_ip":true}' ${window.location.origin}/api/v1/dynamic-dns` : `curl -H "Authorization: Bearer ${newToken.token}" ${window.location.origin}/api/v1/me`}</code></div>
      <Button size="sm" variant="outline" onClick={() => setNewToken(null)}>I have saved it</Button>
    </div>}

    {!newToken && <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">{[['full', 'Full API', ShieldCheck], ['read', 'Read only', Key], ['dynamic', 'Dynamic DNS', Radio]].map(([value, label, Icon]) => <button key={value} type="button" onClick={() => selectPreset(value)} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-xs transition-colors ${preset === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}><Icon size={15} /><span className="font-medium">{label}</span></button>)}</div>
        <button type="button" onClick={() => selectPreset('custom')} className="text-xs font-medium text-primary hover:underline">Custom permissions</button>
        {preset === 'custom' && <div className="grid gap-2 rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-2">{SCOPE_OPTIONS.map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 text-xs text-foreground"><Checkbox checked={scopes.includes(value)} onCheckedChange={() => toggleScope(value)} />{label}<code className="ml-auto text-[9px] text-muted-foreground">{value}</code></label>)}</div>}
        {(preset === 'dynamic' || preset === 'custom') && <div className="space-y-2"><label className="text-xs font-medium text-foreground">Allowed hostnames {scopes.includes('dns:dynamic') && '*'}</label><Input value={hostnames} onChange={(event) => setHostnames(event.target.value)} placeholder="home.example.com, vpn.example.com" className="font-mono text-xs" /><p className="text-[11px] text-muted-foreground">Exact hostnames only. You must already own them.</p></div>}
        {(preset === 'dynamic' || (preset === 'custom' && (scopes.includes('dns:write') || scopes.includes('dns:dynamic')))) && <div><p className="mb-2 text-xs font-medium text-foreground">Allowed record types</p><div className="flex flex-wrap gap-3">{(preset === 'dynamic' ? ['A', 'AAAA'] : ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']).map((type) => <label key={type} className="flex cursor-pointer items-center gap-1.5 text-xs"><Checkbox checked={recordTypes.includes(type)} onCheckedChange={() => toggleRecordType(type)} />{type}</label>)}</div></div>}
        <div className="grid gap-2 sm:grid-cols-[1fr_130px_auto]"><Input value={tokenName} onChange={(event) => setTokenName(event.target.value)} maxLength={80} placeholder="Token name" /><Input type="number" min="1" max="365" value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} aria-label="Token lifetime in days" /><Button onClick={createToken} disabled={creating || !tokenName.trim() || !scopes.length || (scopes.includes('dns:dynamic') && !hostnames.trim())} className="gap-2">{creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create token</Button></div>
        <p className="text-[11px] text-muted-foreground">Token lifetime in days: 1–365. Dynamic DNS tokens require a hostname restriction.</p>
      </div>
    </div>}

    <div className="space-y-2">
      {loading ? <div className="flex justify-center py-6"><Loader2 size={17} className="animate-spin text-muted-foreground" /></div> : tokens.length === 0 ? <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No active API tokens.</p> : tokens.map((token) => <div key={token.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/30 px-4 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{token.name}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{token.token_prefix}••••••••</p><div className="mt-1 flex flex-wrap gap-1">{token.scopes.map((scope) => <span key={scope} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{scope}</span>)}</div>{token.allowed_hostnames?.length > 0 && <p className="mt-1 truncate font-mono text-[10px] text-primary">{token.allowed_hostnames.join(', ')}</p>}<p className="mt-1 text-[11px] text-muted-foreground">{token.last_used ? `Last used ${format(new Date(token.last_used), 'd MMM yyyy, HH:mm')}` : 'Never used'} · Expires {token.expires_at ? format(new Date(token.expires_at), 'd MMM yyyy') : 'never'}</p></div>
        <Button size="icon" variant="ghost" onClick={() => revokeToken(token)} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Revoke ${token.name}`}><Trash2 size={14} /></Button>
      </div>)}
    </div>

    <a href="/api-docs" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">View API documentation <ExternalLink size={12} /></a>
  </div>;
}
