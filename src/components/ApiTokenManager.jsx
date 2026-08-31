import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Copy, ExternalLink, Key, Loader2, Plus, Terminal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ApiTokenManager({ user }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [tokenName, setTokenName] = useState('My API Token');

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
      const created = await rootminster.apiTokens.create(tokenName);
      setNewToken(created);
      setTokenName('My API Token');
      await load();
    } catch (error) {
      toast.error(error.message || 'Could not create API token');
    } finally {
      setCreating(false);
    }
  };

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
      <div className="rounded-md border border-border bg-background/60 p-3"><p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Terminal size={12} /> Example</p><code className="mt-2 block break-all text-xs text-foreground">curl -H &quot;Authorization: Bearer {newToken.token.slice(0, 14)}…&quot; {window.location.origin}/api/v1/me</code></div>
      <Button size="sm" variant="outline" onClick={() => setNewToken(null)}>I have saved it</Button>
    </div>}

    {!newToken && <div className="rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={tokenName} onChange={(event) => setTokenName(event.target.value)} maxLength={80} placeholder="Token name" className="flex-1" />
        <Button onClick={createToken} disabled={creating || !tokenName.trim()} className="gap-2">{creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create token</Button>
      </div>
    </div>}

    <div className="space-y-2">
      {loading ? <div className="flex justify-center py-6"><Loader2 size={17} className="animate-spin text-muted-foreground" /></div> : tokens.length === 0 ? <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No active API tokens.</p> : tokens.map((token) => <div key={token.id} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background/30 px-4 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{token.name}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{token.token_prefix}••••••••</p><p className="mt-1 text-[11px] text-muted-foreground">{token.last_used ? `Last used ${format(new Date(token.last_used), 'd MMM yyyy, HH:mm')}` : 'Never used'}</p></div>
        <Button size="icon" variant="ghost" onClick={() => revokeToken(token)} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Revoke ${token.name}`}><Trash2 size={14} /></Button>
      </div>)}
    </div>

    <a href="/api-docs" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">View API documentation <ExternalLink size={12} /></a>
  </div>;
}
