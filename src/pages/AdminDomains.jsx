import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, RefreshCw, Trash2, AlertTriangle, Globe, Database, CheckCircle2, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

export default function AdminDomains() {
  const { t } = useTranslation();
  const [domains, setDomains] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [zones, setZones] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [newDomain, setNewDomain] = useState({ zone_id: '', name: '' });
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    const [doms, logs] = await Promise.all([
      rootminster.entities.Domain.list(),
      rootminster.entities.SyncLog.list('-created_date', 20)
    ]);
    setDomains(doms);
    setSyncLogs(logs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const res = await rootminster.functions.invoke('getCloudflareZones', {});
      setZones(res.data.zones || []);
    } catch { toast.error(t('adminDomains.fetchZonesFailed')); }
    finally { setLoadingZones(false); }
  };

  const addDomain = async () => {
    if (!newDomain.zone_id || !newDomain.name) return;
    try {
      await rootminster.entities.Domain.create({ ...newDomain, status: 'active', allow_new_requests: true });
      toast.success(t('adminDomains.domainAdded'));
      setShowAdd(false);
      setNewDomain({ zone_id: '', name: '' });
      load();
    } catch { toast.error(t('adminDomains.domainAddFailed')); }
  };

  const syncDomain = async (domain) => {
    setSyncingId(domain.id);
    try {
      const res = await rootminster.functions.invoke('syncCloudflare', { zone_id: domain.zone_id, zone_name: domain.name });
      toast.success(t('adminDomains.syncedToast', { count: res.data.records_synced, name: domain.name }));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || t('adminDomains.syncFailed'));
    } finally {
      setSyncingId(null);
    }
  };

  const deleteDomain = async () => {
    if (!confirmDelete) return;
    await rootminster.entities.Domain.delete(confirmDelete.id);
    toast.success(t('adminDomains.domainRemoved'));
    setConfirmDelete(null);
    load();
  };

  const domainColumns = [
    { key: 'name', label: t('adminDomains.colDomain'), render: v => <span className="font-mono text-primary font-medium">{v}</span> },
    { key: 'zone_id', label: t('adminDomains.colZoneId'), render: v => <span className="font-mono text-muted-foreground text-xs">{v}</span> },
    { key: 'record_count', label: t('adminDomains.colRecords'), render: v => <span className="text-foreground text-sm tabular-nums">{v || 0}</span> },
    { key: 'status', label: t('adminDomains.colStatus'), render: v => <StatusBadge status={v} /> },
    { key: 'allow_new_requests', label: t('adminDomains.colRequests'), render: v => <span className={v ? 'text-emerald-400 text-xs' : 'text-destructive text-xs'}>{v ? t('adminDomains.reqOpen') : t('adminDomains.reqClosed')}</span> },
    { key: 'last_synced', label: t('adminDomains.colLastSync'), render: v => <span className="text-muted-foreground text-xs">{v ? format(new Date(v), 'MMM d, HH:mm') : t('adminDomains.never')}</span> },
    { key: 'id', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => syncDomain(row)} disabled={syncingId === row.id}
          className="text-muted-foreground hover:text-foreground hover:bg-muted h-7 text-xs gap-1">
          <RefreshCw size={11} className={syncingId === row.id ? 'animate-spin' : ''} /> {t('adminDomains.sync')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(row)} aria-label={`${t('adminDomains.removeTitle')} ${row.name}`}
          className="text-destructive hover:bg-destructive/10 h-7">
          <Trash2 size={11} />
        </Button>
      </div>
    )},
  ];

  const logColumns = [
    { key: 'zone_name', label: t('adminDomains.logZone'), render: v => <span className="font-mono text-foreground text-sm">{v}</span> },
    { key: 'status', label: t('adminDomains.logStatus'), render: v => <StatusBadge status={v} /> },
    { key: 'records_synced', label: t('adminDomains.logSynced'), render: v => <span className="text-foreground text-sm tabular-nums">{v || 0}</span> },
    { key: 'records_added', label: t('adminDomains.logAdded'), render: v => <span className="text-emerald-400 text-sm tabular-nums">{v || 0}</span> },
    { key: 'records_updated', label: t('adminDomains.logUpdated'), render: v => <span className="text-primary text-sm tabular-nums">{v || 0}</span> },
    { key: 'triggered_by', label: t('adminDomains.logBy'), render: v => <span className="text-muted-foreground text-xs">{v || t('commonExt.system')}</span> },
    { key: 'created_date', label: t('adminDomains.logTime'), render: v => <span className="text-muted-foreground text-xs">{v ? format(new Date(v), 'MMM d, HH:mm') : '—'}</span> },
    { key: 'error_message', label: t('adminDomains.logError'), render: v => v ? <span className="text-destructive text-xs truncate max-w-[120px] block" title={v}>{v}</span> : <span className="text-muted-foreground/60">—</span> },
  ];

  const openForRequests = domains.filter(d => d.allow_new_requests).length;
  const failedSyncs = syncLogs.filter(s => s.status === 'failed').length;
  const totalRecords = domains.reduce((sum, d) => sum + (d.record_count || 0), 0);

  return (
    <div className="space-y-6">
      <AlertDialog open={!!confirmDelete} onOpenChange={open => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle size={16} className="text-destructive" /> {t('adminDomains.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('adminDomains.removeConfirm', { domain: confirmDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteDomain} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('adminDomains.removeAction')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t('adminDomains.eyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('adminDomains.title')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('adminDomains.subtitle')}</p>
        </div>
        <Button onClick={() => { setShowAdd(true); fetchZones(); }} className="h-9 gap-2 px-4">
          <Plus size={15} /> {t('adminDomains.addDomain')}
        </Button>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-4">
        {[
          { label: t('adminDomains.labelZones'), value: domains.length, icon: Globe },
          { label: t('adminDomains.labelRecords'), value: totalRecords, icon: Database },
          { label: t('adminDomains.labelOpen'), value: openForRequests, icon: CheckCircle2 },
          { label: t('adminDomains.labelFailed'), value: failedSyncs, icon: XCircle },
        ].map((item, index) => (
          <div key={item.label} className={`${index > 0 ? 'border-l border-border' : ''} px-4 py-3.5`}>
            <div className="flex items-center gap-2 text-muted-foreground"><item.icon size={13} /><span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span></div>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{t('adminDomains.connectedZones')}</h2>
                <span className="text-xs text-muted-foreground">{t('adminDomains.configured', { count: domains.length })}</span>
              </div>
              <DataTable columns={domainColumns} data={domains} searchKeys={['name']} emptyMessage={t('adminDomains.noDomains')} />
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{t('adminDomains.syncHistory')}</h2>
                <span className="text-xs text-muted-foreground">{t('adminDomains.latest', { count: syncLogs.length })}</span>
              </div>
              <DataTable columns={logColumns} data={syncLogs} searchKeys={['zone_name']} emptyMessage={t('adminDomains.noSync')} />
            </section>
          </div>
        </>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t('adminDomains.addZoneTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {zones.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-xs">{t('adminDomains.selectZones')}</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto review-modal-scroll">
                  {zones.map(z => (
                    <button key={z.id} onClick={() => setNewDomain({ zone_id: z.id, name: z.name })}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-sm ${newDomain.zone_id === z.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/60 text-foreground'}`}>
                      <span className="font-medium">{z.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">{z.id}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('adminDomains.zoneId')}</Label>
                  <Input value={newDomain.zone_id} onChange={e => setNewDomain(d => ({ ...d, zone_id: e.target.value }))} placeholder="abc123..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('adminDomains.domainName')}</Label>
                  <Input value={newDomain.name} onChange={e => setNewDomain(d => ({ ...d, name: e.target.value }))} placeholder="example.com" />
                </div>
              </div>
            )}
            {loadingZones && <p className="text-muted-foreground text-sm text-center">{t('adminDomains.loadingZones')}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">{t('common.cancel')}</Button>
              <Button onClick={addDomain} disabled={!newDomain.zone_id || !newDomain.name} className="flex-1">{t('adminDomains.addDomainBtn')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}