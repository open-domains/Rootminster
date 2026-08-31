import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Link2, Loader2, MessageCircle, Unlink } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function DiscordLink() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  const load = () => rootminster.discord.status().then(setStatus).catch((err) => setError(err.message));
  useEffect(() => { if (isAuthenticated) load(); }, [isAuthenticated]);

  const link = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await rootminster.discord.link(token);
      setComplete(true);
      setStatus((current) => ({ ...current, linked: true, account: { discord_username: result.username } }));
    } catch (err) {
      setError(err.message || 'Could not link Discord');
    } finally {
      setLoading(false);
    }
  };

  const unlink = async () => {
    setLoading(true);
    setError('');
    try {
      await rootminster.discord.unlink();
      setStatus((current) => ({ ...current, linked: false, account: null }));
      setComplete(false);
    } catch (err) {
      setError(err.message || 'Could not unlink Discord');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth) return <div className="fixed inset-0 grid place-items-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;

  if (!isAuthenticated) return <div className="fixed inset-0 grid place-items-center bg-background px-4"><div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center"><MessageCircle className="mx-auto text-indigo-400" /><h1 className="mt-4 text-xl font-semibold">Sign in to link Discord</h1><p className="mt-2 text-sm text-muted-foreground">The Discord link will wait here while you sign in. Very patient. Suspiciously patient.</p><Button asChild className="mt-5 w-full"><Link to={`/login?return_to=${encodeURIComponent(location.pathname + location.search)}`}>Continue to sign in</Link></Button></div></div>;

  return <div className="mx-auto max-w-xl px-4 py-8">
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400"><MessageCircle size={21} /></div>
      <h1 className="mt-4 text-xl font-semibold">Discord account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Link Discord to the account you are currently signed into. Your Rootminster role—not a Discord role—controls which commands you can use.</p>

      {!status ? <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" /> Checking Discord integration…</div> : <div className="mt-6 space-y-4">
        {!status.enabled && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-300">The Discord bot is not enabled on this installation.</div>}
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {(complete || (status.linked && !token)) && <div className="flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4"><CheckCircle2 size={18} className="mt-0.5 text-emerald-400" /><div><p className="text-sm font-medium text-emerald-300">Discord connected</p><p className="mt-0.5 text-xs text-muted-foreground">{status.account?.discord_username || 'Your Discord user'} can now use Rootminster commands.</p></div></div>}
        {token && !complete && <Button onClick={link} disabled={loading || !status.enabled} className="w-full gap-2">{loading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Link this Discord user</Button>}
        {!token && !status.linked && <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Run <code>/link</code> in Discord to receive a private, single-use link.</p>}
        {status.linked && <Button onClick={unlink} disabled={loading} variant="outline" className="w-full gap-2"><Unlink size={15} /> Disconnect Discord</Button>}
      </div>}
    </div>
  </div>;
}
