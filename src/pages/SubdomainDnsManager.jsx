import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DnsToolbar from '@/components/dns/DnsToolbar';
import DnsRecordRow from '@/components/dns/DnsRecordRow';
import DnsAddRow from '@/components/dns/DnsAddRow';
import DnsTemplateDialog from '@/components/dns/DnsTemplateDialog';
import {
  ArrowLeft, Plus, Download, Upload, Check, Trash2, Globe, ChevronDown, Cloud, Sparkles, ShieldCheck, BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { PROXYABLE_TYPES, BASE_RECORD_TYPES, TTL_OPTIONS } from '@/components/dns/dnsConfig';
import { usePublicConfig } from '@/lib/public-config';

// Derive the top-level subdomain root a record belongs to.
function subRootOf(r) {
  const zone = r.zone_name;
  if (!zone || !r.name) return r.name || '';
  const base = r.name.endsWith('.' + zone) ? r.name.slice(0, -(zone.length + 1)) : r.name;
  const labels = base.split('.');
  return labels.length <= 1 ? r.name : labels.slice(1).join('.') + '.' + zone;
}

export default function SubdomainDnsManager() {
  const { t } = useTranslation();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const subdomainName = params.get('subdomain');

  const [records, setRecords] = useState([]);
  const [ownership, setOwnership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [nsUnlocked, setNsUnlocked] = useState(false);
  const [allNames, setAllNames] = useState([]);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [proxyFilter, setProxyFilter] = useState('all');
  const [cols, setCols] = useState({ type: true, content: true, proxy: true, ttl: true, status: true });
  const [selected, setSelected] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [showAddRow, setShowAddRow] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', record_type: 'A', record_value: '', proxied: false, ttl: 3600 });
  const [addLoading, setAddLoading] = useState(false);
  const [bulkTtl, setBulkTtl] = useState(3600);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateApplying, setTemplateApplying] = useState(false);

  useEffect(() => {
    if (!subdomainName) navigate('/my-subdomains');
  }, [subdomainName, navigate]);

  const load = async () => {
    if (!subdomainName) return;
    setLoading(true);
    try {
      const user = await rootminster.auth.me();
      setMe(user);
      setNsUnlocked(!config.features.nsRequiresDonation || !!user?.ns_unlocked);
      const [allRecs, owned] = await Promise.all([
        rootminster.entities.DnsRecord.filter({ owner_id: user.id, managed: true }),
        rootminster.entities.SubdomainOwnership.filter({ owner_id: user.id }),
      ]);
      const currentOwnership = owned.find(item => item.full_name?.toLowerCase() === subdomainName.toLowerCase()) || null;
      const recs = allRecs.filter(r => r.name === subdomainName || r.name?.endsWith('.' + subdomainName));
      setRecords(recs);
      setOwnership(currentOwnership);
      const roots = Array.from(new Set([
        ...owned.map(item => item.full_name),
        ...allRecs.map(subRootOf),
      ].filter(Boolean)));
      setAllNames(roots);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (subdomainName) load(); }, [subdomainName, config.features.nsRequiresDonation]);  

  const availableTypes = nsUnlocked ? [...BASE_RECORD_TYPES, 'NS'] : BASE_RECORD_TYPES;
  const rootDomain = ownership?.root_domain || records[0]?.zone_name || (subdomainName ? subdomainName.split('.').slice(1).join('.') : '');
  const isSuspended = ownership?.status === 'suspended';

  // All DNS changes are applied directly. Edit requests are no longer created.
  const mutateDns = async (payload) => {
    const response = await rootminster.functions.invoke('manageDnsRecord', {
      ...payload,
      base_name: subdomainName,
    });
    return response.data;
  };

  const handleSaveChange = async (record, changes) => {
    setSavingId(record.id);
    try {
      await mutateDns({ action: 'update', record_id: record.id, ...changes });
      toast.success(t('dnsManager.saved'));
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || t('dnsManager.saveFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleProxy = async (record) => {
    if (!PROXYABLE_TYPES.includes(record.record_type)) return;
    setSavingId(record.id);
    try {
      await mutateDns({ action: 'update', record_id: record.id, proxied: !record.proxied });
      toast.success(record.proxied ? t('dnsManager.setDnsOnly') : t('dnsManager.setProxied'));
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || t('dnsManager.toggleProxyFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (record) => {
    setSavingId(record.id);
    try {
      await mutateDns({ action: 'delete', record_id: record.id });
      toast.success(t('dnsManager.deleted'));
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || t('dnsManager.deleteFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const handleCopy = (record) => {
    navigator.clipboard?.writeText(record.content || '');
    toast.success(t('dnsManager.copied'));
  };

  const handleDuplicate = (record) => {
    setShowAddRow(true);
    setAddForm({ name: '', record_type: record.record_type, record_value: record.content, proxied: false, ttl: 3600 });
  };

  // Add root and arbitrarily nested records through the same direct mutation path.
  const createRecord = async ({ isRoot, label, full, record_type, record_value, proxied, ttl }) => {
    const name = isRoot ? subdomainName : (full || `${label}.${subdomainName}`);
    await mutateDns({
      action: 'create',
      name,
      record_type,
      content: record_value.trim(),
      ttl,
      proxied,
    });
  };

  const handleAddSubmit = async (payload) => {
    setAddLoading(true);
    try {
      await createRecord(payload);
      toast.success(isSuspended ? 'DNS record added — your subdomain is active again.' : t('dnsManager.saved'));
      setShowAddRow(false);
      setAddForm({ name: '', record_type: 'A', record_value: '', proxied: false, ttl: 3600 });
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || t('dnsManager.addFailed'));
    } finally {
      setAddLoading(false);
    }
  };

  const handleApplyTemplate = async (templateRecords) => {
    setTemplateApplying(true);
    let applied = 0;
    try {
      for (const record of templateRecords) {
        const isRoot = !record.name || record.name === '@';
        await createRecord({
          isRoot,
          label: isRoot ? '' : record.name,
          full: isRoot ? subdomainName : `${record.name}.${subdomainName}`,
          record_type: record.record_type,
          record_value: record.record_value,
          proxied: !!record.proxied,
          ttl: record.ttl || 3600,
        });
        applied += 1;
      }
      toast.success(applied === 1 ? t('dnsManager.templateAppliedOne', { count: applied }) : t('dnsManager.templateAppliedOther', { count: applied }));
      setTemplateOpen(false);
      await load();
    } catch (err) {
      const prefix = applied > 0 ? (applied === 1 ? t('dnsManager.templatePartialPrefixOne', { count: applied }) : t('dnsManager.templatePartialPrefixOther', { count: applied })) : '';
      toast.success(`${prefix}${err?.response?.data?.error || err?.message || t('dnsManager.templateFailed')}`);
      await load();
    } finally {
      setTemplateApplying(false);
    }
  };

  // ── Bulk actions ──
  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = records.length > 0 && records.every(r => selected.has(r.id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(records.map(r => r.id)));

  const bulkDelete = async () => {
    const ids = [...selected];
    for (const id of ids) {
      const r = records.find(x => x.id === id);
      if (!r) continue;
      setSavingId(id);
      try {
        await mutateDns({ action: 'delete', record_id: r.id });
      } catch (err) { toast.error(err?.response?.data?.error || t('dnsManager.bulkDeleteFailed', { name: r.name })); break; }
    }
    setSavingId(null);
    setSelected(new Set());
    setBulkOpen(false);
    toast.success(t('dnsManager.bulkDeleted', { count: ids.length }));
    await load();
  };

  const bulkToggleProxy = async () => {
    const ids = [...selected].filter(id => { const r = records.find(x => x.id === id); return r && PROXYABLE_TYPES.includes(r.record_type); });
    for (const id of ids) {
      const r = records.find(x => x.id === id);
      setSavingId(id);
      try {
        await mutateDns({ action: 'update', record_id: r.id, proxied: !r.proxied });
      } catch (err) { toast.error(err?.response?.data?.error || t('dnsManager.bulkUpdateFailed', { name: r.name })); break; }
    }
    setSavingId(null);
    setSelected(new Set());
    setBulkOpen(false);
    toast.success(t('dnsManager.proxyToggled'));
    await load();
  };

  const bulkSetTtl = async () => {
    for (const id of [...selected]) {
      const r = records.find(x => x.id === id);
      if (!r) continue;
      setSavingId(id);
      try {
        await mutateDns({ action: 'update', record_id: r.id, ttl: Number(bulkTtl) });
      } catch (err) { toast.error(err?.response?.data?.error || t('dnsManager.bulkUpdateFailed', { name: r.name })); break; }
    }
    setSavingId(null);
    setSelected(new Set());
    setBulkOpen(false);
    toast.success(t('dnsManager.ttlUpdated'));
    await load();
  };

  const resetFilters = () => { setSearch(''); setTypeFilter('all'); setProxyFilter('all'); };

  const filtered = useMemo(() => records.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${r.name} ${r.content} ${r.record_type}`.toLowerCase().includes(q)) return false;
    }
    if (typeFilter !== 'all' && r.record_type !== typeFilter) return false;
    if (proxyFilter !== 'all') {
      if (proxyFilter === 'proxied' && !r.proxied) return false;
      if (proxyFilter === 'dns' && r.proxied) return false;
    }
    return true;
  }), [records, search, typeFilter, proxyFilter]);

  if (!subdomainName) return null;

  const colSpan = 2 + (cols.type ? 1 : 0) + (cols.content ? 1 : 0) + (cols.proxy ? 1 : 0) + (cols.ttl ? 1 : 0) + (cols.status ? 1 : 0) + 1;

  return (
    <div className="space-y-6">
      {/* ── DNS page header ── */}
      <div className="border-b border-border pb-5">
        <button
          onClick={() => navigate('/my-subdomains')}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} /> {t('dnsManager.backToDomains')}
        </button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('dnsManager.title')}</h1>
              {isSuspended ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                  Suspended
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <ShieldCheck size={11} /> {t('dnsManager.managed')}
                </span>
              )}
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t('dnsManager.subtitlePre')}<span className="font-mono text-foreground">{subdomainName}</span>{t('dnsManager.subtitlePost')}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={subdomainName} onValueChange={(v) => navigate(`/subdomain-dns-manager?subdomain=${encodeURIComponent(v)}`)}>
              <SelectTrigger className="h-9 w-full bg-background font-mono text-sm font-medium sm:min-w-[220px] sm:w-auto"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(allNames.length ? allNames : [subdomainName]).map(n => <SelectItem key={n} value={n} className="font-mono text-sm">{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => { setShowAddRow(true); }} className="h-9 w-full gap-2 px-4 sm:w-auto">
              <Plus size={15} /> {t('dnsManager.addRecord')}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span><strong className="font-medium text-foreground tabular-nums">{records.length}</strong> {t('dnsManager.recordsLabel')}</span>
          <span>{t('dnsManager.zone')} <strong className="font-mono font-medium text-foreground">{rootDomain}</strong></span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t('dnsManager.cloudflareSync')}</span>
        </div>
      </div>

      {isSuspended && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">This subdomain is suspended because it has no DNS records.</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a record during the 7-day grace period to reactivate it immediately.</p>
          </div>
          <Button onClick={() => setShowAddRow(true)} className="h-9 shrink-0 gap-2 px-4">
            <Plus size={15} /> Add record and reactivate
          </Button>
        </div>
      )}

      {/* ── Secondary actions ── */}
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap sm:items-center">
          <Button onClick={() => setTemplateOpen(true)} variant="outline" className="h-9 w-full gap-2 sm:w-auto">
            <Sparkles size={14} /> {t('dnsManager.templates')}
          </Button>

          <Button onClick={() => toast.info(t('dnsManager.importToast'))} variant="outline" className="h-9 w-full gap-2 sm:w-auto">
            <Upload size={14} /> {t('dnsManager.import')}
          </Button>
          <Button onClick={() => toast.info(t('dnsManager.exportToast'))} variant="outline" className="h-9 w-full gap-2 sm:w-auto">
            <Download size={14} /> {t('dnsManager.export')}
          </Button>
          <Button onClick={() => navigate(`/analytics?subdomain=${encodeURIComponent(subdomainName)}`)} variant="outline" className="h-9 w-full gap-2 min-[420px]:col-span-3 sm:w-auto">
            <BarChart3 size={14} /> Analytics
          </Button>
        </div>

      <DnsTemplateDialog
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        baseName={subdomainName}
        existingRecords={records}
        onApply={handleApplyTemplate}
        applying={templateApplying}
      />

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{t('dnsManager.selectedCount', { count: selected.size })}</span>
          <button onClick={() => setBulkOpen(o => !o)} className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-input text-xs hover:bg-accent transition-colors">
            {t('dnsManager.setTtl')} <ChevronDown size={12} className="transition-transform" style={{ transform: bulkOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {bulkOpen && (
            <div className="flex items-center gap-1.5">
              <Select value={String(bulkTtl)} onValueChange={v => setBulkTtl(Number(v))}>
                <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTL_OPTIONS.map(o => <SelectItem key={o.v} value={String(o.v)} className="text-xs">{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={bulkSetTtl} className="h-8 gap-2"><Check size={13} /> {t('common.apply')}</Button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={bulkToggleProxy} className="h-8 gap-2"><Cloud size={14} className="fill-accent text-accent" /> {t('dnsManager.toggleProxy')}</Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete} className="h-8 gap-2"><Trash2 size={13} /> {t('dnsManager.delete')}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setSelected(new Set()); setBulkOpen(false); }} className="h-8 text-muted-foreground hover:text-foreground ml-auto">{t('dnsManager.clear')}</Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
        <DnsToolbar
          search={search} setSearch={setSearch}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          proxyFilter={proxyFilter} setProxyFilter={setProxyFilter}
          cols={cols} setCols={setCols}
          onReset={resetFilters}
          recordCount={filtered.length}
        />

        <div className="overflow-x-auto review-modal-scroll" style={{ maxHeight: 'calc(100dvh - 230px)' }}>
          <table className="w-full text-sm min-w-[640px] border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-card text-muted-foreground text-[10px] uppercase tracking-wide border-b border-border/60">
                <th className="sticky left-0 z-20 bg-card w-11 px-2 text-center font-medium py-2.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-input accent-primary cursor-pointer" />
                </th>
                <th className="sticky left-11 z-20 min-w-[130px] bg-card px-3 py-2.5 pl-1 text-left font-medium sm:min-w-[160px]">{t('dnsManager.colName')}</th>
                {cols.type && <th className="text-left px-3 font-medium py-2.5">{t('dnsManager.colType')}</th>}
                {cols.content && <th className="text-left px-3 font-medium py-2.5">{t('dnsManager.colContent')}</th>}
                {cols.proxy && <th className="text-left px-3 font-medium py-2.5">{t('dnsManager.colProxy')}</th>}
                {cols.ttl && <th className="text-left px-3 font-medium py-2.5">{t('dnsManager.colTtl')}</th>}
                {cols.status && <th className="text-left px-3 font-medium py-2.5">{t('dnsManager.colStatus')}</th>}
                <th className="text-right px-3 font-medium py-2.5 w-24">{t('dnsManager.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {showAddRow && (
                <DnsAddRow
                  form={addForm}
                  setForm={setAddForm}
                  availableTypes={availableTypes}
                  baseName={subdomainName}
                  existingRecords={records}
                  cols={cols}
                  onSave={handleAddSubmit}
                  onCancel={() => setShowAddRow(false)}
                  saving={addLoading}
                />
              )}

              {loading ? (
                <tr><td colSpan={colSpan} className="text-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-center py-16 text-muted-foreground">
                    <Globe size={28} className="mx-auto mb-3 opacity-40" />
                    <p className="text-sm">{search || typeFilter !== 'all' || proxyFilter !== 'all' ? t('dnsManager.noMatch') : t('dnsManager.noRecords')}</p>
                  </td>
                </tr>
              ) : (
                filtered.map(record => (
                  <DnsRecordRow
                    key={record.id}
                    record={record}
                    subdomainName={subdomainName}
                    cols={cols}
                    existingRecords={records}
                    selected={selected.has(record.id)}
                    onToggleSelect={() => toggleSelect(record.id)}
                    editing={editingId === record.id}
                    saving={savingId === record.id}
                    onEnterEdit={setEditingId}
                    onExitEdit={() => setEditingId(null)}
                    onSaveChange={handleSaveChange}
                    onToggleProxy={handleToggleProxy}
                    onCopy={handleCopy}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
