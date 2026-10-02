import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';

export default function AdminObserverFindings() {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try { setFindings((await rootminster.observer.findings()).findings || []); }
    catch (err) { setError(err.message || 'Could not load Observer findings'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading) return <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-muted-foreground"><Loader2 className="animate-spin text-primary" />Loading Observer findings…</div>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 text-foreground sm:p-6 md:p-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-semibold tracking-tight">Observer findings</h1><p className="mt-2 text-sm text-muted-foreground">Policy flags reported by Observer. Screenshot links open the Cloudflare Access-protected Observer evidence page, not direct image files.</p></div><Button variant="outline" onClick={load} className="gap-2"><RefreshCw size={15} />Refresh</Button></header>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="p-3">Host</th><th className="p-3">Severity</th><th className="p-3">Score</th><th className="p-3">Policy</th><th className="p-3">Evidence</th><th className="p-3">Screenshot</th></tr></thead><tbody>
        {findings.map((finding) => <tr key={finding.id} className="border-t border-border align-top"><td className="p-3 font-mono text-xs">{finding.hostname}</td><td className="p-3"><span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{finding.severity}</span></td><td className="p-3 tabular-nums">{finding.score}</td><td className="p-3">{finding.policy_section || finding.finding_type}</td><td className="p-3 text-muted-foreground">{finding.evidence}</td><td className="p-3">{finding.screenshot_url ? <a className="inline-flex items-center gap-1 text-primary underline" href={finding.screenshot_url} target="_blank" rel="noreferrer">Open evidence<ExternalLink size={13} /></a> : <span className="text-muted-foreground">Not captured</span>}</td></tr>)}
        {!findings.length && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground"><ShieldAlert className="mx-auto mb-3" />No Observer findings yet.</td></tr>}
      </tbody></table>
    </div>
  </div>;
}
