import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, CheckCircle2, Download, ExternalLink, Loader2, LockKeyhole, PackageCheck, RefreshCw, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const permissionLabels = {
  'dns.read': 'Read DNS records', 'dns.write': 'Create and change DNS records', 'zones.read': 'Read configured zones',
  'requests.read': 'Read domain requests', 'requests.manage': 'Manage domain requests', 'notifications.send': 'Send notifications',
  'safety.assess': 'Create safety assessments', 'http.fetch': 'Contact the configured provider', 'settings.read': 'Read its own settings', 'audit.write': 'Write audit events',
};

function ReviewModal({ review, busy, onClose, onInstall }) {
  if (!review) return null;
  const { item, manifest, digest } = review;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="module-review-title">
      <section className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="border-b border-border p-5"><div className="mb-2 flex items-center gap-2 text-primary"><LockKeyhole size={17} /><span className="text-xs font-semibold uppercase tracking-[.14em]">Permission review</span></div><h2 id="module-review-title" className="text-xl font-semibold">Install {manifest.name}?</h2><p className="mt-1 text-sm text-muted-foreground">Version {manifest.version} by {manifest.publisher}</p></div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-muted-foreground">{manifest.description}</p>
          <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Requested permissions</p><div className="space-y-2">{manifest.permissions.length ? manifest.permissions.map((permission) => <div key={permission} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"><CheckCircle2 size={14} className="text-emerald-400" /><span>{permissionLabels[permission] || permission}</span><code className="ml-auto text-[10px] text-muted-foreground">{permission}</code></div>) : <p className="text-sm text-muted-foreground">No permissions requested.</p>}</div></div>
          <div className="rounded-md border border-border bg-muted/25 p-3 text-xs text-muted-foreground"><p><strong className="text-foreground">Runtime:</strong> reviewed {manifest.runtime} adapter ({manifest.target})</p><p className="mt-1 break-all font-mono text-[10px]">SHA-256 {digest}</p></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={() => onInstall(item, digest)} disabled={busy} className="gap-2">{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Verify and install</Button></div>
        </div>
      </section>
    </div>
  );
}

function ModuleCard({ item, action, onReview, onState, onQuarantine, onRollback, onRemove }) {
  const installed = item.installed;
  const busy = action === item.id;
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">{item.name}</h2><p className="mt-0.5 text-xs text-muted-foreground">v{item.version} · Open Domains</p></div>{installed ? <Badge variant="outline" className={installed.quarantined ? 'border-amber-500/30 text-amber-300' : 'border-emerald-500/30 text-emerald-400'}>{installed.quarantined ? 'Quarantined' : 'Installed'}</Badge> : <Badge variant="secondary">Available</Badge>}</div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.description}</p>
        {installed && <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/25 px-3 py-2.5"><div><p className="text-xs font-medium">Enable module</p><p className="text-[10px] text-muted-foreground">Installed v{installed.version}</p></div><Switch checked={installed.enabled} disabled={busy || installed.quarantined} onCheckedChange={(value) => onState(item, value)} /></div>}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/15 p-4">
        {!installed && <Button onClick={() => onReview(item)} disabled={busy} size="sm" className="gap-2">{busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Review & install</Button>}
        {installed && item.update_available && <Button onClick={() => onReview(item)} disabled={busy} size="sm" className="gap-2"><RefreshCw size={13} /> Review update</Button>}
        {installed && <Button asChild variant="outline" size="sm"><Link to="/admin-modules">Configure <ExternalLink size={12} className="ml-1" /></Link></Button>}
        {installed && <Button variant="outline" size="sm" onClick={() => onQuarantine(item, !installed.quarantined)} disabled={busy} className="gap-1.5"><ShieldAlert size={13} />{installed.quarantined ? 'Clear quarantine' : 'Quarantine'}</Button>}
        {installed?.rollback_available && <Button variant="outline" size="sm" onClick={() => onRollback(item)} disabled={busy} className="gap-1.5"><RotateCcw size={13} />Rollback</Button>}
        {installed && <Button variant="ghost" size="sm" onClick={() => onRemove(item)} disabled={busy} className="ml-auto gap-1.5 text-destructive hover:text-destructive"><Trash2 size={13} />Remove</Button>}
      </div>
    </section>
  );
}

export default function AdminModuleStore() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const [review, setReview] = useState(null);
  const load = async () => { try { setError(''); setData(await rootminster.moduleStore.list()); } catch (err) { setError(err.message || 'Could not load module registry'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const run = async (id, work, success) => { setAction(id); try { await work(); toast.success(success); setReview(null); await load(); } catch (err) { toast.error(err.message || 'Module action failed'); } finally { setAction(''); } };
  const reviewModule = async (item) => { setAction(item.id); try { const result = await rootminster.moduleStore.manifest(item.id); setReview({ item, manifest: result.manifest, digest: result.manifest_sha256 }); } catch (err) { toast.error(err.message || 'Manifest verification failed'); } finally { setAction(''); } };
  const install = (item, digest) => run(item.id, () => rootminster.moduleStore.install(item.id, digest), `${item.name} installed`);
  const state = (item, enabled) => run(item.id, () => rootminster.moduleStore.setState(item.id, enabled), `${item.name} ${enabled ? 'enabled' : 'disabled'}`);
  const quarantine = (item, value) => run(item.id, () => rootminster.moduleStore.quarantine(item.id, value), `${item.name} quarantine ${value ? 'applied' : 'cleared'}`);
  const rollback = (item) => run(item.id, () => rootminster.moduleStore.rollback(item.id), `${item.name} rolled back and disabled`);
  const remove = (item) => { if (window.confirm(`Remove ${item.name}? Its encrypted adapter settings will be kept.`)) run(item.id, () => rootminster.moduleStore.remove(item.id), `${item.name} removed`); };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-primary"><Boxes size={18} /><span className="text-xs font-semibold uppercase tracking-[.14em]">Curated extensions</span></div><h1 className="text-2xl font-semibold tracking-tight">Module Store</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Install integrity-verified modules from the official GitHub registry. Registry content cannot execute arbitrary JavaScript in Rootminster.</p></div><Button variant="outline" onClick={load} className="gap-2"><RefreshCw size={14} />Refresh registry</Button></header>
      {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5"><p className="font-medium text-destructive">Registry unavailable</p><p className="mt-1 text-sm text-muted-foreground">{error}</p><Button variant="outline" size="sm" onClick={load} className="mt-4">Try again</Button></div> : <><div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/25 p-4 text-xs text-muted-foreground"><PackageCheck size={17} className="text-emerald-400" /><span><strong className="text-foreground">{data?.registry?.name}</strong> · {data?.modules?.length || 0} modules</span><code className="ml-auto hidden max-w-md truncate text-[10px] lg:block">{data?.registry?.sha256}</code></div><div className="grid gap-4 md:grid-cols-2">{data?.modules?.map((item) => <ModuleCard key={item.id} item={item} action={action} onReview={reviewModule} onState={state} onQuarantine={quarantine} onRollback={rollback} onRemove={remove} />)}</div></>}
      <ReviewModal review={review} busy={Boolean(action)} onClose={() => setReview(null)} onInstall={install} />
    </div>
  );
}
