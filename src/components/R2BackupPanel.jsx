import { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, Download, HardDrive, Loader2, Play, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function bytes(value) {
  const size = Number(value) || 0;
  if (size < 1000) return `${size} B`;
  if (size < 1_000_000) return `${(size / 1000).toFixed(1)} KB`;
  if (size < 1_000_000_000) return `${(size / 1_000_000).toFixed(1)} MB`;
  return `${(size / 1_000_000_000).toFixed(2)} GB`;
}

function date(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function UsageBar({ label, used = 0, limit = 1, formatter = (value) => Number(value).toLocaleString() }) {
  const percentage = Math.min(100, (Number(used) / Math.max(Number(limit), 1)) * 100);
  return <div className="space-y-1.5"><div className="flex justify-between gap-3 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{formatter(used)} / {formatter(limit)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${percentage >= 90 ? 'bg-red-500' : percentage >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${percentage}%` }} /></div></div>;
}

export default function R2BackupPanel({ moduleEnabled }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const load = async () => {
    try { setStatus(await rootminster.backups.status()); }
    catch (error) { toast.error(error.message || 'Could not load backup status'); }
  };
  useEffect(() => { load(); }, []);

  const action = async (name, operation, success) => {
    setBusy(name);
    try { await operation(); toast.success(success); await load(); }
    catch (error) { toast.error(error?.response?.data?.error || error.message || 'Backup operation failed'); }
    finally { setBusy(''); }
  };

  const restore = async () => {
    if (!restoreTarget || confirmation !== 'RESTORE' || !/^\d{6}$/.test(totpCode)) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setBusy(`restore:${target.id}`);
    try {
      await rootminster.backups.restore(target.id, confirmation, totpCode);
      toast.success('Database restored. Sign in again to continue.');
      window.location.assign('/login');
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Restore failed');
      setBusy('');
    } finally { setConfirmation(''); setTotpCode(''); }
  };

  const ready = moduleEnabled && status?.configured && status?.encryption_configured;
  const backups = status?.backups || [];
  const limits = status?.limits || {};

  return (
    <div className="mt-5 space-y-4 border-t border-border pt-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/25 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Cloud size={14} /> Cloudflare R2</div><p className={`mt-2 text-sm font-semibold ${status?.configured ? 'text-emerald-400' : 'text-amber-300'}`}>{status?.configured ? 'Configured' : 'Credentials required'}</p></div>
        <div className="rounded-lg border border-border bg-muted/25 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} /> Encryption</div><p className={`mt-2 text-sm font-semibold ${status?.encryption_configured ? 'text-emerald-400' : 'text-amber-300'}`}>{status?.encryption_configured ? 'Ready' : 'Key required'}</p></div>
        <div className="rounded-lg border border-border bg-muted/25 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><HardDrive size={14} /> Stored backups</div><p className="mt-2 text-sm font-semibold text-foreground">{backups.filter((backup) => backup.status === 'completed' && !backup.deleted_at).length} · {bytes(status?.storage_used_bytes)}</p></div>
      </div>

      {!status?.encryption_configured && <div className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200"><TriangleAlert size={16} className="mt-0.5 shrink-0" /><span>Set <code>BACKUP_ENCRYPTION_KEY</code>, or preserve your existing <code>MODULE_ENCRYPTION_KEY</code>. The same key is required for disaster recovery.</span></div>}
      {status?.connection_error && <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs leading-5 text-red-300"><TriangleAlert size={16} className="mt-0.5 shrink-0" /><span>{status.connection_error}</span></div>}

      <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-3">
        <UsageBar label="Standard storage safety budget" used={status?.storage_used_bytes} limit={limits.storage_bytes} formatter={bytes} />
        <UsageBar label={`Class A operations · ${limits.month || ''}`} used={limits.class_a_used} limit={limits.class_a_monthly} />
        <UsageBar label={`Class B operations · ${limits.month || ''}`} used={limits.class_b_used} limit={limits.class_b_monthly} />
        <p className="text-[10px] leading-4 text-muted-foreground md:col-span-3">{limits.note}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => action('test', rootminster.backups.testR2, 'Cloudflare R2 connection successful')} disabled={!moduleEnabled || !status?.configured || Boolean(busy)} className="gap-2">{busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />} Test R2 connection</Button>
        <Button type="button" onClick={() => action('create', rootminster.backups.create, 'Encrypted backup uploaded to Cloudflare R2')} disabled={!ready || Boolean(busy)} className="gap-2">{busy === 'create' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Back up now</Button>
        <Button type="button" variant="ghost" onClick={load} disabled={Boolean(busy)} className="gap-2"><RefreshCw size={14} /> Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-muted/30 px-4 py-3"><h3 className="text-sm font-semibold text-foreground">Backup history</h3><p className="mt-0.5 text-xs text-muted-foreground">Archives are encrypted before they leave Rootminster.</p></div>
        {!backups.length ? <div className="px-4 py-8 text-center text-xs text-muted-foreground">No backups have been created yet.</div> : <div className="divide-y divide-border">
          {backups.map((backup) => <div key={backup.id} className={`grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center ${backup.deleted_at ? 'opacity-50' : ''}`}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-medium text-foreground">{backup.file_name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${backup.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : backup.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-300'}`}>{backup.deleted_at ? 'deleted' : backup.status}</span>{backup.verified_at && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 size={11} /> Verified</span>}</div><p className="mt-1 text-[11px] text-muted-foreground">{date(backup.started_at)} · {bytes(backup.size_bytes)} · {String(backup.trigger).replace('_', ' ')}</p>{backup.error_message && <p className="mt-1 line-clamp-2 text-[11px] text-red-400">{backup.error_message}</p>}</div>
            {backup.status === 'completed' && !backup.deleted_at && <div className="flex flex-wrap gap-1"><Button type="button" size="sm" variant="ghost" title="Verify backup" onClick={() => action(`verify:${backup.id}`, () => rootminster.backups.verify(backup.id), 'Backup successfully verified')} disabled={Boolean(busy)}>{busy === `verify:${backup.id}` ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}</Button><Button type="button" size="sm" variant="ghost" title="Download encrypted archive" onClick={() => window.location.assign(rootminster.backups.downloadUrl(backup.id))} disabled={Boolean(busy)}><Download size={14} /></Button><Button type="button" size="sm" variant="ghost" title="Restore backup" onClick={() => { setRestoreTarget(backup); setConfirmation(''); setTotpCode(''); }} disabled={Boolean(busy)}><RefreshCw size={14} /></Button><Button type="button" size="sm" variant="ghost" title="Delete backup" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(backup)} disabled={Boolean(busy)}><Trash2 size={14} /></Button></div>}
          </div>)}
        </div>}
      </div>

      <AlertDialog open={Boolean(restoreTarget)} onOpenChange={(open) => { if (!open) { setRestoreTarget(null); setConfirmation(''); setTotpCode(''); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restore this database backup?</AlertDialogTitle><AlertDialogDescription>Rootminster will create a safety backup, enter maintenance mode, restore the archive and revoke all active sessions and access grants.</AlertDialogDescription></AlertDialogHeader><div className="space-y-3"><div className="space-y-2"><label className="text-xs font-medium text-foreground">Enter <strong>RESTORE</strong> to continue</label><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></div><div className="space-y-2"><label className="text-xs font-medium text-foreground">Current 2FA code</label><Input value={totpCode} onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" /></div></div><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={restore} disabled={confirmation !== 'RESTORE' || !/^\d{6}$/.test(totpCode)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Restore database</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this backup?</AlertDialogTitle><AlertDialogDescription>The encrypted archive will be permanently deleted from Cloudflare R2. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const target = deleteTarget; setDeleteTarget(null); action(`delete:${target.id}`, () => rootminster.backups.delete(target.id), 'Backup deleted'); }}>Delete backup</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
